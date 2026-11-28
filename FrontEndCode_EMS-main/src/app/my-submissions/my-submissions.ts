import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { approvalBadge, approvalLabel, kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';

/**
 * The tester's own trail: everything they raised, in whichever state it is in.
 *
 * <p>This is where a rejection lands. The team leader's comment is shown on the
 * card and the item can be corrected and sent again from here - the task code
 * stays the same across the round trip, so the corrected report and the refused
 * one are the same item, not a new one.</p>
 */
@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    Pager
  ],
  templateUrl: './my-submissions.html',
  styleUrl: './my-submissions.css'
})
export class MySubmissions implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  /** ALL, PENDING, APPROVED or REJECTED. */
  filter = 'ALL';
  search = '';

  /** The trail pages in the browser, so the chips still count every item. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /** The item being corrected; null when no editor is open. */
  editing: WorkItem | null = null;
  editTitle = '';
  editPriority = '';
  editDescription = '';
  saving = false;

  constructor(
    private workflow: WorkflowService,
    private reference: ReferenceService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.workflow.mySubmissions().subscribe({
      next: (rows) => {
        this.items = rows || [];
        // A decision can move an item out of the chosen chip, so the page may no
        // longer exist; clamp instead of leaving the pager past the end.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load your submissions right now.';
      }
    });
  }

  get priorities() {
    return this.reference.items('PRIORITY');
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
      const desc = (item.description || '').toLowerCase();

      return code.includes(q) || title.includes(q) || proj.includes(q) || mod.includes(q) || desc.includes(q);
    });
  }

  /** The slice actually rendered for the current page. */
  get pagedItems(): WorkItem[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  stateOf(item: WorkItem): string {
    return (item.approvalState || 'PENDING').toUpperCase();
  }

  /** True once the developer team leader has handed the work out. */
  isAssigned(item: WorkItem): boolean {
    return !!item.assignedToName;
  }

  setFilter(value: string): void {
    this.filter = value;
    this.pageIndex = 0;
  }

  /* ---------- correction ---------- */

  startCorrection(item: WorkItem): void {
    this.editing = item;
    this.editTitle = item.taskTitle || '';
    this.editPriority = (item.priority || '').toUpperCase();
    this.editDescription = item.description || '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCorrection(): void {
    this.editing = null;
  }

  get canResubmit(): boolean {
    return !!this.editing && !!this.editTitle.trim() && !this.saving;
  }

  resubmit(): void {
    if (!this.canResubmit || !this.editing) {
      return;
    }
    this.saving = true;
    const id = this.editing.id;
    this.workflow
      .correct(id, {
        taskTitle: this.editTitle.trim(),
        priority: this.editPriority,
        description: this.editDescription
      })
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.editing = null;
          this.successMessage = `${taskCodeOf(saved)} corrected and sent back for review.`;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage =
            typeof err?.error === 'string' ? err.error : 'The correction could not be saved.';
        }
      });
  }

  /* ---------- helpers for the template ---------- */

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
    if (this.stateOf(item) === 'APPROVED' && this.isAssigned(item)) {
      return 'With a developer';
    }
    return approvalLabel(this.stateOf(item));
  }

  stateClass(item: WorkItem): string {
    if (this.stateOf(item) === 'APPROVED' && this.isAssigned(item)) {
      return 'ems-badge--info';
    }
    return approvalBadge(this.stateOf(item));
  }

  priorityLabel(value?: string): string {
    return this.reference.label('PRIORITY', value || '') || (value || '—');
  }

  attachmentUrl(name: string): string {
    return 'http://localhost:9001/attachments/' + name;
  }

  goToRaise(): void {
    this.router.navigate(['/issues/new']);
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

  isBug(item: WorkItem): boolean {
    return (item.kind || '').toUpperCase() === 'BUG' || (item.taskCode || '').startsWith('BUG');
  }

  isProdIssue(item: WorkItem): boolean {
    const k = (item.kind || '').toUpperCase();
    return k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || (item.taskCode || '').startsWith('PROD');
  }

  kindLabel(item: WorkItem): string {
    if (this.isProdIssue(item)) return 'Production Issue';
    return this.isBug(item) ? 'Bug' : 'Ticket';
  }

  kindBadge(item: WorkItem): string {
    if (this.isProdIssue(item)) return 'ems-badge--prod';
    return this.isBug(item) ? 'ems-badge--danger' : 'ems-badge--info';
  }

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

  openBugDetails(item: WorkItem): void {
    this.openTicketDetails(item);
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
    const headers = ['Ticket ID', 'Kind', 'Title', 'Project', 'Module', 'Screen', 'Priority', 'Raised Date', 'Status', 'Reviewer', 'Developer'];
    const rows = this.filtered.map(item => [
      this.code(item),
      item.kind || 'TASK',
      item.taskTitle,
      item.project || '—',
      item.module || '—',
      item.screen || '—',
      this.priorityLabel(item.priority),
      this.toIsoDate(item.createdAt || item.startDate),
      this.stateLabel(item),
      item.reviewedBy || '—',
      item.assignedToName || 'Unassigned'
    ]);
    this.exportCsvFile('My_Submissions', headers, rows);
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
