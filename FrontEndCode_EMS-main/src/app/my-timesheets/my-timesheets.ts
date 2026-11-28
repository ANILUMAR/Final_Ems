import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { DailyTimesheet, DailyTimesheetTaskItem } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { WorkspaceService } from '../services/workspace.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-my-timesheets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    RouterModule,
    Pager
  ],
  templateUrl: './my-timesheets.html',
  styleUrls: ['./my-timesheets.css']
})
export class MyTimesheetsComponent implements OnInit {
  timesheets: DailyTimesheet[] = [];
  projectOptions: string[] = [];

  loading = true;
  errorMessage = '';

  // Filters
  search = '';
  selectedStatus = 'ALL';
  selectedProject = 'ALL';
  fromDate: Date | null = null;
  toDate: Date | null = null;

  // Selected for breakdown dialog / modal
  selectedSheet: DailyTimesheet | null = null;

  // Pagination
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  statusFilters = [
    { key: 'ALL', label: 'All' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' }
  ];

  constructor(
    private timesheetService: Timesheet,
    private workspace: WorkspaceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTimesheets();
    this.loadProjects();
  }

  loadProjects(): void {
    this.workspace.getProjects().subscribe({
      next: (projects) => {
        const names = (projects || []).map((p) => p.name).filter(Boolean);
        this.projectOptions = Array.from(new Set(names)).sort();
      },
      error: () => {}
    });
  }

  loadTimesheets(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters = {
      fromDate: this.fromDate ? this.toIsoDate(this.fromDate) : undefined,
      toDate: this.toDate ? this.toIsoDate(this.toDate) : undefined,
      project: this.selectedProject !== 'ALL' ? this.selectedProject : undefined,
      status: this.selectedStatus !== 'ALL' ? this.selectedStatus : undefined
    };

    this.timesheetService.getMyDailyTimesheets(filters).subscribe({
      next: (data) => {
        this.timesheets = data || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load my timesheets', err);
        this.errorMessage = 'Could not load your timesheet history.';
        this.loading = false;
      }
    });
  }

  /* ---------- Filtered Data ---------- */

  get filtered(): DailyTimesheet[] {
    const term = this.search.trim().toLowerCase();

    return this.timesheets.filter((sheet) => {
      const matchesStatus =
        this.selectedStatus === 'ALL' || (sheet.status || '').toUpperCase() === this.selectedStatus;

      const matchesProject =
        this.selectedProject === 'ALL' ||
        (sheet.entries || []).some((e) => (e.project || '').toLowerCase() === this.selectedProject.toLowerCase());

      const matchesSearch =
        !term ||
        [sheet.workDate, sheet.status, sheet.reportingPersonName, sheet.rejectionReason]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)) ||
        (sheet.entries || []).some(
          (e) =>
            (e.project && e.project.toLowerCase().includes(term)) ||
            (e.taskCode && e.taskCode.toLowerCase().includes(term)) ||
            (e.taskTitle && e.taskTitle.toLowerCase().includes(term)) ||
            (e.workDescription && e.workDescription.toLowerCase().includes(term))
        );

      return matchesStatus && matchesProject && matchesSearch;
    });
  }

  get pagedTimesheets(): DailyTimesheet[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  get totalLoggedHours(): number {
    return this.filtered.reduce((sum, s) => sum + (s.totalHours || 0), 0);
  }

  get approvedCount(): number {
    return this.timesheets.filter((s) => (s.status || '').toUpperCase() === 'APPROVED').length;
  }

  get pendingCount(): number {
    return this.timesheets.filter((s) => {
      const st = (s.status || '').toUpperCase();
      return st === 'SUBMITTED' || st === 'PENDING' || st === 'UNDER_REVIEW';
    }).length;
  }

  get rejectedCount(): number {
    return this.timesheets.filter((s) => (s.status || '').toUpperCase() === 'REJECTED').length;
  }

  /* ---------- Actions ---------- */

  setStatus(status: string): void {
    this.selectedStatus = status;
    this.pageIndex = 0;
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadTimesheets();
  }

  clearFilters(): void {
    this.search = '';
    this.selectedStatus = 'ALL';
    this.selectedProject = 'ALL';
    this.fromDate = null;
    this.toDate = null;
    this.pageIndex = 0;
    this.loadTimesheets();
  }

  openBreakdown(sheet: DailyTimesheet): void {
    this.selectedSheet = sheet;
  }

  closeBreakdown(): void {
    this.selectedSheet = null;
  }

  editTimesheet(sheet: DailyTimesheet): void {
    this.router.navigate(['/timesheets/new'], {
      queryParams: { date: sheet.workDate }
    });
  }

  /* ---------- Helpers ---------- */

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
