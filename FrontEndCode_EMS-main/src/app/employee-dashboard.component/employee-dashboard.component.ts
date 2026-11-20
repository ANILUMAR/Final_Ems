import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { forkJoin, map, switchMap } from 'rxjs';
import {
  TeamMemberRow,
  TimesheetItem,
  TaskItem,
  WorkspaceService
} from '../services/workspace.service';
import { roleLabel as formatRole } from '../models/role';
import { ProjectTasksData, ProjectTasksDialog } from '../project-tasks-dialog/project-tasks-dialog';
import { QuickActions } from '../quick-actions/quick-actions';
import { TaskStatus } from '../task-status/task-status';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  templateUrl: './employee-dashboard.component.html',
  styleUrls: ['./employee-dashboard.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    QuickActions,
    TaskStatus
  ]
})
export class EmployeeDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';

  /**
   * The CEO or a team leader picks a developer from the list and then reads that
   * person's board. A developer opens the same component with only their own data
   * and no picker.
   */
  isAdmin = false;
  selectedEmail = '';
  /** Admin picker filter: a name or email fragment. */
  search = '';
  /** The list is open until a developer is picked, then it collapses to that one. */
  pickerOpen = true;

  myTasks: TaskItem[] = [];
  myTimesheets: TimesheetItem[] = [];
  allTimesheets: TimesheetItem[] = [];
  teamTasks: TaskItem[] = [];
  teamRows: TeamMemberRow[] = [];
  today = new Date();

  constructor(private router: Router, private workspace: WorkspaceService, private dialog: MatDialog) {
    this.isAdmin = workspace.seesTeam();
  }

  ngOnInit(): void {
    // A developer reads their own assignment list, so the board and My Tasks
    // agree. The CEO and a team leader read one list per developer to drive both
    // the picker counters and the detail panel from the same records.
    const load$ = this.isAdmin
      ? forkJoin({ people: this.workspace.getTeamMembers(), timesheets: this.workspace.getTimesheets() }).pipe(
          switchMap(({ people, timesheets }) =>
            this.workspace.assignmentsForRole(people, 'EMPLOYEE').pipe(
              map((tasks) => ({ people, timesheets, tasks }))
            )
          )
        )
      : forkJoin({ timesheets: this.workspace.getTimesheets(), tasks: this.workspace.myAssignments() }).pipe(
          map(({ timesheets, tasks }) => ({ people: [] as any[], timesheets, tasks }))
        );

    load$.subscribe({
      next: ({ people, timesheets, tasks }) => {
        this.allTimesheets = timesheets || [];

        if (this.isAdmin) {
          const team = this.workspace.teamWork(tasks, timesheets, people, 'EMPLOYEE');
          this.teamTasks = team.tasks;
          this.teamRows = team.rows;
          this.selectedEmail = this.pickSelection(team.rows);
          this.pickerOpen = !this.selectedEmail;
        } else {
          this.myTasks = tasks || [];
          this.myTimesheets = this.workspace.myTimesheets(timesheets || []);
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load developer workspace:', err);
        this.errorMessage = 'Could not load your workspace right now.';
        this.loading = false;
      }
    });
  }

  /** Open on someone who actually has work; otherwise the first account. */
  private pickSelection(rows: TeamMemberRow[]): string {
    const busy = rows.find((row) => row.total > 0);
    return (busy || rows[0])?.email || '';
  }

  /** The admin's picker: switch the whole board to another developer. */
  selectMember(member: TeamMemberRow): void {
    this.selectedEmail = member.email;
    // Collapse the list so only the picked developer stays on screen.
    this.pickerOpen = false;
  }

  /** Re-open the list to choose someone else, starting from the full team. */
  openPicker(): void {
    this.search = '';
    this.pickerOpen = true;
  }

  /** Picker rows, narrowed by the search box. */
  get filteredRows(): TeamMemberRow[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.teamRows;
    }
    return this.teamRows.filter(
      (row) => row.name.toLowerCase().includes(term) || row.email.includes(term)
    );
  }

  /**
   * Keeps the detail panel in step with the search: one match opens that
   * developer, and if the current pick is filtered out the first match takes over.
   */
  onSearchChange(): void {
    const rows = this.filteredRows;
    if (rows.length === 1) {
      this.selectedEmail = rows[0].email;
      return;
    }
    if (!rows.some((row) => row.email === this.selectedEmail)) {
      this.selectedEmail = rows[0]?.email || '';
    }
  }

  onStatusChanged(task: TaskItem, status: string): void {
    task.status = status;
    this.recountTeamRow(task);
  }

  /** Keeps the picker's per-person numbers in step with a status change. */
  private recountTeamRow(task: TaskItem): void {
    const email = (task.user?.email || '').trim().toLowerCase();
    const row = this.teamRows.find((candidate) => candidate.email === email);
    if (!row) {
      return;
    }
    const owned = this.teamTasks.filter(
      (item) => (item.user?.email || '').trim().toLowerCase() === email
    );
    row.total = owned.length;
    row.done = owned.filter((item) => item.status === 'DONE').length;
    row.inProgress = owned.filter((item) => item.status === 'IN_PROGRESS').length;
    row.todo = row.total - row.done - row.inProgress;
    row.progress = row.total ? Math.round((row.done / row.total) * 100) : 0;
  }

  get employeeName(): string {
    return localStorage.getItem('name') || localStorage.getItem('email') || 'there';
  }

  get firstName(): string {
    return (this.employeeName || '').split(' ')[0] || this.employeeName;
  }

  get roleLabel(): string {
    // EMPLOYEE reads as "Developer" in the board subtitle.
    return formatRole(localStorage.getItem('role') || 'EMPLOYEE');
  }

  /** The developer whose board is on screen (admin picker) or the signed-in one. */
  get selectedRow(): TeamMemberRow | null {
    return this.teamRows.find((row) => row.email === this.selectedEmail) || null;
  }

  get selectedName(): string {
    return this.selectedRow?.name || '';
  }

  get selectedHours(): number {
    return this.selectedRow?.hours || 0;
  }

  /** The list the board is talking about: the picked developer's work for an admin. */
  get boardTasks(): TaskItem[] {
    if (!this.isAdmin) {
      return this.myTasks;
    }
    if (!this.selectedEmail) {
      return [];
    }
    return this.teamTasks.filter(
      (task) => (task.user?.email || '').trim().toLowerCase() === this.selectedEmail
    );
  }

  get assignedTasks(): number {
    return this.boardTasks.length;
  }

  get completedTasks(): number {
    return this.boardTasks.filter((task) => task.status === 'DONE').length;
  }

  get openTasks(): number {
    return this.boardTasks.filter((task) => task.status !== 'DONE').length;
  }

  /** In flight covers both the working and the review state. */
  get inProgressTasks(): TaskItem[] {
    return this.boardTasks.filter(
      (task) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW'
    );
  }

  get todoTasks(): TaskItem[] {
    return this.boardTasks.filter(
      (task) => task.status !== 'DONE' && task.status !== 'IN_PROGRESS' && task.status !== 'IN_REVIEW'
    );
  }

  get completionRate(): number {
    return this.assignedTasks ? Math.round((this.completedTasks / this.assignedTasks) * 100) : 0;
  }

  get hoursLoggedToday(): number {
    const stamp = this.today.toISOString().slice(0, 10);
    return this.myTimesheets
      .filter((entry) => entry.date === stamp)
      .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  }

  get hoursLoggedTotal(): number {
    return this.myTimesheets.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  }

  get timesheetStatus(): string {
    if (!this.myTimesheets.length) {
      return 'NOT SUBMITTED';
    }
    return this.myTimesheets
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]
      .status || 'LOGGED';
  }

  /** Timesheets store the owner as text, so the picked developer is matched by name too. */
  private get selectedTimesheets(): TimesheetItem[] {
    const row = this.selectedRow;
    if (!row) {
      return [];
    }
    const name = (row.name || '').trim().toLowerCase();
    return this.allTimesheets.filter((entry) => {
      const owner = (entry.employeeName || '').trim().toLowerCase();
      return !!owner && (owner === row.email || owner === name);
    });
  }

  /**
   * Every task on this board, grouped by its project. The popup reads the rows
   * themselves, so each group keeps the records it was counted from.
   */
  get projectRows(): { name: string; taskCount: number; doneCount: number; tasks: TaskItem[] }[] {
    const map = new Map<string, { name: string; taskCount: number; doneCount: number; tasks: TaskItem[] }>();
    this.boardTasks.forEach((task) => {
      const name = task.project?.name || 'Unassigned';
      const row = map.get(name) || { name, taskCount: 0, doneCount: 0, tasks: [] };
      row.taskCount += 1;
      row.tasks.push(task);
      if (task.status === 'DONE') {
        row.doneCount += 1;
      }
      map.set(name, row);
    });
    return Array.from(map.values());
  }

  /**
   * A project row opens what the card has no room for: each task's description,
   * who raised it and where it sits in the product, in the same read-only shape
   * the board already shows.
   */
  openProject(project: { name: string; tasks: TaskItem[] }): void {
    this.dialog.open(ProjectTasksDialog, {
      data: { project: project.name, tasks: project.tasks } as ProjectTasksData,
      width: '760px',
      maxWidth: '94vw',
      maxHeight: '86vh',
      autoFocus: false
    });
  }

  get recentActivity(): TimesheetItem[] {
    const entries = this.isAdmin ? this.selectedTimesheets : this.myTimesheets;
    return entries
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 4);
  }

  goToTasks() {
    this.router.navigate([this.isAdmin ? '/tasks' : '/my-tasks']);
  }

/** Approved work waiting for a developer to take it. */
goToTriage() {
    this.router.navigate(['/triage']);
  }

  goToAllTasks() {
    this.router.navigate(['/tasks/all']);
  }

  goToSubmission() {
    this.router.navigate(['/timesheets/new']);
  }

  goToMyProject() {
    this.router.navigate(['/my-projects']);
  }

  goToUpdateProfile() {
    this.router.navigate(['/profile']);
  }
}
