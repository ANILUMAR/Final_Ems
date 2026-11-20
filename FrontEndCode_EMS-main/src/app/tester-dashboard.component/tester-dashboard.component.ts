import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { map, switchMap } from 'rxjs';
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
   * The admin picks a tester from the list and then reads that person's board.
   * A tester opens the same component with only their own data and no picker.
   */
  isAdmin = false;
  selectedEmail = '';
  /** Admin picker filter: a name or email fragment. */
  search = '';
  /** The list is open until a tester is picked, then it collapses to that one. */
  pickerOpen = true;

  myTasks: TaskItem[] = [];
  teamTasks: TaskItem[] = [];
  teamRows: TeamMemberRow[] = [];
  today = new Date();

  constructor(private router: Router, private workspace: WorkspaceService, private dialog: MatDialog) {
    this.isAdmin = workspace.seesTeam();
  }

  ngOnInit(): void {
    // A tester reads their own assignment list. The CEO and a team leader read
    // one list per tester so the picker counters and the queue come from the
    // same records.
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
          this.selectedEmail = this.pickSelection(team.rows);
          this.pickerOpen = !this.selectedEmail;
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

  /** Open on someone who actually has work; otherwise the first account. */
  private pickSelection(rows: TeamMemberRow[]): string {
    const busy = rows.find((row) => row.total > 0);
    return (busy || rows[0])?.email || '';
  }

  /** The admin's picker: switch the whole board to another tester. */
  selectMember(member: TeamMemberRow): void {
    this.selectedEmail = member.email;
    // Collapse the list so only the picked tester stays on screen.
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
   * tester, and if the current pick is filtered out the first match takes over.
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

  /** The tester whose board is on screen (admin picker) or the signed-in one. */
  get selectedRow(): TeamMemberRow | null {
    return this.teamRows.find((row) => row.email === this.selectedEmail) || null;
  }

  get selectedName(): string {
    return this.selectedRow?.name || '';
  }

  /** The list the board is talking about: the picked tester's queue for an admin. */
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

  get pending(): number {
    return this.boardTasks.filter((task) => task.status !== 'DONE').length;
  }

  get completed(): number {
    return this.boardTasks.filter((task) => task.status === 'DONE').length;
  }

  /** In flight covers both the working and the review state. */
  get inProgress(): TaskItem[] {
    return this.boardTasks.filter(
      (task) => task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW'
    );
  }

  get progress(): number {
    return this.boardTasks.length ? Math.round((this.completed / this.boardTasks.length) * 100) : 0;
  }

  /** Distinct projects behind the queue, shown to the admin as a headline number. */
  get projectCount(): number {
    return new Set(
      this.boardTasks
        .map((task) => task.project?.name || '')
        .filter((name) => !!name)
    ).size;
  }

  /**
   * The queue grouped by project, each group keeping its own records so the
   * row can open the detail popup. Same card, same popup as the developer
   * board; "done" reads as "verified" here. 'Unassigned' collects the loose
   * items so nothing on the queue disappears from this list.
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

  /** A project row is a door: it opens every item behind it in full. */
  openProject(project: { name: string; tasks: TaskItem[] }): void {
    this.dialog.open(ProjectTasksDialog, {
      data: { project: project.name, tasks: project.tasks, doneLabel: 'verified' } as ProjectTasksData,
      width: '760px',
      maxWidth: '94vw',
      maxHeight: '86vh',
      autoFocus: false
    });
  }

  /** Where "my queue" points: the admin has no personal queue any more. */
  get taskListLink(): string {
    return this.isAdmin ? '/tasks' : '/my-tasks';
  }

  goToTasks() {
    this.router.navigate([this.taskListLink]);
  }

  /** Every item the team raises starts on this one screen. */
  goToRaise() {
    this.router.navigate(['/issues/new']);
  }

  /** The testing team leader's decision screen. */
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
