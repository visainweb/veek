# Veek

Organizador de proyectos y tareas para equipos, al estilo de Asana, Monday o ClickUp.

- Organizaciones con roles: propietario, administrador, miembro e invitado.
- Proyectos con tablero kanban, tareas asignadas por usuario y estado (pendiente, en proceso, finalizada).
- Detalle de tarea para editarla o eliminarla, y calendario con arrastrar para cambiar fechas.
- Miembros: invitar por correo, cambiar roles y quitar personas.
- Carpetas y adjuntos por tarea (en desarrollo).
- Pensado para empaquetarse como app de Android e iPhone con Capacitor.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript + Tailwind CSS 4
- [Supabase](https://supabase.com): Postgres, Auth, Storage, Realtime y seguridad por filas (RLS)

## Puesta en marcha

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el **SQL Editor** de Supabase, ejecuta en orden el contenido de
   el contenido de cada archivo de `supabase/migrations/`:
   `20261127000000_init.sql`, `20261127010000_grants.sql` y
   `20261128000000_members.sql`.
   (O con la CLI: `supabase link` y luego `supabase db push`.)
3. Copia `.env.example` a `.env.local` y completa `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings > API).
4. Instala y arranca:

   ```bash
   npm install
   npm run dev
   ```

5. Abre http://localhost:3000, crea tu cuenta y tu organización.

> Si Supabase tiene activada la confirmación por correo, agrega
> `http://localhost:3000/auth/callback` en Authentication > URL Configuration > Redirect URLs.

## Estructura

```
src/
  app/
    (auth)/login        Inicio de sesión y registro
    onboarding          Crear la organización
    (app)/dashboard     Lista de proyectos
    (app)/projects/[id] Tablero del proyecto
    (app)/my-tasks      Tareas asignadas a mí
    (app)/calendar      Calendario de tareas (FullCalendar)
    (app)/members       Miembros, invitaciones y roles
    actions             Server Actions de tareas y miembros
  components            Tablero, detalle de tarea, calendario, controles de miembros
  lib/supabase          Clientes de Supabase (navegador, servidor, proxy)
  proxy.ts              Refresca la sesión y protege rutas
supabase/migrations     Esquema de base de datos, roles y políticas
```

## Modelo de datos

| Tabla | Descripción |
| --- | --- |
| `profiles` | Datos públicos del usuario (se crea al registrarse) |
| `organizations` | Espacio de trabajo del equipo |
| `organization_members` | Usuario + organización + rol |
| `projects` | Proyectos de la organización |
| `board_columns` | Columnas del tablero (Por hacer, En proceso, Finalizado por defecto) |
| `tasks` | Tareas con responsable, fechas, estado, prioridad y orden |
| `task_folders` | Carpetas dentro de una tarea (anidables) |
| `task_attachments` | Archivos adjuntos (bucket privado `attachments`) |
| `task_comments` | Comentarios en tareas |
| `organization_invitations` | Invitaciones pendientes por correo (se aceptan solas al registrarse) |

### Permisos por rol

| Acción | Propietario | Admin | Miembro | Invitado |
| --- | :-: | :-: | :-: | :-: |
| Ver proyectos y tareas | ✓ | ✓ | ✓ | ✓ |
| Comentar | ✓ | ✓ | ✓ | ✓ |
| Crear y editar tareas, carpetas, adjuntos | ✓ | ✓ | ✓ | |
| Crear proyectos | ✓ | ✓ | ✓ | |
| Borrar tareas de otros | ✓ | ✓ | | |
| Borrar proyectos, gestionar miembros | ✓ | ✓ | | |
| Borrar la organización, nombrar propietarios | ✓ | | | |

## Hoja de ruta

1. ✅ Base del proyecto, autenticación, organizaciones y roles
2. ✅ Proyectos y tablero básico
3. ✅ Detalle de tarea: editar y eliminar
4. ✅ Calendario
5. ✅ Invitar miembros y gestionar roles
6. ⬜ Arrastrar y soltar en el tablero
7. ⬜ Carpetas y adjuntos dentro de las tareas
8. ⬜ PWA y apps Android / iPhone con Capacitor
