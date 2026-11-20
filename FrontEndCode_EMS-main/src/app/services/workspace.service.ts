import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable, of } from 'rxjs';
import { isLeadRole, isSuperAdminRole, roleFamily } from '../models/role';

export interface TaskItem {
  id: number;
  /** "TASK-00042" / "BUG-00007": the one identifier the item carries end to end. */
  taskCode?: string;
  kind?: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | string;
  project?: { id: number; name: string } | null;
  user?: any;
  /** Which collection the row came from; the status pill PATCHes that endpoint. */
  source?: 'task' | 'assignment';
  /** Rework trail stamped by the backend when the item leaves Done. */
  reopenCount?: number | null;
  lastReopenNote?: string | null;
  /** Who raised the item and when - the intake trail, read by the detail popup. */
  raisedBy?: string;
  raisedAt?: string | Date;
  /** The team leader who handed the work out; the only author legacy rows have. */
  assignedBy?: string;
  /**
   * True when the reporter typed a description. The boards print the module
   * chain in that slot when nobody did, so the popup needs to know the
   * difference before it calls the text a description.
   */
  hasOwnDescription?: boolean;
  /** The rest of the intake fields, shown in detail when a project is opened. */
  priority?: string;
  module?: string;
  subModule?: string;
  screen?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  attachmentPath?: string | null;
  testingStatus?: string | null;
  assignedTesterName?: string | null;
  testingInstructions?: string | null;
  releasedForTesting?: boolean | null;
}

/** An assignment record as `/api/assigntasks/getAssignTask` returns it. */
export interface AssignmentRow {
  id: number;
  taskCode?: string | null;
  kind?: string | null;
  taskTitle: string;
  project: string;
  description?: string;
  priority?: string;
  module?: string;
  subModule?: string;
  screen?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  status?: string | null;
  assignedToName?: string | null;
  assignedBy?: string | null;
  attachmentPath?: string | null;
  reopenCount?: number | null;
  lastReopenNote?: string | null;
  /** The intake trail: who raised the item and what the reviewer decided. */
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string | Date | null;
  approvalState?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | Date | null;
  // Testing assignment fields
  assignedTesterId?: number | null;
  assignedTesterName?: string | null;
  assignedTesterEmail?: string | null;
  assignedTesterAt?: string | Date | null;
  testingInstructions?: string | null;
  testingStatus?: string | null;
  releasedForTesting?: boolean | null;
  releasedByName?: string | null;
  releasedBy?: string | null;
  releasedAt?: string | Date | null;
  releaseNote?: string | null;
  verifiedAt?: string | Date | null;
  verifiedBy?: string | null;
  verificationNote?: string | null;
}

export interface TimesheetItem {
  id: number;
  employeeName: string;
  date: string;
  hours: number;
  project: string;
  status: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  user?: any;
}

export interface StatusHistoryItem {
  id: number;
  entityType: 'TASK' | 'ASSIGNMENT' | string;
  entityId: number;
  entityTitle?: string;
  fromStatus: string;
  toStatus: string;
  actorEmail?: string;
  actorName?: string;
  note?: string;
  changedAt: string;
}

export interface WorkspaceSnapshot {
  teamSize: number;
  tasks: TaskItem[];
  projects: ProjectItem[];
  timesheets: TimesheetItem[];
}

/** One person's workload, shown to the admin on the developer/tester boards. */
export interface TeamMemberRow {
  name: string;
  email: string;
  active: boolean;
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  progress: number;
  hours: number;
}

export interface BulkOnboardRow {
  name: string;
  email: string;
  password: string;
  role?: string;
  phoneNumber?: string;
  address?: string;
}

export interface BulkOnboardResult {
  createdCount: number;
  skippedCount: number;
  created: { id: number; name: string; email: string; role: string }[];
  skipped: { email: string; reason: string }[];
}

