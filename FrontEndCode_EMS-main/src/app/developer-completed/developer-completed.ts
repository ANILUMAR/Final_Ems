import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { isManagerRole, isSuperAdminRole } from '../models/role';
import { kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';
import { WorkflowPipelineComponent } from '../shared/workflow-pipeline/workflow-pipeline.component';

@Component({
  selector: 'app-developer-completed',
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
    MatDialogModule,
    Pager,
    WorkflowPipelineComponent
  ],
  templateUrl: './developer-completed.html',
  styleUrl: './developer-completed.css'
})
export class DeveloperCompletedComponent implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  totalCompleted = 0;
  awaitingRelease = 0;
  awaitingReview = 0;
  approvedForRelease = 0;
  onHoldCount = 0;
  releasedForTesting = 0;
  inTesting = 0;
  verified = 0;

  filter: 'ALL' | 'AWAITING' | 'APPROVED' | 'RELEASED' | 'IN_TESTING' | 'VERIFIED' = 'ALL';
  search = '';

  /** Leader rights */
  isLeader = false;
  isSuperAdmin = false;
  currentRole = '';
  currentEmail = '';
  kindFilter: 'ALL' | 'TASK' | 'BUG' | 'PROD' = 'ALL';

  /** Release dialog */
  releasingItem: WorkItem | null = null;
  releaseNote = '';
  submitting = false;

  /** Batch Release dialog */
  showBatchReleaseModal = false;
  batchReleaseNote = 'Batch release approved by Team Leader for QA verification.';
  batchReleasing = false;

  /** Hold dialog */
  holdingItem: WorkItem | null = null;
  holdReason = '';
  holding = false;

  /** Pagination */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    private workflowService: WorkflowService,
    private dialog: MatDialog
  ) {
    this.currentRole = (localStorage.getItem('role') || '').trim().toUpperCase();
    this.currentEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
    this.isSuperAdmin = isSuperAdminRole(this.currentRole);
    this.isLeader = isManagerRole(this.currentRole) || this.currentRole === 'DEVELOPER_LEAD' || this.currentRole === 'TEAM_LEAD' || this.currentRole === 'TEAM_LEADER';
  }

  openTicketDetails(item: WorkItem): void {
    const ref = this.dialog.open(TicketDetailDialog, {
      data: { item },
      width: '92vw',
      maxWidth: '1150px',
      maxHeight: '92vh'
    });
    ref.afterClosed().subscribe(() => {
      this.loadData();
    });
  }

  openBugDetails(item: WorkItem): void {
    this.openTicketDetails(item);
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    this.workflowService.completedTasks().subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.totalCompleted = res.totalCompleted || 0;
        this.awaitingRelease = res.awaitingRelease || 0;
        this.awaitingReview = res.awaitingReview || 0;
        this.approvedForRelease = res.approvedForRelease || 0;
        this.onHoldCount = res.onHoldCount || 0;
        this.releasedForTesting = res.releasedForTesting || 0;
        this.inTesting = res.inTesting || 0;
        this.verified = res.verified || 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load completed work:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Could not load completed tasks.';
        this.loading = false;
      }
    });
  }

  get approvedItems(): WorkItem[] {
    return this.items.filter((i) => !i.releasedForTesting && i.leadReviewStatus === 'APPROVED');
  }

  get filteredItems(): WorkItem[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter((item) => {
      // Kind filter (Tasks vs Bugs vs Prod Issues)
      const isProd = this.isProdIssue(item);
      const isBug = !isProd && this.isBug(item);
      const isTask = !isProd && !isBug;
      if (this.kindFilter === 'TASK' && !isTask) {
        return false;
      }
      if (this.kindFilter === 'BUG' && !isBug) {
        return false;
      }
      if (this.kindFilter === 'PROD' && !isProd) {
        return false;
      }

      // Status filter
      if (this.filter === 'AWAITING' && (item.releasedForTesting || item.leadReviewStatus === 'APPROVED')) {
        return false;
      }
      if (this.filter === 'APPROVED' && (item.releasedForTesting || item.leadReviewStatus !== 'APPROVED')) {
        return false;
      }
      if (this.filter === 'RELEASED' && (!item.releasedForTesting || item.testingStatus === 'IN_TESTING' || item.testingStatus === 'VERIFIED')) {
        return false;
      }
      if (this.filter === 'IN_TESTING' && item.testingStatus !== 'IN_TESTING') {
        return false;
      }
      if (this.filter === 'VERIFIED' && item.testingStatus !== 'VERIFIED') {
        return false;
      }

      // Search
      if (!q) {
        return true;
      }
      const code = taskCodeOf(item).toLowerCase();
      const title = (item.taskTitle || '').toLowerCase();
      const project = (item.project || '').toLowerCase();
      const owner = (item.assignedToName || '').toLowerCase();
      return code.includes(q) || title.includes(q) || project.includes(q) || owner.includes(q);
    });
  }

  get pagedItems(): WorkItem[] {
    return pageSlice(this.filteredItems, this.pageIndex, this.pageSize);
  }

  get lastPageIndex(): number {
    return lastPageOf(this.filteredItems.length, this.pageSize);
  }

  setFilter(filter: 'ALL' | 'AWAITING' | 'APPROVED' | 'RELEASED' | 'IN_TESTING' | 'VERIFIED'): void {
    this.filter = filter;
    this.pageIndex = 0;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  onPageChange(index: number): void {
    this.pageIndex = index;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageIndex = 0;
  }

  setKindFilter(kind: 'ALL' | 'TASK' | 'BUG' | 'PROD'): void {
    this.kindFilter = kind;
    this.pageIndex = 0;
  }

  isProdIssue(item: WorkItem): boolean {
    const k = (item.kind || '').toUpperCase();
    return k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || (item.taskCode || '').startsWith('PROD');
  }

  isBug(item: WorkItem): boolean {
    return (item.kind || '').toUpperCase() === 'BUG' || (item.taskCode || '').startsWith('BUG');
  }

  get taskCount(): number {
    return this.items.filter((i) => !this.isProdIssue(i) && !this.isBug(i)).length;
  }

  get bugCount(): number {
    return this.items.filter((i) => !this.isProdIssue(i) && this.isBug(i)).length;
  }

  get prodCount(): number {
    return this.items.filter((i) => this.isProdIssue(i)).length;
  }

  /* ---------- Team Leader Review Actions (Approve / Hold) ---------- */

  approveItem(item: WorkItem): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.workflowService.leadReview(item.id, item.kind, 'APPROVE').subscribe({
      next: (updated) => {
        item.leadReviewStatus = 'APPROVED';
        this.successMessage = `${taskCodeOf(item)} reviewed and approved! Ready to be released with the top button.`;
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to approve item:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to approve item.';
      }
    });
  }

  resetReview(item: WorkItem): void {
    this.errorMessage = '';
    this.workflowService.leadReview(item.id, item.kind, 'RESET').subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to reset review status.';
      }
    });
  }

  openHoldModal(item: WorkItem): void {
    this.holdingItem = item;
    this.holdReason = '';
    this.holding = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeHoldModal(): void {
    this.holdingItem = null;
    this.holdReason = '';
    this.holding = false;
  }

  submitHold(): void {
    if (!this.holdingItem || !this.holdReason.trim()) return;
    this.holding = true;
    this.errorMessage = '';

    const code = taskCodeOf(this.holdingItem);
    this.workflowService.leadReview(this.holdingItem.id, this.holdingItem.kind, 'HOLD', this.holdReason.trim()).subscribe({
      next: () => {
        this.successMessage = `${code} moved to "On Hold Tasks" screen for further review.`;
        this.closeHoldModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to put task on hold:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to put task on hold.';
        this.holding = false;
      }
    });
  }

  /* ---------- Top "Release for Testing" Batch Action ---------- */

  openBatchReleaseModal(): void {
    if (this.approvedForRelease === 0) {
      alert('There are no reviewed and approved tasks ready to release. Please review and click "Approve" on completed tasks below first.');
      return;
    }
    this.batchReleaseNote = 'Batch release approved by Team Leader for QA verification.';
    this.showBatchReleaseModal = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeBatchReleaseModal(): void {
    this.showBatchReleaseModal = false;
    this.batchReleasing = false;
  }

  confirmBatchRelease(): void {
    this.batchReleasing = true;
    this.errorMessage = '';

    this.workflowService.batchReleaseForTesting(undefined, this.batchReleaseNote).subscribe({
      next: (res) => {
        this.successMessage = res.message || `Successfully released ${res.releasedCount} task(s) to Testing Team!`;
        this.closeBatchReleaseModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to batch release tasks:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to release approved tasks for testing.';
        this.batchReleasing = false;
      }
    });
  }

  /* ---------- Single Task Release (Legacy / Fallback) ---------- */

  openReleaseModal(item: WorkItem): void {
    this.releasingItem = item;
    this.releaseNote = `Completed by ${item.assignedToName || 'developer'}. Ready for verification on ${item.project || 'project'}.`;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeReleaseModal(): void {
    this.releasingItem = null;
    this.releaseNote = '';
    this.submitting = false;
  }

  submitRelease(): void {
    if (!this.releasingItem) return;
    this.submitting = true;
    this.errorMessage = '';

    this.workflowService.releaseForTesting(this.releasingItem.id, this.releasingItem.kind, this.releaseNote).subscribe({
      next: (updated) => {
        this.successMessage = `${taskCodeOf(updated)} released for testing successfully!`;
        this.closeReleaseModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to release task for testing:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to release for testing.';
        this.submitting = false;
      }
    });
  }

  codeOf(item: WorkItem): string {
    return taskCodeOf(item);
  }

  badgeOf(kind?: string): string {
    return kindBadge(kind);
  }

  labelOf(kind?: string): string {
    return kindLabel(kind);
  }

  formatDate(date?: string | Date | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(date);
    }
  }

  initials(name?: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  priorityBadge(priority?: string): string {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH': return 'ems-badge--danger';
      case 'MEDIUM': return 'ems-badge--warning';
      case 'LOW': return 'ems-badge--neutral';
      default: return 'ems-badge--neutral';
    }
  }

  priorityLabel(priority?: string): string {
    const p = (priority || 'MEDIUM').toUpperCase();
    switch (p) {
      case 'HIGH': return 'High';
      case 'MEDIUM': return 'Medium';
      case 'LOW': return 'Low';
      default: return priority || 'Medium';
    }
  }

  isOverdue(item: WorkItem): boolean {
    return !!item.endDate && new Date(item.endDate).getTime() < new Date().setHours(0, 0, 0, 0);
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
    const headers = ['Ticket ID', 'Kind', 'Title', 'Project', 'Module', 'Screen', 'Developer', 'Lead Review', 'Released For Testing', 'Tester', 'Priority', 'Start Date', 'Due Date', 'Status'];
    const rows = this.filteredItems.map(item => [
      this.codeOf(item),
      item.kind || 'TASK',
      item.taskTitle,
      item.project || '—',
      item.module || '—',
      item.screen || '—',
      item.assignedToName || 'Unassigned',
      item.leadReviewStatus || 'AWAITING',
      item.releasedForTesting ? 'YES' : 'NO',
      item.assignedTesterName || 'Unassigned',
      this.priorityLabel(item.priority),
      this.toIsoDate(item.startDate),
      this.toIsoDate(item.endDate),
      item.status || 'DONE'
    ]);
    this.exportCsvFile('Developer_Completed_Tickets', headers, rows);
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

