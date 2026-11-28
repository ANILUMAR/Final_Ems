import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
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
    MatTooltipModule,
    QuickActions
  ]
})
export class EmployeeDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';

  isAdmin = false;
  selectedEmail = '';
  search = '';
  pickerOpen = false;

  myTasks: TaskItem[] = [];
  myTimesheets: TimesheetItem[] = [];
  allTimesheets: TimesheetItem[] = [];
  teamTasks: TaskItem[] = [];
  teamRows: TeamMemberRow[] = [];
  today = new Date();

  constructor(
    private router: Router,
    private workspace: WorkspaceService,
    private dialog: MatDialog,
    private http: HttpClient
  ) {
    this.isAdmin = workspace.seesTeam();
  }

  ngOnInit(): void {
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

  private pickSelection(rows: TeamMemberRow[]): string {
    const busy = rows.find((row) => row.total > 0);
    return (busy || rows[0])?.email || '';
  }

  selectMember(member: TeamMemberRow): void {
    this.selectedEmail = member.email;
  }

  get filteredRows(): TeamMemberRow[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.teamRows;
    }
    return this.teamRows.filter(
      (row) => row.name.toLowerCase().includes(term) || row.email.includes(term)
    );
  }

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
    return localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  }

  get firstName(): string {
    return (this.employeeName || '').split(' ')[0] || this.employeeName;
  }

  get roleLabel(): string {
    return formatRole(localStorage.getItem('role') || 'EMPLOYEE');
  }

  get selectedRow(): TeamMemberRow | null {
    return this.teamRows.find((row) => row.email === this.selectedEmail) || null;
  }

  get selectedName(): string {
    return this.selectedRow?.name || '';
  }

  get selectedHours(): number {
    return this.selectedRow?.hours || 0;
  }

  get teamTotalHours(): number {
    return this.teamRows.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  }

  get teamInProgressCount(): number {
    return this.teamTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
  }

  get readyForQAReleaseCount(): number {
    return this.teamTasks.filter((t) => t.status === 'DONE' || t.status === 'COMPLETED').length;
  }

  devWorkloadLabel(member: TeamMemberRow): string {
    if (!member.active) return 'Inactive';
    if (member.inProgress >= 4) return 'Heavy Load';
    if (member.inProgress >= 2) return 'Optimal';
    if (member.inProgress === 1) return 'Light Load';
    return 'Available';
  }

  devWorkloadClass(member: TeamMemberRow): string {
    if (!member.active) return 'is-inactive';
    if (member.inProgress >= 4) return 'is-heavy';
    if (member.inProgress >= 2) return 'is-optimal';
    return 'is-available';
  }

  get boardTasks(): TaskItem[] {
    if (!this.isAdmin) {
      return this.myTasks;
    }
    if (!this.selectedEmail) {
      return this.teamTasks;
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

  get myBlockedOrHighPriorityTasks(): TaskItem[] {
    return this.myTasks.filter((t) => {
      if (t.status === 'DONE') return false;
      return t.priority === 'High' || t.priority === 'Critical' || t.status === 'ON_HOLD';
    });
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

  get todayTargetPercent(): number {
    return Math.min(100, Math.round((this.hoursLoggedToday / 8) * 100));
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

  openProject(project: { name: string; tasks: TaskItem[] }): void {
    this.dialog.open(ProjectTasksDialog, {
      data: { project: project.name, tasks: project.tasks } as ProjectTasksData,
      width: '760px',
      maxWidth: '94vw',
      maxHeight: '86vh',
      autoFocus: false
    });
  }

  updateTaskStatus(task: TaskItem, newStatus: string): void {
    const oldStatus = task.status;
    task.status = newStatus;
    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);
    this.http.put(`http://localhost:9001/api/tasks/${task.id}`, { ...task, status: newStatus }, { headers }).subscribe({
      next: () => {
        if (this.isAdmin) {
          this.recountTeamRow(task);
        }
      },
      error: (err) => {
        console.error('Failed to update task status:', err);
        task.status = oldStatus;
      }
    });
  }

  goToTasks() {
    this.router.navigate([this.isAdmin ? '/tasks' : '/my-tasks']);
  }

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