/**
 * Single read-only gateway for the screens that need live workspace numbers,
 * so every dashboard reads the same endpoints with the same auth header.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private base = 'http://localhost:9001/api';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
  }

  getTeamSize(): Observable<number> {
    return this.http.get<number>(`${this.base}/auth/totalEmployees`, { headers: this.headers() });
  }

  getEmployees(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/auth/registredEmployees`, { headers: this.headers() });
  }

  /**
   * The safe roster a team board needs: name, email, role, active. The full
   * account entity (with its password fields) stays behind the CEO-only
   * `/auth/registredEmployees`, so a team leader reads this one instead.
   */
  getTeamMembers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/auth/team-members`, { headers: this.headers() });
  }

  /** Onboards a whole batch of people in one request (admin only). */
  bulkRegister(users: BulkOnboardRow[]): Observable<BulkOnboardResult> {
    return this.http.post<BulkOnboardResult>(`${this.base}/auth/bulk-register`, { users }, { headers: this.headers() });
  }

  getTasks(): Observable<TaskItem[]> {
    return this.http.get<TaskItem[]>(`${this.base}/tasks`, { headers: this.headers() });
  }

  /**
   * The work an admin actually hands out. A non-admin caller is pinned to their
   * own email by the backend; an admin may pass one to read a teammate's list.
   */
  getAssignments(email?: string): Observable<AssignmentRow[]> {
    let params = new HttpParams();
    if (email) {
      params = params.set('email', email);
    }
    return this.http.get<AssignmentRow[]>(`${this.base}/assigntasks/getAssignTask`, {
      headers: this.headers(),
      params
    });
  }

  /** The signed-in developer's/tester's own assignments, shaped like board rows. */
  myAssignments(): Observable<TaskItem[]> {
    return this.getAssignments().pipe(map((rows) => this.boardRows(rows)));
  }

  /** Admin: the same board rows for one teammate. */
  assignmentsFor(person: any): Observable<TaskItem[]> {
    return this.getAssignments((person?.email || '').trim()).pipe(
      map((rows) => this.boardRows(rows, person))
    );
  }

  /** Admin: every teammate in a role, flattened into one list for `teamWork`. */
  assignmentsForRole(people: any[], role: string): Observable<TaskItem[]> {
    const wanted = roleFamily(role) || (role || '').trim().toUpperCase();
    const team = (people || []).filter(
      (person) => roleFamily(person?.role) === wanted
    );
    if (!team.length) {
      return of([] as TaskItem[]);
    }
    return forkJoin(team.map((person) => this.assignmentsFor(person))).pipe(
      map((lists) => lists.reduce((all, list) => all.concat(list), [] as TaskItem[]))
    );
  }

  /**
   * Assignments store the project as text and hide the assignee object, so each
   * row is mapped onto the board's Task shape with the owner filled in.
   */
  private boardRows(rows: AssignmentRow[], owner?: any): TaskItem[] {
    const email = (owner?.email || localStorage.getItem('email') || '').trim().toLowerCase();
    const name = owner?.name || localStorage.getItem('name') || email;
    const role = owner?.role || localStorage.getItem('role') || '';
    return (rows || []).map((row) => ({
      id: row.id,
      taskCode: row.taskCode || '',
      kind: row.kind || 'TASK',
      title: row.taskTitle || 'Untitled task',
      description: row.description || [row.module, row.screen].filter(Boolean).join(' · '),
      status: (row.status || 'TODO').toString().toUpperCase(),
      project: row.project ? { id: 0, name: row.project } : null,
      user: { email, name, role },
      source: 'assignment' as const,
      reopenCount: row.reopenCount || 0,
      lastReopenNote: row.lastReopenNote || '',
      // The intake trail travels with the row so the project popup can say who
      // raised the work and what it asks for, without a second request.
      raisedBy: (row.createdByName || row.createdBy || '').trim(),
      raisedAt: row.createdAt || '',
      assignedBy: (row.assignedBy || '').trim(),
      hasOwnDescription: !!row.description,
      priority: row.priority || '',
      module: row.module || '',
      subModule: row.subModule || '',
      screen: row.screen || '',
      startDate: row.startDate || '',
      endDate: row.endDate || '',
      attachmentPath: row.attachmentPath || null,
      testingStatus: row.testingStatus || null,
      assignedTesterName: row.assignedTesterName || null,
      testingInstructions: row.testingInstructions || null,
      releasedForTesting: row.releasedForTesting || null
    }));
  }

  getProjects(): Observable<ProjectItem[]> {
    return this.http.get<ProjectItem[]>(`${this.base}/projects`, { headers: this.headers() });
  }

  /** Admin-only: the backend also mirrors the row into the project pickers. */
  createProject(payload: { name: string; description?: string }): Observable<ProjectItem> {
    return this.http.post<ProjectItem>(`${this.base}/projects`, payload, { headers: this.headers() });
  }

  getTimesheets(): Observable<TimesheetItem[]> {
    return this.http.get<TimesheetItem[]>(`${this.base}/timesheets`, { headers: this.headers() });
  }

  /**
   * Moves an assignment (the cards on /tasks and /my-tasks) to a new status.
   * The backend rejects it unless the caller owns the work or is an admin.
   */
  updateAssignmentStatus(id: number, status: string, note?: string): Observable<any> {
    return this.http.patch(`${this.base}/assigntasks/${id}/status`, { status, note }, { headers: this.headers() });
  }

  /** Same lifecycle for the Task model that drives project progress. */
  updateTaskStatus(id: number, status: string, note?: string): Observable<TaskItem> {
    return this.http.patch<TaskItem>(`${this.base}/tasks/${id}/status`, { status, note }, { headers: this.headers() });
  }

  getStatusHistory(entity: 'task' | 'assignment', id: number): Observable<StatusHistoryItem[]> {
    const path = entity === 'task' ? 'tasks' : 'assigntasks';
    return this.http.get<StatusHistoryItem[]>(`${this.base}/${path}/${id}/history`, { headers: this.headers() });
  }

  snapshot(): Observable<WorkspaceSnapshot> {
    return forkJoin({
      teamSize: this.getTeamSize(),
      tasks: this.getTasks(),
      projects: this.getProjects(),
      timesheets: this.getTimesheets()
    });
  }

  /** Email of the signed-in user, lowercased for safe comparison. */
  currentEmail(): string {
    return (localStorage.getItem('email') || '').toLowerCase();
  }

  belongsToMe(task: TaskItem): boolean {
    const email = this.currentEmail();
    return !!email && (task.user?.email || '').toLowerCase() === email;
  }

  myTasks(tasks: TaskItem[]): TaskItem[] {
    return tasks.filter((task) => this.belongsToMe(task));
  }

  myTimesheets(timesheets: TimesheetItem[]): TimesheetItem[] {
    const email = this.currentEmail();
    const name = (localStorage.getItem('name') || '').toLowerCase();
    return timesheets.filter((entry) => {
      const owner = (entry.employeeName || '').toLowerCase();
      return owner === email || (!!name && owner === name);
    });
  }

  /** True for the CEO, who reads every board and every account. */
  isAdmin(): boolean {
    return isSuperAdminRole(localStorage.getItem('role'));
  }

  /**
   * True for the people who run a team: the CEO and both team leaders. They open
   * a board with the team picker and somebody else's queue in it. A plain
   * developer or tester - even one holding the task-access provision - opens
   * their own queue, because leading the team and being handed one task are
   * different rights.
   */
  seesTeam(): boolean {
    const role = localStorage.getItem('role');
    return isSuperAdminRole(role) || isLeadRole(role);
  }

  /**
   * Team view of one board: the tasks owned by people in the same family
   * (`EMPLOYEE` covers developers and their leader, `TESTER` the testers and
   * theirs), plus a workload row per person. Timesheets store the person as free
   * text, so hours are matched by name or email.
   */
  teamWork(
    tasks: TaskItem[],
    timesheets: TimesheetItem[],
    people: any[],
    role: string
  ): { tasks: TaskItem[]; rows: TeamMemberRow[] } {
    const wanted = roleFamily(role) || (role || '').toUpperCase();
    const team = (people || []).filter((person) => roleFamily(person.role) === wanted);

    const rows: TeamMemberRow[] = team.map((person) => ({
      name: person.name || person.email || 'Unnamed',
      email: (person.email || '').trim().toLowerCase(),
      active: person.active !== false,
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      progress: 0,
      hours: 0
    }));
    const byEmail = new Map(rows.map((row) => [row.email, row]));

    const teamTasks = (tasks || []).filter((task) =>
      byEmail.has((task.user?.email || '').trim().toLowerCase())
    );

    teamTasks.forEach((task) => {
      const row = byEmail.get((task.user?.email || '').trim().toLowerCase());
      if (!row) {
        return;
      }
      row.total += 1;
      if (task.status === 'DONE') {
        row.done += 1;
      } else if (task.status === 'IN_PROGRESS') {
        row.inProgress += 1;
      } else {
        row.todo += 1;
      }
    });

    (timesheets || []).forEach((entry) => {
      const owner = (entry.employeeName || '').trim().toLowerCase();
      if (!owner) {
        return;
      }
      rows.forEach((row) => {
        if (owner === row.email || owner === row.name.toLowerCase()) {
          row.hours += Number(entry.hours) || 0;
        }
      });
    });

    rows.forEach((row) => {
      row.progress = row.total ? Math.round((row.done / row.total) * 100) : 0;
    });

    return { tasks: teamTasks, rows };
  }
}
