import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { isSuperAdminRole } from '../models/role';
import { approvalBadge, approvalLabel, kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { WorkflowPipelineComponent } from '../shared/workflow-pipeline/workflow-pipeline.component';

/**
 * The testing team leader's decision screen.
 *
 * <p>Everything the testers raised arrives here - tasks and bugs alike, because
 * the leader decides on both. Waiting items come first; approving one puts it
 * on the developer team leader's assignment queue, sending it back returns it
 * to the tester with the comment they must correct against.</p>
 */
@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    Pager,
    WorkflowPipelineComponent
  ],
  templateUrl: './approval-queue.html',
  styleUrl: './approval-queue.css'
})
export class ApprovalQueue implements OnInit {
  isSuperAdmin = isSuperAdminRole(localStorage.getItem('role') || '');
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  /** PENDING, APPROVED, REJECTED or ALL. */
  filter = 'PENDING';
  search = '';

  /** The queue pages in the browser, so the chips still count every item. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /** The item whose reject box is open, and the reason being typed. */
  rejectingId: number | null = null;
  rejectNote = '';
  /** The item with a decision in flight. */
  busyId: number | null = null;

  constructor(
    private workflow: WorkflowService,
    private reference: ReferenceService,
    private dialog: MatDialog
  ) {}

  openTicketDetails(item: WorkItem): void {
    const ref = this.dialog.open(TicketDetailDialog, {
      data: { item },
      width: '92vw',
      maxWidth: '1150px',
      maxHeight: '92vh'
    });
    ref.afterClosed().subscribe(() => {
      this.load();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.workflow.approvals().subscribe({
      next: (rows) => {
        this.items = rows || [];
        // Deciding an item moves it out of the waiting chip, so the page can run
        // short; clamp instead of leaving the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load the review queue right now.';
      }
    });
  }

  get counts(): { all: number; pending: number; approved: number; rejected: number } {
    return {
      all: this.items.length,
      pending: this.count('PENDING'),
      approved: this.count('APPROVED'),
      rejected: this.count('REJECTED')
    };
  }

  private count(state: string): number {
    return this.items.filter((item) => this.stateOf(item) === state).length;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  get filtered(): WorkItem[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter((item) => {
      const matchesFilter = this.filter === 'ALL' || this.stateOf(item) === this.filter;
      if (!matchesFilter) return false;
      if (!q) return true;

      const code = taskCodeOf(item).toLowerCase();
      const title = (item.taskTitle || '').toLowerCase();
      const proj = (item.project || '').toLowerCase();
      const mod = (item.module || '').toLowerCase();
      const reporter = this.reporter(item).toLowerCase();
      const desc = (item.description || '').toLowerCase();

      return code.includes(q) || title.includes(q) || proj.includes(q) || mod.includes(q) || reporter.includes(q) || desc.includes(q);
    });
  }

  get rejectingItem(): WorkItem | null {
    if (this.rejectingId === null) return null;
    return this.items.find(i => i.id === this.rejectingId) || null;
  }

  /** The slice actually rendered for the current page. */
  get pagedItems(): WorkItem[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  setFilter(value: string): void {
    this.filter = value;
    this.pageIndex = 0;
    this.rejectingId = null;
    this.rejectNote = '';
  }

  stateOf(item: WorkItem): string {
    return (item.approvalState || 'PENDING').toUpperCase();
  }

  /* ---------- decisions ---------- */

  approve(item: WorkItem): void {
    if (this.busyId !== null) {
      return;
    }
    this.busyId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.workflow.review(item.id, 'APPROVE', undefined, item.kind).subscribe({
      next: (saved) => {
        this.busyId = null;
        this.successMessage = `${taskCodeOf(saved)} approved! It has been forwarded to the Java Team Leader's assignment queue.`;
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'The decision could not be saved.';
      }
    });
  }

  openReject(item: WorkItem): void {
    this.rejectingId = item.id;
    this.rejectNote = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectNote = '';
  }

  get canReject(): boolean {
    return this.busyId === null && !!this.rejectNote.trim();
  }

  reject(item: WorkItem): void {
    if (!this.canReject) {
      return;
    }
    this.busyId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.workflow.review(item.id, 'REJECT', this.rejectNote.trim(), item.kind).subscribe({
      next: (saved) => {
        this.busyId = null;
        this.rejectingId = null;
        this.rejectNote = '';
        this.successMessage = `${taskCodeOf(saved)} sent back to ${saved.createdByName || 'the tester'} with your comment.`;
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'The decision could not be saved.';
      }
    });
  }

  /* ---------- template helpers ---------- */

  code(item: WorkItem): string {
    return taskCodeOf(item);
  }

  kind(item: WorkItem): string {
    return kindLabel(item.kind);
  }

  kindClass(item: WorkItem): string {
    return kindBadge(item.kind);
  }

  stateLabel(item: WorkItem): string {
    return approvalLabel(this.stateOf(item));
  }

  stateClass(item: WorkItem): string {
    return approvalBadge(this.stateOf(item));
  }

  priorityLabel(value?: string): string {
    return this.reference.label('PRIORITY', value || '') || (value || '—');
  }

  reporter(item: WorkItem): string {
    return item.createdByName || item.createdBy || 'a tester';
  }

  attachmentUrl(name: string): string {
    return 'http://localhost:9001/attachments/' + name;
  }

  openBugDetails(item: WorkItem): void {
    this.openTicketDetails(item);
  }

  isBug(item: WorkItem): boolean {
    return (item.kind || '').toUpperCase() === 'BUG';
  }

  isProdIssue(item: WorkItem): boolean {
    const k = (item.kind || '').toUpperCase();
    return k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || (item.taskCode || '').startsWith('PROD');
  }

  priorityBadge(priority?: string): string {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH': return 'ems-badge--danger';
      case 'MEDIUM': return 'ems-badge--warning';
      case 'LOW': return 'ems-badge--neutral';
      default: return 'ems-badge--neutral';
    }
  }

  initials(name?: string | null): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  toIsoDate(date: any): string {
    if (!date) return '—';
    try {
      return new Date(date).toISOString().slice(0, 10);
    } catch {
      return '—';
    }
  }

  downloadCsv(): void {
    const headers = ['Ticket ID', 'Kind', 'Title', 'Project', 'Module', 'Screen', 'Priority', 'Raised Date', 'Reporter', 'Status'];
    const rows = this.filtered.map(item => [
      this.code(item),
      item.kind || 'TASK',
      item.taskTitle,
      item.project || '—',
      item.module || '—',
      item.screen || '—',
      this.priorityLabel(item.priority),
      this.toIsoDate(item.createdAt || item.startDate),
      this.reporter(item),
      this.stateLabel(item)
    ]);
    this.exportCsvFile('Testing_Review_Tickets', headers, rows);
  }

  exportCsvFile(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };
    const headerLine = headers.map(escapeCell).join(',');
    const rowLines = rows.map(r => r.map(escapeCell).join(','));
    const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `${filename}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
