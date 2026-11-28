import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';
import { TicketService, SlaStatus } from '../services/ticket.service';
import { TaskModel } from '../models/employee';
import {
  CompletedWorkResponse,
  DeveloperLoad,
  DevQueue,
  taskCodeOf,
  TesterLoad,
  TestingQueue,
  WorkItem
} from '../models/work-item';
import { isSuperAdminRole, roleFamily } from '../models/role';
import { RolePermissionService } from '../services/role-permission.service';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

/**
 * Task Management Hub (Monitoring Console for Super Admin / Admin).
 *
 * Provides a screen-wise read-only monitoring overview of all workflow activities:
 * - Review queues for Testing Team Leader & Developer Team Leader
 * - Team assignments made by team leads (Developer Team & Testing Team)
 * - Completed Tasks & Bugs across development and testing
 * - On-Hold Tasks and reasons
 * - Task Register
 *
 * Operational activities (such as releasing to QA, approving/rejecting, or assigning)
 * are restricted from this screen. A download option (CSV export) is provided on
 * each screen to allow the Admin to download the respective records.
 */
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
  isSuperAdmin = false;
  activeSection: 'review' | 'assignment' | 'completed' | 'onhold' | 'register' = 'review';

  loading = true;
  errorMessage = '';
  successMessage = '';

  /* =========================================================================
     1. REVIEW LIST SECTION (Testing Team Leader & Developer Team Leader)
     ========================================================================= */
  reviewSubTab: 'testing' | 'developer' = 'testing';

  // 1A. Testing Team Leader Review Items (Submissions from testers)
  reviewItems: WorkItem[] = [];
  reviewFilter: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' = 'PENDING';
  reviewSearch = '';
  reviewPageIndex = 0;
  reviewPageSize = DEFAULT_PAGE_SIZE;

  // 1B. Developer Team Leader Review Items (Completed work awaiting lead review & release)
  devReviewFilter: 'ALL' | 'AWAITING' | 'APPROVED' | 'ON_HOLD' = 'ALL';
  devReviewSearch = '';
  devReviewPageIndex = 0;
  devReviewPageSize = DEFAULT_PAGE_SIZE;

  get reviewCount(): number {
    return this.reviewItems.length;
  }
  get pendingReviewCount(): number {
    return this.reviewItems.filter(i => (i.approvalState || 'PENDING').toUpperCase() === 'PENDING').length;
  }
  get approvedReviewCount(): number {
    return this.reviewItems.filter(i => (i.approvalState || '').toUpperCase() === 'APPROVED').length;
  }
  get rejectedReviewCount(): number {
    return this.reviewItems.filter(i => (i.approvalState || '').toUpperCase() === 'REJECTED').length;
  }

  get devLeadReviewItems(): WorkItem[] {
    return this.completedItems;
  }
  get devLeadAwaitingReviewCount(): number {
    return this.completedItems.filter(i => !i.releasedForTesting && i.leadReviewStatus !== 'APPROVED').length;
  }
  get devLeadApprovedCount(): number {
    return this.completedItems.filter(i => !i.releasedForTesting && i.leadReviewStatus === 'APPROVED').length;
  }
  get devLeadOnHoldCount(): number {
    return this.onHoldItems.length;
  }

  get filteredReviewItems(): WorkItem[] {
    const q = this.reviewSearch.trim().toLowerCase();
    return this.reviewItems.filter((item) => {
      const state = (item.approvalState || 'PENDING').toUpperCase();
      if (this.reviewFilter !== 'ALL' && state !== this.reviewFilter) {
        return false;
      }
      if (!q) return true;
      const c = taskCodeOf(item).toLowerCase();
      const t = (item.taskTitle || '').toLowerCase();
      const p = (item.project || '').toLowerCase();
      const r = (item.createdByName || item.createdBy || '').toLowerCase();
      const m = (item.module || '').toLowerCase();
      const pr = (item.priority || '').toLowerCase();
      return c.includes(q) || t.includes(q) || p.includes(q) || r.includes(q) || m.includes(q) || pr.includes(q);
    });
  }

  get pagedReviewItems(): WorkItem[] {
    return pageSlice(this.filteredReviewItems, this.reviewPageIndex, this.reviewPageSize);
  }

  get filteredDevReviewItems(): WorkItem[] {
    const q = this.devReviewSearch.trim().toLowerCase();
    return this.devLeadReviewItems.filter((item) => {
      if (this.devReviewFilter === 'AWAITING' && (item.releasedForTesting || item.leadReviewStatus === 'APPROVED')) {
        return false;
      }
      if (this.devReviewFilter === 'APPROVED' && (item.releasedForTesting || item.leadReviewStatus !== 'APPROVED')) {
        return false;
      }
      if (this.devReviewFilter === 'ON_HOLD' && item.leadReviewStatus !== 'ON_HOLD') {
        return false;
      }
      if (!q) return true;
      const c = taskCodeOf(item).toLowerCase();
      const t = (item.taskTitle || '').toLowerCase();
      const p = (item.project || '').toLowerCase();
      const d = (item.assignedToName || '').toLowerCase();
      const m = (item.module || '').toLowerCase();
      return c.includes(q) || t.includes(q) || p.includes(q) || d.includes(q) || m.includes(q);
    });
  }

  get pagedDevReviewItems(): WorkItem[] {
    return pageSlice(this.filteredDevReviewItems, this.devReviewPageIndex, this.devReviewPageSize);
  }

  /* =========================================================================
     2. TEAM ASSIGNMENT LIST SECTION (Assignments made by Team Leads)
     ========================================================================= */
  assignmentSubTab: 'all' | 'developer' | 'testing' = 'all';

  assignmentItems: WorkItem[] = []; // Developer assignments
  qaAssignmentItems: WorkItem[] = []; // Testing assignments
  developers: DeveloperLoad[] = [];
  testers: TesterLoad[] = [];

  assignmentFilter: 'ALL' | 'ASSIGNED' | 'AWAITING' = 'ALL';
  assignmentSearch = '';
  assignmentPageIndex = 0;
  assignmentPageSize = DEFAULT_PAGE_SIZE;

  get awaitingAssignmentCount(): number {
    return this.assignmentItems.filter(i => !i.assignedToName).length;
  }
  get assignedToTeamCount(): number {
    return this.assignmentItems.filter(i => !!i.assignedToName).length;
  }
  get qaAwaitingCount(): number {
    return this.qaAssignmentItems.filter(i => !i.assignedTesterName).length;
  }
  get qaAssignedCount(): number {
    return this.qaAssignmentItems.filter(i => !!i.assignedTesterName).length;
  }

  /** Unified list of all assignments made by both Developer and Testing Leads */
  get allAssignmentsList(): (WorkItem & { teamType: 'DEVELOPER' | 'TESTER' })[] {
    const devRows = this.assignmentItems.map(i => ({ ...i, teamType: 'DEVELOPER' as const }));
    const qaRows = this.qaAssignmentItems.map(i => ({ ...i, teamType: 'TESTER' as const }));
    if (this.assignmentSubTab === 'developer') return devRows;
    if (this.assignmentSubTab === 'testing') return qaRows;
    return [...devRows, ...qaRows];
  }

  get filteredAssignmentItems(): (WorkItem & { teamType: 'DEVELOPER' | 'TESTER' })[] {
    const q = this.assignmentSearch.trim().toLowerCase();
    return this.allAssignmentsList.filter((item) => {
      const isAssigned = item.teamType === 'DEVELOPER' ? !!item.assignedToName : !!item.assignedTesterName;
      if (this.assignmentFilter === 'ASSIGNED' && !isAssigned) return false;
      if (this.assignmentFilter === 'AWAITING' && isAssigned) return false;

      if (!q) return true;
      const c = taskCodeOf(item).toLowerCase();
      const t = (item.taskTitle || '').toLowerCase();
      const p = (item.project || '').toLowerCase();
      const lead = ((item.teamType === 'DEVELOPER' ? item.assignedBy : item.assignedTesterBy) || '').toLowerCase();
      const member = ((item.teamType === 'DEVELOPER' ? item.assignedToName : item.assignedTesterName) || '').toLowerCase();
      const pr = (item.priority || '').toLowerCase();
      return c.includes(q) || t.includes(q) || p.includes(q) || lead.includes(q) || member.includes(q) || pr.includes(q);
    });
  }

  get pagedAssignmentItems(): (WorkItem & { teamType: 'DEVELOPER' | 'TESTER' })[] {
    return pageSlice(this.filteredAssignmentItems, this.assignmentPageIndex, this.assignmentPageSize);
  }

  /* =========================================================================
     3. COMPLETED TASKS/BUGS LIST SECTION
     ========================================================================= */
  completedItems: WorkItem[] = [];
  completedFilter: 'ALL' | 'AWAITING' | 'APPROVED' | 'RELEASED' = 'ALL';
  completedSearch = '';
  completedPageIndex = 0;
  completedPageSize = DEFAULT_PAGE_SIZE;

  get completedCount(): number {
    return this.completedItems.length;
  }
  get completedAwaitingReviewCount(): number {
    return this.completedItems.filter(i => !i.releasedForTesting && i.leadReviewStatus !== 'APPROVED').length;
  }
  get completedApprovedCount(): number {
    return this.completedItems.filter(i => !i.releasedForTesting && i.leadReviewStatus === 'APPROVED').length;
  }
  get completedReadyToRelease(): number {
    return this.completedApprovedCount;
  }
  get completedReleasedCount(): number {
    return this.completedItems.filter(i => !!i.releasedForTesting).length;
  }

  get filteredCompletedItems(): WorkItem[] {
    const q = this.completedSearch.trim().toLowerCase();
    return this.completedItems.filter((item) => {
      if (this.completedFilter === 'AWAITING' && (item.releasedForTesting || item.leadReviewStatus === 'APPROVED')) {
        return false;
      }
      if (this.completedFilter === 'APPROVED' && (item.releasedForTesting || item.leadReviewStatus !== 'APPROVED')) {
        return false;
      }
      if (this.completedFilter === 'RELEASED' && !item.releasedForTesting) {
        return false;
      }
      if (!q) return true;
      const c = taskCodeOf(item).toLowerCase();
      const t = (item.taskTitle || '').toLowerCase();
      const p = (item.project || '').toLowerCase();
      const d = (item.assignedToName || '').toLowerCase();
      const m = (item.module || '').toLowerCase();
      return c.includes(q) || t.includes(q) || p.includes(q) || d.includes(q) || m.includes(q);
    });
  }

  get pagedCompletedItems(): WorkItem[] {
    return pageSlice(this.filteredCompletedItems, this.completedPageIndex, this.completedPageSize);
  }

  /* =========================================================================
     4. ON-HOLD TASKS LIST SECTION
     ========================================================================= */
  onHoldItems: WorkItem[] = [];
  onHoldFilter: 'ALL' | 'TASK' | 'BUG' = 'ALL';
  onHoldSearch = '';
  onHoldPageIndex = 0;
  onHoldPageSize = DEFAULT_PAGE_SIZE;

  get onHoldCount(): number {
    return this.onHoldItems.length;
  }
  get onHoldTasksCount(): number {
    return this.onHoldItems.filter(i => (i.kind || '').toUpperCase() !== 'BUG').length;
  }
  get onHoldBugsCount(): number {
    return this.onHoldItems.filter(i => (i.kind || '').toUpperCase() === 'BUG').length;
  }

  get filteredOnHoldItems(): WorkItem[] {
    const q = this.onHoldSearch.trim().toLowerCase();
    return this.onHoldItems.filter((item) => {
      const isBug = (item.kind || '').toUpperCase() === 'BUG';
      if (this.onHoldFilter === 'TASK' && isBug) return false;
      if (this.onHoldFilter === 'BUG' && !isBug) return false;
      if (!q) return true;
      const c = taskCodeOf(item).toLowerCase();
      const t = (item.taskTitle || '').toLowerCase();
      const p = (item.project || '').toLowerCase();
      const d = (item.assignedToName || '').toLowerCase();
      const r = (item.holdReason || '').toLowerCase();
      return c.includes(q) || t.includes(q) || p.includes(q) || d.includes(q) || r.includes(q);
    });
  }

  get pagedOnHoldItems(): WorkItem[] {
    return pageSlice(this.filteredOnHoldItems, this.onHoldPageIndex, this.onHoldPageSize);
  }

  /* =========================================================================
     5. TASK REGISTER SECTION
     ========================================================================= */
  tasks: TaskModel[] = [];
  search = '';
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  private apiUrl = 'http://localhost:9001/api/assigntasks/register';

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private reference: ReferenceService,
    private workflow: WorkflowService,
    private route: ActivatedRoute,
    private router: Router,
    private ticketService: TicketService,
    private rolePermissionService: RolePermissionService
  ) {
    this.isSuperAdmin = isSuperAdminRole(localStorage.getItem('role'));
  }

  get canExport(): boolean {
    return this.isSuperAdmin ||
           this.rolePermissionService.canExport('ALL_TICKETS') ||
           this.rolePermissionService.canExport('TICKET_HUB');
  }

  ngOnInit(): void {
    this.loadRegister();
    if (this.isSuperAdmin) {
      this.loadAllAdminSections();
      this.route.queryParams.subscribe((params) => {
        if (params['section']) {
          const s = String(params['section']).toLowerCase();
          if (['review', 'assignment', 'completed', 'onhold', 'register'].includes(s)) {
            this.activeSection = s as any;
          }
        }
      });
    } else {
      this.activeSection = 'register';
    }
  }

  selectSection(section: 'review' | 'assignment' | 'completed' | 'onhold' | 'register'): void {
    this.activeSection = section;
    this.errorMessage = '';
    this.successMessage = '';
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section },
      queryParamsHandling: 'merge'
    });
  }

  refreshAll(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.loadRegister();
    if (this.isSuperAdmin) {
      this.loadAllAdminSections();
    }
  }

  /* ---------- Data Loaders ---------- */

  loadRegister(): void {
    this.loading = true;
    const headers = new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
    this.http.get<TaskModel[]>(this.apiUrl, { headers }).subscribe({
      next: (tasks) => {
        this.tasks = tasks || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load all tasks', err);
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'Could not load tasks right now.';
        this.loading = false;
      }
    });
  }

  loadAllAdminSections(): void {
    // 1. Review List (Testing Lead Queue)
    this.workflow.approvals().subscribe({
      next: (items) => {
        this.reviewItems = items || [];
        this.reviewPageIndex = Math.min(this.reviewPageIndex, lastPageOf(this.filteredReviewItems.length, this.reviewPageSize));
      },
      error: (err) => console.error('Failed to load review items', err)
    });

    // 2. Dev Assignment Queue (Developer Lead assignments)
    this.workflow.devQueue().subscribe({
      next: (q) => {
        this.assignmentItems = q?.items || [];
        this.developers = q?.developers || [];
        this.assignmentPageIndex = Math.min(this.assignmentPageIndex, lastPageOf(this.filteredAssignmentItems.length, this.assignmentPageSize));
      },
      error: (err) => console.error('Failed to load dev queue', err)
    });

    // 3. QA Testing Queue (Testing Lead assignments)
    this.workflow.testingQueue().subscribe({
      next: (q) => {
        this.qaAssignmentItems = q?.items || [];
        this.testers = q?.testers || [];
      },
      error: (err) => console.error('Failed to load testing queue', err)
    });

    // 4. Completed Tasks
    this.workflow.completedTasks().subscribe({
      next: (res) => {
        this.completedItems = res?.items || [];
        this.completedPageIndex = Math.min(this.completedPageIndex, lastPageOf(this.filteredCompletedItems.length, this.completedPageSize));
      },
      error: (err) => console.error('Failed to load completed tasks', err)
    });

    // 5. On-Hold Tasks
    this.workflow.onHoldTasks().subscribe({
      next: (res) => {
        this.onHoldItems = res?.items || [];
        this.onHoldPageIndex = Math.min(this.onHoldPageIndex, lastPageOf(this.filteredOnHoldItems.length, this.onHoldPageSize));
      },
      error: (err) => console.error('Failed to load on-hold tasks', err)
    });
  }

  /* =========================================================================
     DOWNLOAD RECORDS / CSV EXPORT OPTIONS
     ========================================================================= */

  downloadCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
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
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  downloadReviewRecords(): void {
    if (this.reviewSubTab === 'testing') {
      const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Module', 'Screen', 'Reporter', 'Submitted Date', 'Priority', 'Status', 'Review Note'];
      const rows = this.filteredReviewItems.map(i => [
        this.code(i),
        i.kind || 'TASK',
        i.taskTitle,
        i.project || '—',
        i.module || '—',
        i.screen || '—',
        i.createdByName || i.createdBy || 'Tester',
        this.toIsoDate(i.createdAt),
        i.priority || 'MEDIUM',
        i.approvalState || 'PENDING',
        i.reviewNote || ''
      ]);
      this.downloadCsv('Review_List_Testing_Team_Leader', headers, rows);
    } else {
      const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Module', 'Developer', 'Completed Date', 'Lead Review Status', 'Hold Reason', 'QA Released'];
      const rows = this.filteredDevReviewItems.map(i => [
        this.code(i),
        i.kind || 'TASK',
        i.taskTitle,
        i.project || '—',
        i.module || '—',
        i.assignedToName || 'Developer',
        this.toIsoDate(i.heldAt || i.reviewedAt || i.createdAt),
        i.leadReviewStatus || 'PENDING_REVIEW',
        i.holdReason || '',
        i.releasedForTesting ? 'YES' : 'NO'
      ]);
      this.downloadCsv('Review_List_Developer_Team_Leader', headers, rows);
    }
  }

  downloadAssignmentRecords(): void {
    const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Team', 'Assigned By (Lead)', 'Assigned Member', 'Assigned Date', 'Priority', 'Status'];
    const rows = this.filteredAssignmentItems.map(i => {
      const isDev = i.teamType === 'DEVELOPER';
      return [
        this.code(i),
        i.kind || 'TASK',
        i.taskTitle,
        i.project || '—',
        isDev ? 'Java Development' : 'QA Testing',
        (isDev ? i.assignedBy : i.assignedTesterBy) || 'Team Lead',
        (isDev ? i.assignedToName : i.assignedTesterName) || 'Awaiting Assignment',
        this.toIsoDate(isDev ? (i.assignedAt || i.startDate) : (i.assignedTesterAt || i.releasedAt)),
        i.priority || 'MEDIUM',
        (isDev ? i.status : i.testingStatus) || (isDev ? 'TODO' : 'AWAITING_TESTER')
      ];
    });
    const sub = this.assignmentSubTab === 'developer' ? 'Developer_Team' : (this.assignmentSubTab === 'testing' ? 'Testing_Team' : 'All');
    this.downloadCsv(`Team_Assignments_${sub}`, headers, rows);
  }

  downloadCompletedRecords(): void {
    const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Module', 'Completed By', 'Priority', 'Completed Date', 'Review Status', 'Testing Status'];
    const rows = this.filteredCompletedItems.map(i => [
      this.code(i),
      i.kind || 'TASK',
      i.taskTitle,
      i.project || '—',
      i.module || '—',
      i.assignedToName || 'Developer',
      i.priority || 'MEDIUM',
      this.toIsoDate(i.heldAt || i.reviewedAt || i.createdAt),
      i.leadReviewStatus || (i.releasedForTesting ? 'APPROVED' : 'AWAITING_REVIEW'),
      i.testingStatus || 'NOT_STARTED'
    ]);
    this.downloadCsv('Completed_Tasks_Bugs_List', headers, rows);
  }

  downloadOnHoldRecords(): void {
    const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Module', 'Developer', 'Held By (Lead)', 'Hold Reason', 'Held Date', 'Status'];
    const rows = this.filteredOnHoldItems.map(i => [
      this.code(i),
      i.kind || 'TASK',
      i.taskTitle,
      i.project || '—',
      i.module || '—',
      i.assignedToName || 'Developer',
      i.heldByName || i.heldBy || 'Team Lead',
      i.holdReason || '',
      this.toIsoDate(i.heldAt || i.reviewedAt || i.createdAt),
      'ON_HOLD'
    ]);
    this.downloadCsv('On_Hold_Tasks_List', headers, rows);
  }

  downloadRegisterRecords(): void {
    const headers = ['Task Code', 'Kind', 'Title', 'Project', 'Module', 'SubModule', 'Screen', 'Owner', 'Priority', 'Start Date', 'Due Date', 'Status'];
    const rows = this.filteredTasks.map(t => [
      this.code(t),
      t.kind || 'TASK',
      t.taskTitle,
      t.project || '—',
      t.module || '—',
      t.subModule || '—',
      t.screen || '—',
      t.assignedToName || 'Unassigned',
      t.priority || 'MEDIUM',
      this.toIsoDate(t.startDate),
      this.toIsoDate(t.endDate),
      t.status || 'TODO'
    ]);
    this.downloadCsv('Task_Register', headers, rows);
  }

  /* =========================================================================
     SHARED HELPERS & DIALOGS
     ========================================================================= */

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

  get pagedTasks(): TaskModel[] {
    return pageSlice(this.filteredTasks, this.pageIndex, this.pageSize);
  }

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

  priorityBadge(priority?: string): string {
    return this.reference.badge('PRIORITY', priority || '');
  }

  priorityLabel(priority?: string): string {
    return this.reference.label('PRIORITY', priority || '') || priority || '—';
  }

  isOverdue(task: { endDate?: string | Date }): boolean {
    return !!task.endDate && new Date(task.endDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  code(item: any): string {
    return taskCodeOf(item);
  }

  isBug(item: any): boolean {
    return (item.kind || 'TASK').toUpperCase() === 'BUG' || (item.taskCode || '').startsWith('BUG');
  }

  isProdIssue(item: any): boolean {
    const k = (item?.kind || '').toUpperCase();
    return k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || (item?.taskCode || '').startsWith('PROD');
  }

  kindLabel(item: any): string {
    if (this.isProdIssue(item)) return 'Production Issue';
    return this.isBug(item) ? 'Bug' : 'Ticket';
  }

  kindBadge(item: any): string {
    if (this.isProdIssue(item)) return 'ems-badge--prod';
    return this.isBug(item) ? 'ems-badge--danger' : 'ems-badge--info';
  }

  initials(name?: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  attachmentUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const clean = path.replace(/\\/g, '/').split('/').pop() || path;
    return `http://localhost:9001/uploads/${clean}`;
  }

  toIsoDate(d: any): string {
    if (!d) return '';
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }

  slaOf(item: any): SlaStatus {
    return this.ticketService.computeSlaStatus(item);
  }

  priorityMetaOf(item: any) {
    return this.ticketService.priorityPill(item?.priority);
  }

  openTicketDetails(item: any): void {
    const ref = this.dialog.open(TicketDetailDialog, {
      data: { item },
      width: '92vw',
      maxWidth: '1150px',
      maxHeight: '92vh'
    });
    ref.afterClosed().subscribe(() => {
      this.refreshAll();
    });
  }

  openBugDetails(item: any): void {
    this.openTicketDetails(item);
  }
}
