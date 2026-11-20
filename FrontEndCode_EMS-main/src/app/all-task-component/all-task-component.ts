import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { EditTaskDialog, TaskEditData } from '../edit-task-dialog/edit-task-dialog';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';
import { TaskModel } from '../models/employee';
import { taskCodeOf } from '../models/work-item';
import { roleFamily } from '../models/role';
import { ReferenceService } from '../services/reference.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-all-task-component',
  standalone: true,
  templateUrl: './all-task-component.html',
  styleUrl: './all-task-component.css',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    Pager
  ]
})
export class AllTaskComponent implements OnInit {
  tasks: TaskModel[] = [];
  loading = true;
  errorMessage = '';
  search = '';

  /* The register arrives in one call, so paging happens in the browser and the
     search still spans every task, not just the visible page. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /* The register endpoint returns every task for the people who manage work -
     admins, and testers an admin granted task access. */
  private apiUrl = 'http://localhost:9001/api/assigntasks/register';

  constructor(private http: HttpClient, private dialog: MatDialog,
              private reference: ReferenceService) {}

  ngOnInit(): void {
    this.load();
  }

  /**
   * Only the testing team raises work. The CEO approves and hands it out but
   * files nothing, and a developer leader only reads the register, so the
   * button follows that split.
   */
  get canRaise(): boolean {
    const family = roleFamily(localStorage.getItem('role'));
    return family === 'TESTER';
  }

  get filteredTasks(): TaskModel[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.tasks;
    return this.tasks.filter((task) =>
      [task.taskCode, task.taskTitle, task.project, task.assignedToName, task.module, task.screen, task.priority]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  /** The slice actually rendered for the current page. */
  get pagedTasks(): TaskModel[] {
    return pageSlice(this.filteredTasks, this.pageIndex, this.pageSize);
  }

  /** A new search term always starts again at the first page. */
  onSearchChange(): void {
    this.pageIndex = 0;
  }

  get overdueCount(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.tasks.filter((task) => task.endDate && new Date(task.endDate).getTime() < today).length;
  }

  get highPriorityCount(): number {
    return this.tasks.filter((task) => (task.priority || '').toUpperCase() === 'HIGH').length;
  }

  get projectCount(): number {
    return new Set(this.tasks.map((task) => task.project).filter(Boolean)).size;
  }

  load(): void {
    this.loading = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    this.http.get<TaskModel[]>(this.apiUrl, { headers }).subscribe({
      next: (tasks) => {
        this.tasks = tasks || [];
        // A reload can delete rows, so never leave the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load all tasks', err);
        // A tester whose provision was revoked mid-session lands here: show the
        // backend's own wording instead of a generic failure.
        this.errorMessage = typeof err?.error === 'string'
          ? err.error
          : 'Could not load tasks right now.';
        this.loading = false;
      }
    });
  }

  /** Colour comes from the PRIORITY row, so a new priority still renders. */
  priorityBadge(priority: string): string {
    return this.reference.badge('PRIORITY', priority);
  }

  /** The word shown in the pill; unknown values fall back to what was stored. */
  priorityLabel(priority: string): string {
    return this.reference.label('PRIORITY', priority) || priority || '—';
  }

  isOverdue(task: TaskModel): boolean {
    return !!task.endDate && new Date(task.endDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  /** The one identifier the item carries end to end: TASK-00042 or BUG-00007. */
  code(task: TaskModel): string {
    return taskCodeOf(task);
  }

  isBug(task: TaskModel): boolean {
    return (task.kind || 'TASK').toUpperCase() === 'BUG';
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter((part) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  /** Opens the edit dialog; the register refreshes only when something changed. */
  edit(task: TaskModel): void {
    const data: TaskEditData = { task };
    this.dialog
      // Wider than a single-column dialog: the form is laid out in two columns
      // so the date pair and the module trio each sit on one line.
      .open(EditTaskDialog, { width: '780px', maxWidth: '94vw', data })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.load();
        }
      });
  }

  openBugDetails(task: TaskModel): void {
    this.dialog.open(BugDetailDialog, {
      data: { item: task },
      width: '92vw',
      maxWidth: '1100px',
      maxHeight: '92vh'
    });
  }

  close(task: TaskModel): void {
    const reason = prompt(`Reason for deleting "${task.taskTitle}":`);
    if (!reason) return;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    });

    this.http.post(
      'http://localhost:9001/api/assigntasks/delete',
      { taskId: task.id, reason, deletedBy: localStorage.getItem('email') },
      { headers, responseType: 'text' }
    ).subscribe({
      next: (res) => {
        alert(res);
        this.load();
      },
      error: (err) => {
        console.error('Delete failed', err);
        alert('Failed to delete the task');
      }
    });
  }
}
