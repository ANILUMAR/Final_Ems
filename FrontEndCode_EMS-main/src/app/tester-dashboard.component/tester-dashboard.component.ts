import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { map, switchMap } from 'rxjs';
import { roleLabel as formatRole } from '../models/role';
import { ProjectTasksData, ProjectTasksDialog } from '../project-tasks-dialog/project-tasks-dialog';
import { QuickActions } from '../quick-actions/quick-actions';
import { TeamMemberRow, TaskItem, WorkspaceService } from '../services/workspace.service';
import { TaskStatus } from '../task-status/task-status';

@Component({
  selector: 'app-tester-dashboard.component',
  standalone: true,
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
    QuickActions,
    TaskStatus
  ],
  templateUrl: './tester-dashboard.component.html',
  styleUrl: './tester-dashboard.component.css'
})
export class TesterDashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';

  /**
   * True for QA Lead, Team Leader, or Super Admin viewing the QA testing board.
   * False for an individual QA Engineer / Tester viewing their personal cockpit.
   */
  isAdmin = false;
  selectedEmail = '';
  search = '';

  myTasks: TaskItem[] = [];
  teamTasks: TaskItem[] = [];
  teamRows: TeamMemberRow[] = [];
  today = new Date();

  constructor(
    private router: Router,
    private workspace: WorkspaceService,
    private dialog: MatDialog
  ) {
    this.isAdmin = workspace.seesTeam();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';

    const load$ = this.isAdmin
      ? this.workspace.getTeamMembers().pipe(
        switchMap((people) =>
          this.workspace.assignmentsForRole(people, 'TESTER').pipe(
            map((tasks) => ({ people, tasks }))
          )
        )
      )
      : this.workspace.myAssignments().pipe(map((tasks) => ({ people: [] as any[], tasks })));

    load$.subscribe({
      next: ({ people, tasks }) => {
        if (this.isAdmin) {
          const team = this.workspace.teamWork(tasks, [], people, 'TESTER');
          this.teamTasks = team.tasks;
          this.teamRows = team.rows;
          // By default, display the entire team queue. Clicking any tester filters to that individual.
          this.selectedEmail = '';
        } else {
          this.myTasks = tasks || [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load tester queue:', err);
        this.errorMessage = 'Could not load your verification queue right now.';
        this.loading = false;
      }
    });
  }

  get employeeName(): string {
    return localStorage.getItem('name') || localStorage.getItem('email') || 'there';
  }

  get firstName(): string {
    return (this.employeeName || '').split(' ')[0] || this.employeeName;
  }

  get roleLabel(): string {
    return formatRole(localStorage.getItem('role') || 'TESTER');
  }

  get activeTestersCount(): number {
    return this.teamRows.filter((r) => r.active).length;
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

  selectMember(member: TeamMemberRow): void {
    if (this.selectedEmail === member.email) {
      this.selectedEmail = ''; // toggle off filter to show all team tasks
    } else {
      this.selectedEmail = member.email;
    }
  }

  clearMemberSelection(): void {
    this.selectedEmail = '';
  }

  onSearchChange(): void {
    const rows = this.filteredRows;
    if (rows.length === 1) {
      this.selectedEmail = rows[0].email;
      return;
    }
    if (this.selectedEmail && !rows.some((row) => row.email === this.selectedEmail)) {
      this.selectedEmail = '';
    }
  }

  testerWorkloadLabel(member: TeamMemberRow): string {
    if (!member.active) return 'Inactive';
    if (member.inProgress >= 4) return 'Heavy Load';
    if (member.inProgress >= 2) return 'Optimal';
    if (member.inProgress === 1) return 'Light Load';
    return 'Available';
  }

  testerWorkloadClass(member: TeamMemberRow): string {
    if (!member.active) return 'is-inactive';
    if (member.inProgress >= 4) return 'is-heavy';
    if (member.inProgress >= 2) return 'is-optimal';
    return 'is-available';
  }

  onStatusChanged(task: TaskItem, status: string): void {
    task.status = status;
    this.recountTeamRow(task);
  }

  updateTaskStatus(task: TaskItem, newStatus: string): void {
    const oldStatus = task.status;
    task.status = newStatus;
    this.workspace.updateAssignmentStatus(task.id, newStatus, undefined, task.kind).subscribe({
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
    row.inProgress = owned.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'IN_REVIEW').length;
    row.todo = row.total - row.done - row.inProgress;
    row.progress = row.total ? Math.round((row.done / row.total) * 100) : 0;
  }

  get selectedRow(): TeamMemberRow | null {
    return this.teamRows.find((row) => row.email === this.selectedEmail) || null;
  }

  get selectedName(): string {
    return this.selectedRow?.name || '';
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

  get urgentVerificationItems(): TaskItem[] {
    return this.boardTasks.filter((t) => {
      if (t.status === 'DONE') return false;
      return t.priority === 'High' || t.priority === 'Critical' || t.kind === 'BUG';
    });
  }

  get pending(): number {
    return this.boardTasks.filter((task) => task.status !== 'DONE').length;
  }

  get completed(): number {
    return this.boardTasks.filter((task) => task.status === 'DONE').length;
  }

  get inProgress(): TaskItem[] {
    return this.boardTasks.filter(
      (task) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW'
    );
  }

  get todoTasks(): TaskItem[] {
    return this.boardTasks.filter(
      (task) => task.status !== 'DONE' && task.status !== 'IN_PROGRESS' && task.status !== 'IN_REVIEW'
    );
  }

  get progress(): number {
    return this.boardTasks.length ? Math.round((this.completed / this.boardTasks.length) * 100) : 0;
  }

  get teamTotalQueue(): number {
    return this.teamTasks.length;
  }

  get teamInProgressCount(): number {
    return this.teamTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW').length;
  }

  get teamVerifiedCount(): number {
    return this.teamTasks.filter((t) => t.status === 'DONE').length;
  }

  get projectCount(): number {
    return new Set(
      this.boardTasks
        .map((task) => task.project?.name || '')
        .filter((name) => !!name)
    ).size;
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
      data: { project: project.name, tasks: project.tasks, doneLabel: 'verified' } as ProjectTasksData,
      width: '760px',
      maxWidth: '94vw',
      maxHeight: '86vh',
      autoFocus: false
    });
  }

  get taskListLink(): string {
    return this.isAdmin ? '/tasks' : '/my-tasks';
  }

  goToTasks() {
    this.router.navigate([this.taskListLink]);
  }

  goToRaise() {
    this.router.navigate(['/issues/new']);
  }

  goToApprovals() {
    this.router.navigate(['/approvals']);
  }

  goToAllTasks() {
    this.router.navigate(['/tasks/all']);
  }

  goToProjects() {
    this.router.navigate(['/my-projects']);
  }

  goToTimesheet() {
    this.router.navigate(['/timesheets/new']);
  }
}
