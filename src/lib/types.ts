export type OrgRole = "owner" | "admin" | "member" | "guest";
export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Organization {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
}

export interface BoardColumn {
  id: string;
  project_id: string;
  name: string;
  position: number;
}

export interface Task {
  id: string;
  project_id: string;
  column_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  start_date: string | null;
  due_date: string | null;
  position: number;
}

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  member: "Miembro",
  guest: "Invitado",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  done: "Finalizada",
};
