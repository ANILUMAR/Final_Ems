import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskModel } from '../models/employee';
import { taskCodeOf } from '../models/work-item';
import { TaskStatus } from '../task-status/task-status';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';

@Component({
  selector: 'app-employee-my-task',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatDialogModule,
    RouterModule,
    TaskStatus,
    Pager
  ],
  templateUrl: './employee-my-task.html',
  styleUrls: ['./employee-my-task.css']
})
export class EmployeeMyTask implements OnInit {
  tasks: TaskModel[] = [];
  loading = true;
  errorMessage = '';

  search = '';
  priority = 'ALL';

  /** The list pages in the browser: the chips and the search span every task. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  private apiUrl = 'http://localhost:9001/api/assigntasks/getAssignTask';

  constructor(
    private http: HttpClient,
    private reference: ReferenceService,
    private dialog: MatDialog,
    private workflow: WorkflowService
  ) {}

  ngOnInit(): void {
    this.taskModelResponse();
  }

  openBugDetails(task: TaskModel): void {
    this.dialog.open(BugDetailDialog, {
      data: { item: task },
      width: '92vw',
      maxWidth: '1100px',
      maxHeight: '92vh'
    });
  }

  get filteredTasks(): TaskModel[] {
    const term = this.search.trim().toLowerCase();
    return this.tasks.filter((task) => {
      const matchesPriority = this.priority === 'ALL' || (task.priority || '').toUpperCase() === this.priority;
      const matchesSearch =
        !term ||
        [task.taskCode, task.taskTitle, task.project, task.module, task.screen]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesPriority && matchesSearch;
    });
  }

  /** The slice actually rendered for the current page. */
  get pagedTasks(): TaskModel[] {
    return pageSlice(this.filteredTasks, this.pageIndex, this.pageSize);
  }

  /** One chip per PRIORITY row in app_lookup, so a new priority appears here. */
  get priorityCounts(): { key: string; label: string; count: number }[] {
    return [
      { key: 'ALL', label: 'All', count: this.tasks.length },
      ...this.reference.items('PRIORITY').map((item) => ({
        key: item.code.toUpperCase(),
        label: item.label,
        count: this.countByPriority(item.code.toUpperCase())
      }))
    ];
  }

  get dueSoonCount(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    const inSevenDays = today + 7 * 24 * 60 * 60 * 1000;
    return this.tasks.filter((task) => {
      const end = task.endDate ? new Date(task.endDate).getTime() : 0;
      return end >= today && end <= inSevenDays;
    }).length;
  }

  countByPriority(priority: string): number {
    return this.tasks.filter((task) => (task.priority || '').toUpperCase() === priority).length;
  }

  setPriority(priority: string): void {
    this.priority = priority;
    this.pageIndex = 0;
  }

  /** A new search term always starts again at the first page. */
  onSearchChange(): void {
    this.pageIndex = 0;
  }

  taskModelResponse(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('email');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<TaskModel[]>(`${this.apiUrl}?email=${email}`, { headers }).subscribe({
      next: (tasks: TaskModel[]) => {
        this.tasks = tasks || [];
        // A reload can remove rows, so never leave the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to fetch tasks', err);
        this.errorMessage = 'Could not load your tasks right now.';
        this.loading = false;
      }
    });
  }

  /** Card accent: the stored code, lower-cased, so a new priority maps too. */
  priorityClass(priority: string): string {
    const key = (priority || '').trim().toLowerCase();
    return key ? `is-${key}` : '';
  }

  priorityBadge(priority: string): string {
    return this.reference.badge('PRIORITY', priority);
  }

  /** The word on the pill, e.g. "High", taken from the PRIORITY row. */
  priorityLabel(priority: string): string {
    return this.reference.label('PRIORITY', priority) || '—';
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

  isImage(filename: string): boolean {
    const ext = (filename || '').toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif');
  }

  openFilePopup(filename: string): void {
    const url = 'http://localhost:9001/attachments/' + filename;
    window.open(url, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
  }

  onStatusChanged(task: TaskModel, status: string): void {
    task.status = status;
  }

  /** A reopen carries a remark; keep it on the card until the item is done again. */
  onReopened(task: TaskModel, event: { note: string }): void {
    task.reopenCount = (Number(task.reopenCount) || 0) + 1;
    task.lastReopenNote = event.note;
  }

  get isTesterUser(): boolean {
    const role = (localStorage.getItem('role') || '').toUpperCase();
    return role === 'TESTER' || role === 'TESTER_LEAD';
  }

  isTestingAssignment(task: TaskModel): boolean {
    return !!(task.testingStatus || task.assignedTesterName || task.releasedForTesting);
  }

  testingBadge(status?: string | null): string {
    switch ((status || '').toUpperCase()) {
      case 'VERIFIED':
        return 'ems-badge--success';
      case 'FAILED':
        return 'ems-badge--danger';
      case 'IN_TESTING':
      default:
        return 'ems-badge--info';
    }
  }

  testingLabel(status?: string | null): string {
    switch ((status || '').toUpperCase()) {
      case 'VERIFIED':
        return 'Verified & Passed';
      case 'FAILED':
        return 'QA Failed (Reopened)';
      case 'IN_TESTING':
        return 'In QA Testing';
      default:
        return status || 'In QA Testing';
    }
  }

  markAsDone(task: TaskModel): void {
    const input = prompt('Completion / verification remarks (optional):', 'Testing completed successfully. Verified and marked as Done.');
    if (input === null) {
      return; // cancelled
    }
    const note = input ? input.trim() : 'Testing completed and verified.';

    this.workflow.verifyTest(task.id, {
      result: 'PASSED',
      note,
      kind: task.kind
    }).subscribe({
      next: () => {
        alert(`${this.code(task)} completed and marked as Done!`);
        this.taskModelResponse();
      },
      error: (err: any) => {
        console.error('Failed to mark task as done:', err);
        alert(typeof err?.error === 'string' ? err.error : 'Failed to update task status.');
      }
    });
  }

  verifyFix(task: TaskModel, outcome: 'PASSED' | 'FAILED'): void {
    let note = '';
    if (outcome === 'FAILED') {
      const input = prompt('Please explain the defect observed during verification:');
      if (!input || !input.trim()) {
        return;
      }
      note = input.trim();
    } else {
      const input = prompt('Verification remarks (optional):', 'Verified fix working as expected.');
      note = input ? input.trim() : '';
    }

    this.workflow.verifyTest(task.id, {
      result: outcome,
      note,
      kind: task.kind
    }).subscribe({
      next: () => {
        alert(outcome === 'PASSED' ? `${this.code(task)} verified and passed successfully!` : `${this.code(task)} reopened and returned to development team.`);
        this.taskModelResponse();
      },
      error: (err: any) => {
        console.error('Failed to submit verification:', err);
        alert(typeof err?.error === 'string' ? err.error : 'Failed to update test verification.');
      }
    });
  }

  deleteAttachment(id: number): void {
    const token = localStorage.getItem('token');
    const deletedBy = localStorage.getItem('email');

    const reason = prompt('Please enter a reason for deleting this task:');
    if (!reason) return;

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    this.http.post(
      'http://localhost:9001/api/assigntasks/delete',
      { taskId: id, reason, deletedBy },
      { headers, responseType: 'text' }
    ).subscribe({
      next: (res) => {
        alert(res);
        this.taskModelResponse();
      },
      error: (err) => {
        console.error('Delete failed:', err);
        alert('Failed to delete the task');
      }
    });
  }
}
