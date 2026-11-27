-- Veek: gestión de miembros
--   * Correo en perfiles (para ver quién es quién en la lista de miembros)
--   * Invitaciones por correo: si la persona ya tiene cuenta se agrega al
--     momento; si no, entra sola a la organización al registrarse con ese correo
--   * Cambiar rol y quitar miembros con reglas claras:
--       - solo owner/admin gestionan miembros
--       - solo un propietario puede nombrar propietarios o tocar a otro propietario
--       - la organización nunca se queda sin propietario
-- Es seguro ejecutar este archivo más de una vez.

-- ---------------------------------------------------------------------------
-- Correo en perfiles
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;

-- Por si algún usuario quedó sin perfil
insert into public.profiles (id, full_name, email)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)), u.email
from auth.users u
on conflict (id) do nothing;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Relación miembros -> perfiles. Sin ella la app no puede leer el nombre de
-- cada miembro junto con su rol (la lista de responsables salía vacía).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_members_user_profile_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_user_profile_fkey
      foreign key (user_id) references public.profiles (id) on delete cascade;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitaciones pendientes
-- ---------------------------------------------------------------------------
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  role public.org_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists organization_invitations_email_idx
  on public.organization_invitations (email);

alter table public.organization_invitations enable row level security;

drop policy if exists "invitations_select" on public.organization_invitations;
create policy "invitations_select" on public.organization_invitations for select
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

drop policy if exists "invitations_delete" on public.organization_invitations;
create policy "invitations_delete" on public.organization_invitations for delete
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
-- La creación va por invite_member() para validar los roles.

-- ---------------------------------------------------------------------------
-- Al registrarse: crear perfil (con correo) y aceptar invitaciones pendientes
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update set email = excluded.email;

  insert into public.organization_members (org_id, user_id, role)
  select i.org_id, new.id, i.role
  from public.organization_invitations i
  where i.email = lower(new.email)
  on conflict (org_id, user_id) do nothing;

  delete from public.organization_invitations where email = lower(new.email);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitar: agrega al momento si ya tiene cuenta, si no deja la invitación
-- Devuelve 'added' o 'invited'.
-- ---------------------------------------------------------------------------
create or replace function public.invite_member(p_org uuid, p_email text, p_role public.org_role)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if not public.has_org_role(p_org, array['owner', 'admin']::public.org_role[]) then
    raise exception 'Solo propietarios y administradores pueden invitar';
  end if;
  if p_role = 'owner' and not public.has_org_role(p_org, array['owner']::public.org_role[]) then
    raise exception 'Solo un propietario puede nombrar a otro propietario';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido';
  end if;

  select id into v_user from auth.users where lower(email) = v_email;

  if v_user is not null then
    if exists (select 1 from public.organization_members where org_id = p_org and user_id = v_user) then
      raise exception 'Esa persona ya es miembro de la organización';
    end if;
    insert into public.organization_members (org_id, user_id, role) values (p_org, v_user, p_role);
    return 'added';
  end if;

  insert into public.organization_invitations (org_id, email, role, invited_by)
  values (p_org, v_email, p_role, auth.uid())
  on conflict (org_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  return 'invited';
end;
$$;

-- ---------------------------------------------------------------------------
-- Cambiar el rol de un miembro
-- ---------------------------------------------------------------------------
create or replace function public.change_member_role(p_org uuid, p_user uuid, p_role public.org_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.org_role;
  v_is_owner boolean := public.has_org_role(p_org, array['owner']::public.org_role[]);
begin
  if not public.has_org_role(p_org, array['owner', 'admin']::public.org_role[]) then
    raise exception 'Solo propietarios y administradores pueden cambiar roles';
  end if;

  select role into v_current from public.organization_members where org_id = p_org and user_id = p_user;
  if v_current is null then
    raise exception 'Esa persona no es miembro de la organización';
  end if;

  if (v_current = 'owner' or p_role = 'owner') and not v_is_owner then
    raise exception 'Solo un propietario puede cambiar propietarios';
  end if;

  if v_current = 'owner' and p_role <> 'owner'
     and (select count(*) from public.organization_members where org_id = p_org and role = 'owner') <= 1 then
    raise exception 'La organización necesita al menos un propietario';
  end if;

  update public.organization_members set role = p_role where org_id = p_org and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quitar a un miembro (o salir uno mismo)
-- ---------------------------------------------------------------------------
create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.org_role;
begin
  select role into v_current from public.organization_members where org_id = p_org and user_id = p_user;
  if v_current is null then
    raise exception 'Esa persona no es miembro de la organización';
  end if;

  if p_user <> auth.uid() then
    if not public.has_org_role(p_org, array['owner', 'admin']::public.org_role[]) then
      raise exception 'Solo propietarios y administradores pueden quitar miembros';
    end if;
    if v_current = 'owner' and not public.has_org_role(p_org, array['owner']::public.org_role[]) then
      raise exception 'Solo un propietario puede quitar a otro propietario';
    end if;
  end if;

  if v_current = 'owner'
     and (select count(*) from public.organization_members where org_id = p_org and role = 'owner') <= 1 then
    raise exception 'La organización necesita al menos un propietario';
  end if;

  delete from public.organization_members where org_id = p_org and user_id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reforzar las políticas directas sobre miembros: un administrador no puede
-- modificar ni quitar a un propietario (la app usa las funciones de arriba).
-- ---------------------------------------------------------------------------
drop policy if exists "members_update" on public.organization_members;
create policy "members_update" on public.organization_members for update
  using (
    public.has_org_role(org_id, array['owner']::public.org_role[])
    or (role <> 'owner' and public.has_org_role(org_id, array['admin']::public.org_role[]))
  )
  with check (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.org_role[]));

drop policy if exists "members_delete" on public.organization_members;
create policy "members_delete" on public.organization_members for delete
  using (
    (user_id = auth.uid() and role <> 'owner')
    or public.has_org_role(org_id, array['owner']::public.org_role[])
    or (role <> 'owner' and public.has_org_role(org_id, array['admin']::public.org_role[]))
  );

-- ---------------------------------------------------------------------------
-- Permisos para la Data API (los proyectos nuevos de Supabase los necesitan)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.organization_invitations to authenticated;

grant execute on function
  public.invite_member(uuid, text, public.org_role),
  public.change_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid)
to authenticated;

revoke execute on function
  public.invite_member(uuid, text, public.org_role),
  public.change_member_role(uuid, uuid, public.org_role),
  public.remove_member(uuid, uuid)
from anon, public;

-- Fuerza a la API a ver la nueva tabla y funciones
notify pgrst, 'reload schema';
