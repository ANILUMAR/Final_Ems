import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { TaskModel } from '../models/employee';
import { taskCodeOf } from '../models/work-item';
import { TaskStatus } from '../task-status/task-status';
import { STATUS_META, statusMeta } from '../task-status/status-history-dialog';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ReferenceService } from '../services/reference.service';
import { RoleGuard } from '../role-guard';
import { roleFamily } from '../models/role';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    RouterModule,
    TaskStatus,
    Pager
  ],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css']
})
export class TaskListComponent implements OnInit {
  tasks: TaskModel[] = [];
  loading = true;
  errorMessage = '';

  search = '';
  priority = 'ALL';
  /** 'ALL' or a STATUS_META value; narrows the board to a single section. */
  statusFilter = 'ALL';

  /** The board pages in the browser: search and chips still span every task. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  private apiUrl = 'http://localhost:9001/api/assigntasks/getAssignTask';

  constructor(private http: HttpClient, private reference: ReferenceService) {}

  ngOnInit(): void {
    this.taskModelResponse();
  }

  /**
   * The board is the cross-team view, so it belongs to the people who run the
   * work: the CEO and both team leaders. The heading and the "New task"
   * shortcut follow the same switch.
   */
  get isManager(): boolean {
    return RoleGuard.managesTasks();
  }

  /**
   * The shortcut to the intake follows the raising side, not the reading side:
   * the testing team files work; the CEO and a developer leader read the board
   * it lands on. Without this the button was shown to roles the guard then
   * refused.
   */
  get canRaise(): boolean {
    const family = roleFamily(localStorage.getItem('role'));
    return family === 'TESTER';
  }

  get filteredTasks(): TaskModel[] {
    const term = this.search.trim().toLowerCase();
    return this.tasks.filter((task) => {
      const matchesPriority = this.priority === 'ALL' || (task.priority || '').toUpperCase() === this.priority;
      const matchesStatus = this.statusFilter === 'ALL' || statusMeta(task.status).value === this.statusFilter;
      const matchesSearch =
        !term ||
        [task.taskCode, task.taskTitle, task.project, task.assignedToName, task.module, task.screen]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesPriority && matchesStatus && matchesSearch;
    });
  }

  /**
   * The board reads as one list per lifecycle state instead of a single pile:
   * every card sits under its status, in lifecycle order, with its own count.
   * The template hides empty states so only work that exists takes up room.
   * Only the current page feeds these sections, so a status that starts on the
   * next page does not show an empty header here.
   */
  get groups(): { value: string; label: string; icon: string; badge: string; tasks: TaskModel[] }[] {
    const visible = this.pagedTasks;
    return STATUS_META.map((meta) => ({
      ...meta,
      tasks: visible.filter((task) => statusMeta(task.status).value === meta.value)
    }));
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

  /**
   * The same chip strip for the lifecycle, so "show me only what is in review"
   * is one click. Counts cover every task, like the priority chips, so a chip
   * never lies about the work that exists behind the current search.
   */
  get statusCounts(): { key: string; label: string; count: number }[] {
    return [
      { key: 'ALL', label: 'All states', count: this.tasks.length },
      ...STATUS_META.map((meta) => ({
        key: meta.value,
        label: meta.label,
        count: this.tasks.filter((task) => statusMeta(task.status).value === meta.value).length
      }))
    ];
  }

  get overdueCount(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.tasks.filter((task) => task.endDate && new Date(task.endDate).getTime() < today).length;
  }

  countByPriority(priority: string): number {
    return this.tasks.filter((task) => (task.priority || '').toUpperCase() === priority).length;
  }

  setPriority(priority: string): void {
    this.priority = priority;
    this.pageIndex = 0;
  }

  setStatusFilter(key: string): void {
    this.statusFilter = key;
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

    // This page is the cross-team board, and /register is exactly that: the
    // whole workspace for the CEO, either team leader, or a tester who has been
    // granted task access. A member never reaches this page and reads their own
    // list, which the backend pins to their account.
    const url = this.isManager
      ? 'http://localhost:9001/api/assigntasks/register'
      : `${this.apiUrl}?email=${email}`;

    this.http.get<TaskModel[]>(url, { headers }).subscribe({
      next: (tasks: TaskModel[]) => {
        this.tasks = tasks || [];
        // A reload can remove rows, so never leave the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to fetch tasks', err);
        this.errorMessage = 'Could not load tasks right now.';
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

  attachmentUrl(filename: string): string {
    return 'http://localhost:9001/attachments/' + filename;
  }

  openFilePopup(filename: string): void {
    window.open(this.attachmentUrl(filename), '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
  }

  onStatusChanged(task: TaskModel, status: string): void {
    task.status = status;
  }

  /** A reopen carries a remark; keep it on the card until the item is done again. */
  onReopened(task: TaskModel, event: { note: string }): void {
    task.reopenCount = (Number(task.reopenCount) || 0) + 1;
    task.lastReopenNote = event.note;
  }
}
