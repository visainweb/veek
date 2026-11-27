-- Veek: esquema inicial
-- Organizaciones, miembros con roles, proyectos, tablero, tareas, carpetas, adjuntos y comentarios.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member', 'guest');
create type public.task_status as enum ('pending', 'in_progress', 'done');
create type public.task_priority as enum ('low', 'medium', 'high');

-- ---------------------------------------------------------------------------
-- Perfiles (1 a 1 con auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Organizaciones y miembros
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

-- Funciones auxiliares para las políticas (security definer evita recursión de RLS)
create function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create function public.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = p_org and user_id = auth.uid() and role = any (p_roles)
  );
$$;

-- Crea una organización y deja al usuario actual como propietario
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  insert into public.organizations (name, created_by)
  values (p_name, auth.uid())
  returning id into v_org;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org, auth.uid(), 'owner');

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Proyectos y columnas del tablero
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  color text not null default '#f06a6a',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index projects_org_idx on public.projects (org_id);

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create index board_columns_project_idx on public.board_columns (project_id, position);

-- Columnas por defecto al crear un proyecto
create function public.create_default_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.board_columns (project_id, name, position) values
    (new.id, 'Por hacer', 1000),
    (new.id, 'En proceso', 2000),
    (new.id, 'Finalizado', 3000);
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.create_default_columns();

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  column_id uuid references public.board_columns (id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  assignee_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  start_date date,
  due_date date,
  position double precision not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or due_date is null or start_date <= due_date)
);

create index tasks_project_idx on public.tasks (project_id, column_id, position);
create index tasks_assignee_idx on public.tasks (assignee_id, due_date);
create index tasks_org_due_idx on public.tasks (org_id, due_date);

-- Mantiene org_id coherente con el proyecto, updated_at y completed_at
create function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select org_id into new.org_id from public.projects where id = new.project_id;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- ---------------------------------------------------------------------------
-- Carpetas y adjuntos por tarea
-- ---------------------------------------------------------------------------
create table public.task_folders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  parent_id uuid references public.task_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_folders_task_idx on public.task_folders (task_id, parent_id);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  folder_id uuid references public.task_folders (id) on delete cascade,
  file_name text not null,
  -- Ruta en el bucket "attachments": {org_id}/{task_id}/{uuid}-{file_name}
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments (task_id, folder_id);

-- ---------------------------------------------------------------------------
-- Comentarios
-- ---------------------------------------------------------------------------
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- Organización a la que pertenece una tarea (para políticas de tablas hijas)
create function public.task_org(p_task uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.tasks where id = p_task;
$$;

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
--   owner/admin: gestionan organización, miembros y proyectos
--   member: crea y edita tareas, carpetas, adjuntos y comentarios
--   guest: solo lectura, salvo comentar
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_folders enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_comments enable row level security;

-- Perfiles: cada uno ve el suyo y los de quienes comparten organización
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.organization_members me
    join public.organization_members other on other.org_id = me.org_id
    where me.user_id = auth.uid() and other.user_id = profiles.id
  )
);
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Organizaciones (la creación va por create_organization)
create policy "orgs_select" on public.organizations for select
  using (public.is_org_member(id));
create policy "orgs_update" on public.organizations for update
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));
create policy "orgs_delete" on public.organizations for delete
  using (public.has_org_role(id, array['owner']::public.org_role[]));

-- Miembros
create policy "members_select" on public.organization_members for select
  using (public.is_org_member(org_id));
create policy "members_insert" on public.organization_members for insert
  with check (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    and (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.org_role[]))
  );
create policy "members_update" on public.organization_members for update
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (role <> 'owner' or public.has_org_role(org_id, array['owner']::public.org_role[]));
create policy "members_delete" on public.organization_members for delete
  using (
    user_id = auth.uid()
    or public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
  );

-- Proyectos
create policy "projects_select" on public.projects for select
  using (public.is_org_member(org_id));
create policy "projects_insert" on public.projects for insert
  with check (public.has_org_role(org_id, array['owner', 'admin', 'member']::public.org_role[]));
create policy "projects_update" on public.projects for update
  using (public.has_org_role(org_id, array['owner', 'admin', 'member']::public.org_role[]));
create policy "projects_delete" on public.projects for delete
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- Columnas del tablero
create policy "columns_select" on public.board_columns for select
  using (public.is_org_member((select org_id from public.projects p where p.id = project_id)));
create policy "columns_write" on public.board_columns for all
  using (public.has_org_role((select org_id from public.projects p where p.id = project_id), array['owner', 'admin', 'member']::public.org_role[]))
  with check (public.has_org_role((select org_id from public.projects p where p.id = project_id), array['owner', 'admin', 'member']::public.org_role[]));

-- Tareas
create policy "tasks_select" on public.tasks for select
  using (public.is_org_member(org_id));
create policy "tasks_insert" on public.tasks for insert
  with check (public.has_org_role(
    (select org_id from public.projects p where p.id = project_id),
    array['owner', 'admin', 'member']::public.org_role[]
  ));
create policy "tasks_update" on public.tasks for update
  using (public.has_org_role(org_id, array['owner', 'admin', 'member']::public.org_role[]))
  with check (public.has_org_role(
    (select org_id from public.projects p where p.id = project_id),
    array['owner', 'admin', 'member']::public.org_role[]
  ));
create policy "tasks_delete" on public.tasks for delete
  using (
    public.has_org_role(org_id, array['owner', 'admin']::public.org_role[])
    or (created_by = auth.uid() and public.has_org_role(org_id, array['member']::public.org_role[]))
  );

-- Carpetas
create policy "folders_select" on public.task_folders for select
  using (public.is_org_member(public.task_org(task_id)));
create policy "folders_write" on public.task_folders for all
  using (public.has_org_role(public.task_org(task_id), array['owner', 'admin', 'member']::public.org_role[]))
  with check (public.has_org_role(public.task_org(task_id), array['owner', 'admin', 'member']::public.org_role[]));

-- Adjuntos
create policy "attachments_select" on public.task_attachments for select
  using (public.is_org_member(public.task_org(task_id)));
create policy "attachments_write" on public.task_attachments for all
  using (public.has_org_role(public.task_org(task_id), array['owner', 'admin', 'member']::public.org_role[]))
  with check (public.has_org_role(public.task_org(task_id), array['owner', 'admin', 'member']::public.org_role[]));

-- Comentarios: todos los miembros (incluidos invitados) pueden comentar
create policy "comments_select" on public.task_comments for select
  using (public.is_org_member(public.task_org(task_id)));
create policy "comments_insert" on public.task_comments for insert
  with check (author_id = auth.uid() and public.is_org_member(public.task_org(task_id)));
create policy "comments_update_own" on public.task_comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "comments_delete" on public.task_comments for delete
  using (
    author_id = auth.uid()
    or public.has_org_role(public.task_org(task_id), array['owner', 'admin']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- Almacenamiento de archivos (bucket privado "attachments")
-- La primera carpeta de la ruta es el id de la organización.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select" on storage.objects for select
  using (
    bucket_id = 'attachments'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
create policy "attachments_storage_insert" on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'member']::public.org_role[])
  );
create policy "attachments_storage_delete" on storage.objects for delete
  using (
    bucket_id = 'attachments'
    and public.has_org_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin', 'member']::public.org_role[])
  );

-- ---------------------------------------------------------------------------
-- Tiempo real para el tablero
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks, public.board_columns;
