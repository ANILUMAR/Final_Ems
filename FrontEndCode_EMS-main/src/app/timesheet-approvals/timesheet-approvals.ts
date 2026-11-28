import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { DailyTimesheet } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-timesheet-approvals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterModule,
    Pager
  ],
  templateUrl: './timesheet-approvals.html',
  styleUrls: ['./timesheet-approvals.css']
})
export class TimesheetApprovalsComponent implements OnInit {
  approvalsQueue: DailyTimesheet[] = [];
  loading = true;
  errorMessage = '';

  // Filters
  search = '';
  statusFilter = 'SUBMITTED'; // Default to pending approvals
  fromDate: Date | null = null;
  toDate: Date | null = null;

  // Selected timesheet for detailed review
  activeSheet: DailyTimesheet | null = null;

  // Rejection modal
  rejectingSheet: DailyTimesheet | null = null;
  rejectionReason = '';
  submittingAction = false;

  // Paging
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  statusTabs = [
    { key: 'SUBMITTED', label: 'Pending Approvals' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'ALL', label: 'All Submissions' }
  ];

  constructor(
    private timesheetService: Timesheet,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadApprovals();
  }

  loadApprovals(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters = {
      status: this.statusFilter !== 'ALL' ? this.statusFilter : undefined,
      fromDate: this.fromDate ? this.toIsoDate(this.fromDate) : undefined,
      toDate: this.toDate ? this.toIsoDate(this.toDate) : undefined
    };

    this.timesheetService.getApprovalsQueue(filters).subscribe({
      next: (data) => {
        this.approvalsQueue = data || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load approval queue', err);
        this.errorMessage = 'Could not load timesheets pending your review.';
        this.loading = false;
      }
    });
  }

  /* ---------- Filtered Data ---------- */

  get filtered(): DailyTimesheet[] {
    const term = this.search.trim().toLowerCase();

    return this.approvalsQueue.filter((sheet) => {
      const matchesSearch =
        !term ||
        [sheet.employeeName, sheet.employeeEmail, sheet.workDate, sheet.status]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)) ||
        (sheet.entries || []).some(
          (e) =>
            (e.project && e.project.toLowerCase().includes(term)) ||
            (e.taskCode && e.taskCode.toLowerCase().includes(term)) ||
            (e.workDescription && e.workDescription.toLowerCase().includes(term))
        );

      return matchesSearch;
    });
  }

  get pagedApprovals(): DailyTimesheet[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  get pendingCount(): number {
    return this.approvalsQueue.filter(
      (s) => (s.status || '').toUpperCase() === 'SUBMITTED' || (s.status || '').toUpperCase() === 'PENDING'
    ).length;
  }

  get underReviewCount(): number {
    return this.approvalsQueue.filter((s) => (s.status || '').toUpperCase() === 'UNDER_REVIEW').length;
  }

  get approvedCount(): number {
    return this.approvalsQueue.filter((s) => (s.status || '').toUpperCase() === 'APPROVED').length;
  }

  get rejectedCount(): number {
    return this.approvalsQueue.filter((s) => (s.status || '').toUpperCase() === 'REJECTED').length;
  }

  /* ---------- Actions ---------- */

  setStatusTab(key: string): void {
    this.statusFilter = key;
    this.pageIndex = 0;
    this.loadApprovals();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadApprovals();
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = 'SUBMITTED';
    this.fromDate = null;
    this.toDate = null;
    this.pageIndex = 0;
    this.loadApprovals();
  }

  openReview(sheet: DailyTimesheet): void {
    this.activeSheet = sheet;
  }

  closeReview(): void {
    this.activeSheet = null;
  }

  approve(sheet: DailyTimesheet): void {
    if (!sheet || !sheet.id) return;
    this.submittingAction = true;

    this.timesheetService.approveDaily(sheet.id).subscribe({
      next: (approved) => {
        this.submittingAction = false;
        this.snackBar.open(`Timesheet for ${approved.employeeName} on ${approved.workDate} approved.`, 'Close', { duration: 3500 });
        if (this.activeSheet?.id === sheet.id) {
          this.activeSheet = null;
        }
        this.loadApprovals();
      },
      error: (err) => {
        this.submittingAction = false;
        console.error('Approve failed', err);
        const msg = err?.error?.message || 'Could not approve timesheet.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  markUnderReview(sheet: DailyTimesheet): void {
    if (!sheet || !sheet.id) return;
    this.submittingAction = true;

    this.timesheetService.markUnderReview(sheet.id).subscribe({
      next: (updated) => {
        this.submittingAction = false;
        this.snackBar.open(`Timesheet marked as Under Review.`, 'Close', { duration: 3000 });
        if (this.activeSheet && this.activeSheet.id === sheet.id) {
          this.activeSheet.status = 'UNDER_REVIEW';
        }
        this.loadApprovals();
      },
      error: (err) => {
        this.submittingAction = false;
        this.snackBar.open('Failed to update status.', 'Close', { duration: 3000 });
      }
    });
  }

  promptReject(sheet: DailyTimesheet): void {
    this.rejectingSheet = sheet;
    this.rejectionReason = '';
  }

  cancelReject(): void {
    this.rejectingSheet = null;
    this.rejectionReason = '';
  }

  confirmReject(): void {
    if (!this.rejectingSheet || !this.rejectingSheet.id) return;
    if (!this.rejectionReason || !this.rejectionReason.trim()) {
      this.snackBar.open('A rejection reason is mandatory.', 'Close', { duration: 3000 });
      return;
    }

    this.submittingAction = true;
    this.timesheetService.rejectDaily(this.rejectingSheet.id, this.rejectionReason.trim()).subscribe({
      next: (rejected) => {
        this.submittingAction = false;
        this.snackBar.open(`Timesheet rejected and sent back to ${rejected.employeeName} with notes.`, 'Close', { duration: 4000 });
        this.rejectingSheet = null;
        this.rejectionReason = '';
        if (this.activeSheet) {
          this.activeSheet = null;
        }
        this.loadApprovals();
      },
      error: (err) => {
        this.submittingAction = false;
        console.error('Reject failed', err);
        const msg = err?.error?.message || 'Could not reject timesheet.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  /* ---------- Helpers ---------- */

  initials(name?: string): string {
    const parts = (name || '?').split(/[\s.@]+/).filter((p) => !!p);
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  }

  getProjectsList(sheet: DailyTimesheet): string {
    if (!sheet.entries || sheet.entries.length === 0) return '—';
    const projs = Array.from(new Set(sheet.entries.map((e) => e.project).filter(Boolean)));
    return projs.join(', ');
  }

  statusBadge(status?: string): string {
    const s = (status || 'DRAFT').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'ems-badge--success';
      case 'SUBMITTED':
      case 'PENDING': return 'ems-badge--info';
      case 'UNDER_REVIEW': return 'ems-badge--warning';
      case 'REJECTED': return 'ems-badge--danger';
      default: return 'ems-badge--neutral';
    }
  }

  statusLabel(status?: string): string {
    const s = (status || 'DRAFT').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'Approved';
      case 'SUBMITTED': return 'Submitted';
      case 'PENDING': return 'Pending';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'REJECTED': return 'Rejected';
      case 'DRAFT': return 'Draft';
      default: return s;
    }
  }

  toIsoDate(value: Date | string): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return String(value);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
