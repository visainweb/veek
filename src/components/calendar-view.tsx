"use client";

import { useCallback, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventChangeArg, EventInput } from "@fullcalendar/core";
import { updateTaskDates } from "@/app/actions/tasks";
import { TaskDialog, canEditTasks, type TaskPermissions } from "@/components/task-dialog";
import type { Person, Project, Task } from "@/lib/types";

type ProjectInfo = Pick<Project, "id" | "name" | "color">;

/** Suma días a una fecha "AAAA-MM-DD". */
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CalendarView({
  tasks,
  projects,
  people,
  permissions,
}: {
  tasks: Task[];
  projects: ProjectInfo[];
  people: Person[];
  permissions: TaskPermissions;
}) {
  const [onlyMine, setOnlyMine] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpenTaskId(null), []);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const editable = canEditTasks(permissions.role);

  const events = useMemo<EventInput[]>(() => {
    return tasks
      .filter((t) => !onlyMine || t.assignee_id === permissions.userId)
      .filter((t) => !projectId || t.project_id === projectId)
      .filter((t) => !hideDone || t.status !== "done")
      .map((t) => {
        const start = t.start_date ?? t.due_date!;
        const end = t.due_date ?? t.start_date!;
        const color = projectById.get(t.project_id)?.color ?? "#71717a";
        return {
          id: t.id,
          title: t.title,
          start,
          // En FullCalendar el fin de un evento de día completo es exclusivo
          end: addDays(end, 1),
          allDay: true,
          backgroundColor: color,
          borderColor: color,
          classNames: t.status === "done" ? ["veek-task-done"] : [],
        };
      });
  }, [tasks, onlyMine, projectId, hideDone, permissions.userId, projectById]);

  async function handleChange(arg: EventChangeArg) {
    const task = tasks.find((t) => t.id === arg.event.id);
    const start = arg.event.startStr.slice(0, 10);
    const end = arg.event.endStr ? addDays(arg.event.endStr.slice(0, 10), -1) : start;
    if (!task) return arg.revert();

    // Una tarea de un solo día sin fecha de inicio sigue siendo solo "fecha de entrega"
    const keepsStart = task.start_date !== null || start !== end;
    setError(null);
    const result = await updateTaskDates(task.id, keepsStart ? start : null, end);
    if (!result.ok) {
      arg.revert();
      setError(result.error);
    }
  }

  const openTask = tasks.find((t) => t.id === openTaskId);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex rounded-lg border border-zinc-300 bg-white p-0.5">
          <button
            onClick={() => setOnlyMine(false)}
            className={`rounded-md px-3 py-1 ${!onlyMine ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
          >
            Todas
          </button>
          <button
            onClick={() => setOnlyMine(true)}
            className={`rounded-md px-3 py-1 ${onlyMine ? "bg-zinc-900 text-white" : "text-zinc-600"}`}
          >
            Mis tareas
          </button>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="input w-auto"
          aria-label="Proyecto"
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-zinc-600">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Ocultar finalizadas
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="veek-calendar rounded-xl border border-zinc-200 bg-white p-3 shadow-sm md:p-4">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          firstDay={1}
          height="auto"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,listMonth",
          }}
          buttonText={{ listMonth: "Lista" }}
          events={events}
          editable={editable}
          eventResizableFromStart={editable}
          dayMaxEvents={4}
          eventClick={(info) => setOpenTaskId(info.event.id)}
          eventChange={handleChange}
          noEventsContent="No hay tareas con fecha en este periodo"
        />
      </div>

      {openTask && (
        <TaskDialog
          key={openTask.id}
          task={openTask}
          people={people}
          projectName={projectById.get(openTask.project_id)?.name}
          permissions={permissions}
          onClose={close}
        />
      )}
    </div>
  );
}
