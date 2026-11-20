import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { codeFor } from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

interface DeletedTaskRecord {
  id?: number;
  taskId?: number;
  /** "TASK-00042" / "BUG-00007"; absent on rows audited before it was kept. */
  taskCode?: string;
  kind?: string;
  taskName?: string;
  reason?: string;
  deletedBy?: string;
  /** LocalDateTime: an ISO string, but older drivers may send [y, m, d, …]. */
  deletedDate?: any;
}

/**
 * Where removed work goes. Every deletion on the register is audited as a
 * `deleted_task` row naming the task, the reason and who did it, so an
 * administrator can answer "what disappeared, and why" without digging through
 * logs. Read-only by design: the list is evidence, not a recycle bin.
 */
@Component({
  selector: 'app-deleted-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    Pager
  ],
  templateUrl: './deleted-tasks.html',
  styleUrl: './deleted-tasks.css'
})
export class DeletedTasks implements OnInit {
  records: DeletedTaskRecord[] = [];
  loading = true;
  errorMessage = '';
  search = '';

  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  private apiUrl = 'http://localhost:9001/api/assigntasks/deleted';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  get filteredRecords(): DeletedTaskRecord[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.records;
    }
    return this.records.filter((record) =>
      [record.taskName, record.reason, record.deletedBy, record.taskId, this.code(record)]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  get pagedRecords(): DeletedTaskRecord[] {
    return pageSlice(this.filteredRecords, this.pageIndex, this.pageSize);
  }

  get removedThisWeek(): number {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    since.setHours(0, 0, 0, 0);
    return this.records.filter((record) => {
      const date = this.dateOf(record);
      return !!date && date.getTime() >= since.getTime();
    }).length;
  }

  get peopleCount(): number {
    return new Set(this.records.map((record) => (record.deletedBy || '').toLowerCase()).filter(Boolean)).size;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    this.http.get<DeletedTaskRecord[]>(this.apiUrl, { headers }).subscribe({
      next: (data) => {
        this.records = data || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredRecords.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load deleted tasks', err);
        this.errorMessage = err?.status === 403
          ? 'Only an administrator can open the deleted tasks list.'
          : 'Could not load deleted tasks right now.';
        this.loading = false;
      }
    });
  }

  /** Normalises both the ISO string and the array form Jackson can emit. */
  private dateOf(record: DeletedTaskRecord): Date | null {
    const value = record.deletedDate;
    if (!value) {
      return null;
    }
    const parsed = Array.isArray(value)
      ? new Date(value[0], (value[1] || 1) - 1, value[2] || 1, value[3] || 0, value[4] || 0, value[5] || 0)
      : new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  removedOn(record: DeletedTaskRecord): string {
    const date = this.dateOf(record);
    if (!date) {
      return '—';
    }
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** "3 days ago" reads faster than a date when scanning the list. */
  removedAgo(record: DeletedTaskRecord): string {
    const date = this.dateOf(record);
    if (!date) {
      return '';
    }
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
  }

  /**
   * The code the item was known by when it was removed. Rows audited before the
   * code was archived with them have only the id, and carry the shared prefix
   * every item had back then.
   */
  code(record: DeletedTaskRecord): string {
    if (record.taskCode) {
      return record.taskCode;
    }
    if (record.kind) {
      return codeFor(record.kind, record.taskId);
    }
    if (record.taskId === null || record.taskId === undefined) {
      return '—';
    }
    return 'EMS-' + String(record.taskId).padStart(5, '0');
  }

  initials(name: string): string {
    return (name || '?')
      .split(/[\s@._-]+/)
      .filter((part) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}
