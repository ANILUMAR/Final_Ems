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
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { DailyTimesheet } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { WorkspaceService } from '../services/workspace.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-view-timesheets',
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
    MatTooltipModule,
    RouterModule,
    Pager
  ],
  templateUrl: './view-timesheets.html',
  styleUrl: './view-timesheets.css'
})
export class ViewTimesheets implements OnInit {
  currentTab: 'ALL' | 'REPORTS' = 'ALL';

  timesheets: DailyTimesheet[] = [];
  projectOptions: string[] = [];

  loading = true;
  errorMessage = '';

  // Filters
  search = '';
  statusFilter = 'ALL';
  selectedProject = 'ALL';
  fromDate: Date | null = null;
  toDate: Date | null = null;

  // Selected timesheet for task breakdown dialog
  selectedSheet: DailyTimesheet | null = null;

  // Reporting summaries
  reportsData: {
    grandTotalHours: number;
    totalTimesheets: number;
    employeeSummary: Array<{
      employeeName: string;
      employeeEmail: string;
      employeeRole: string;
      totalHours: number;
      approvedHours: number;
      submittedHours: number;
      timesheetCount: number;
    }>;
    projectSummary: Array<{
      project: string;
      totalHours: number;
      taskCount: number;
    }>;
  } | null = null;

  // Pagination
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  statusFilters = [
    { key: 'ALL', label: 'All' },
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'UNDER_REVIEW', label: 'Under Review' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'DRAFT', label: 'Draft' }
  ];

  constructor(
    private timesheetService: Timesheet,
    private workspace: WorkspaceService
  ) {}

  ngOnInit(): void {
    this.loadData();
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

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';

    const filters = {
      status: this.statusFilter !== 'ALL' ? this.statusFilter : undefined,
      project: this.selectedProject !== 'ALL' ? this.selectedProject : undefined,
      fromDate: this.fromDate ? this.toIsoDate(this.fromDate) : undefined,
      toDate: this.toDate ? this.toIsoDate(this.toDate) : undefined
    };

    this.timesheetService.getApprovalsQueue(filters).subscribe({
      next: (data) => {
        this.timesheets = data || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load workspace timesheets', err);
        this.errorMessage = 'Could not load workspace timesheets.';
        this.loading = false;
      }
    });

    this.timesheetService.getReports(filters).subscribe({
      next: (rep) => {
        this.reportsData = rep;
      },
      error: () => {}
    });
  }

  /* ---------- Filtered Data ---------- */

  get filtered(): DailyTimesheet[] {
    const term = this.search.trim().toLowerCase();

    return this.timesheets.filter((sheet) => {
      const matchesProject =
        this.selectedProject === 'ALL' ||
        (sheet.entries || []).some((e) => (e.project || '').toLowerCase() === this.selectedProject.toLowerCase());

      const matchesSearch =
        !term ||
        [sheet.employeeName, sheet.employeeEmail, sheet.workDate, sheet.status]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)) ||
        (sheet.entries || []).some(
          (e) =>
            (e.project && e.project.toLowerCase().includes(term)) ||
            (e.taskCode && e.taskCode.toLowerCase().includes(term)) ||
            (e.taskTitle && e.taskTitle.toLowerCase().includes(term)) ||
            (e.workDescription && e.workDescription.toLowerCase().includes(term))
        );

      return matchesProject && matchesSearch;
    });
  }

  get pagedTimesheets(): DailyTimesheet[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  get totalHours(): number {
    return this.filtered.reduce((sum, s) => sum + (s.totalHours || 0), 0);
  }

  get pendingCount(): number {
    return this.timesheets.filter(
      (s) => (s.status || '').toUpperCase() === 'SUBMITTED' || (s.status || '').toUpperCase() === 'PENDING'
    ).length;
  }

  get approvedCount(): number {
    return this.timesheets.filter((s) => (s.status || '').toUpperCase() === 'APPROVED').length;
  }

  /* ---------- Actions ---------- */

  setTab(tab: 'ALL' | 'REPORTS'): void {
    this.currentTab = tab;
  }

  setStatus(status: string): void {
    this.statusFilter = status;
    this.pageIndex = 0;
    this.loadData();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadData();
  }

  clearFilters(): void {
    this.search = '';
    this.statusFilter = 'ALL';
    this.selectedProject = 'ALL';
    this.fromDate = null;
    this.toDate = null;
    this.pageIndex = 0;
    this.loadData();
  }

  openBreakdown(sheet: DailyTimesheet): void {
    this.selectedSheet = sheet;
  }

  closeBreakdown(): void {
    this.selectedSheet = null;
  }

  /* ---------- Presentation Helpers ---------- */

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
