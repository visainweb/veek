-- Permisos explícitos para la Data API de Supabase.
-- Desde 2026 los proyectos nuevos de Supabase ya no exponen automáticamente
-- las tablas del esquema public a los roles anon/authenticated. Sin estos
-- GRANT, las consultas de la app fallan con "permission denied".
-- Las políticas RLS siguen decidiendo qué filas puede ver o cambiar cada usuario.
-- Es seguro ejecutar este archivo más de una vez.

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.projects,
  public.board_columns,
  public.tasks,
  public.task_folders,
  public.task_attachments,
  public.task_comments
to authenticated;

grant execute on function
  public.create_organization(text),
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.org_role[]),
  public.task_org(uuid)
to authenticated;

-- Los visitantes sin sesión no pueden crear organizaciones
revoke execute on function public.create_organization(text) from anon, public;
