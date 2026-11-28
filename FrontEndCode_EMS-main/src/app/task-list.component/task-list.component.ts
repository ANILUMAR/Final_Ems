import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { TaskModel } from '../models/employee';
import { taskCodeOf } from '../models/work-item';
import { TaskStatus } from '../task-status/task-status';
import { STATUS_META, statusMeta, StatusMeta } from '../task-status/status-history-dialog';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';
import { TicketService, SlaStatus } from '../services/ticket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ReferenceService } from '../services/reference.service';
import { RolePermissionService } from '../services/role-permission.service';
import { RoleGuard } from '../role-guard';
import { isManagerRole, isSuperAdminRole, roleFamily } from '../models/role';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { WorkflowPipelineComponent } from '../shared/workflow-pipeline/workflow-pipeline.component';

const DEFAULT_STATUS_LIST: StatusMeta[] = [
  { value: 'TODO', label: 'To Do', icon: 'radio_button_unchecked', badge: 'ems-badge--neutral' },
  { value: 'ASSIGNED', label: 'Assigned', icon: 'assignment_ind', badge: 'ems-badge--info' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: 'timelapse', badge: 'ems-badge--warning' },
  { value: 'IN_REVIEW', label: 'In Review', icon: 'rate_review', badge: 'ems-badge--info' },
  { value: 'DONE', label: 'Done', icon: 'check_circle', badge: 'ems-badge--success' }
];

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
    Pager,
    WorkflowPipelineComponent
  ],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css']
})
export class TaskListComponent implements OnInit {
  tasks: TaskModel[] = [];
  loading = true;
  errorMessage = '';

  // Search & Filter state
  search = '';
  priority = 'ALL';
  statusFilter = 'ALL';

  // Project & User filters
  selectedProject = 'ALL';
  selectedUser = 'ALL';

  // Date-wise filter
  fromDate = '';
  toDate = '';
  dateField: 'schedule' | 'due' | 'start' = 'schedule';
  activePreset: 'today' | 'week' | 'month' | '' = '';

  // 1-Click Quick Views (Ticketing standard)
  quickView: 'ALL' | 'MY_TICKETS' | 'REPORTED_BY_ME' | 'SLA_RISK' | 'BLOCKER' = 'ALL';

  // By default, display only tickets and bugs assigned to the logged-in user.
  // Checkbox option allows displaying other team members' tickets & bugs on the same Task Board.
  showTeamTickets = false;

  get isSuperAdmin(): boolean {
    return isSuperAdminRole(localStorage.getItem('role'));
  }

  get totalTicketsCount(): number {
    return this.tasks.length;
  }

  get myTasksCount(): number {
    return this.tasks.filter((t) => {
      if (this.selectedProject !== 'ALL' && (t.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
        return false;
      }
      return this.isAssignedToCurrentUser(t);
    }).length;
  }

  get otherTeamCount(): number {
    return this.tasks.filter((t) => {
      if (this.selectedProject !== 'ALL' && (t.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
        return false;
      }
      return !this.isAssignedToCurrentUser(t);
    }).length;
  }

  get selectedUserLabel(): string {
    if (this.selectedUser === 'ME') return 'Assigned to Me';
    if (this.selectedUser === 'ALL') return 'All Team Members';
    const found = this.userList.find((u) => u.key === this.selectedUser);
    return found ? found.label : this.selectedUser;
  }

  get selectedUserSummary(): string {
    if (this.selectedUser === 'ME') {
      return 'Showing: Only your assigned tickets';
    }
    if (this.selectedUser === 'ALL') {
      return this.showTeamTickets ? 'Showing: All team members' : 'Showing: Only your assigned tickets';
    }
    return `Showing: ${this.selectedUserLabel}`;
  }

  get userList(): { key: string; label: string; count: number }[] {
    const currentEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
    const currentName = (localStorage.getItem('name') || '').trim().toLowerCase();
    const map = new Map<string, { key: string; label: string; count: number }>();

    for (const t of this.tasks) {
      if (this.selectedProject !== 'ALL' && (t.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
        continue;
      }

      // Developer
      if (t.assignedToName && t.assignedToName.trim()) {
        const rawName = t.assignedToName.trim();
        const key = rawName.toLowerCase();
        const isMe = (currentEmail && key.includes(currentEmail)) || (currentName && key === currentName);
        const label = isMe ? `${rawName} (You)` : rawName;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, { key, label, count: 1 });
        }
      }

      // QA Tester
      if (t.assignedTesterName && t.assignedTesterName.trim()) {
        const rawName = t.assignedTesterName.trim();
        const key = rawName.toLowerCase();
        if (t.assignedToName && t.assignedToName.trim().toLowerCase() === key) {
          continue;
        }
        const isMe = (currentEmail && key.includes(currentEmail)) || (currentName && key === currentName);
        const label = isMe ? `${rawName} (You)` : rawName;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, { key, label, count: 1 });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  countByUser(userKey: string): number {
    return this.tasks.filter((t) => {
      if (this.selectedProject !== 'ALL' && (t.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
        return false;
      }
      return this.isAssignedToUser(t, userKey);
    }).length;
  }

  countForUserOption(opt: 'ALL' | 'ME'): number {
    if (opt === 'ME') {
      return this.myTasksCount;
    }
    if (this.selectedProject !== 'ALL') {
      return this.tasks.filter((t) => (t.project || '').trim().toUpperCase() === this.selectedProject.trim().toUpperCase()).length;
    }
    return this.tasks.length;
  }

  onProjectFilterChange(): void {
    this.pageIndex = 0;
  }

  onUserFilterChange(): void {
    if (this.selectedUser !== 'ME' && this.selectedUser !== 'ALL') {
      this.showTeamTickets = true;
    } else if (this.selectedUser === 'ME') {
      this.showTeamTickets = false;
    }
    this.pageIndex = 0;
  }

  onTeamTicketsToggle(): void {
    if (!this.showTeamTickets) {
      this.selectedUser = 'ME';
    } else {
      if (this.selectedUser === 'ME') {
        this.selectedUser = 'ALL';
      }
    }
    this.pageIndex = 0;
  }

  isAssignedToUser(task: TaskModel, userKey: string): boolean {
    if (!task || !userKey) return false;
    const key = userKey.trim().toLowerCase();

    // Match assigned developer
    const devName = (task.assignedToName || '').trim().toLowerCase();
    const devAssign = String(task.assignedTo || '').trim().toLowerCase();
    if (devName && (devName === key || devName.includes(key) || key.includes(devName))) {
      return true;
    }
    if (devAssign && (devAssign === key || devAssign.includes(key))) {
      return true;
    }

    // Match assigned tester
    const testerName = (task.assignedTesterName || '').trim().toLowerCase();
    const testerEmail = (task.assignedTesterEmail || '').trim().toLowerCase();
    if (testerName && (testerName === key || testerName.includes(key) || key.includes(testerName))) {
      return true;
    }
    if (testerEmail && (testerEmail === key || testerEmail.includes(key))) {
      return true;
    }

    return false;
  }

  // Full-Screen mode state
  isFullScreen = false;

  toggleFullScreen(): void {
    this.isFullScreen = !this.isFullScreen;
    if (this.isFullScreen) {
      const elem = document.documentElement;
      if (elem && elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  @HostListener('document:fullscreenchange')
  onFullScreenChange(): void {
    if (!document.fullscreenElement && this.isFullScreen) {
      this.isFullScreen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isFullScreen) {
      this.isFullScreen = false;
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }

  // View mode: 'kanban' (columns side-by-side) or 'swimlanes' (horizontal sections)
  viewMode: 'kanban' | 'swimlanes' = 'kanban';

  /** Pager state */
  pageIndex = 0;
  pageSize = 25;

  private apiUrl = 'http://localhost:9001/api/assigntasks/getAssignTask';

  constructor(
    private http: HttpClient,
    private reference: ReferenceService,
    private dialog: MatDialog,
    private ticketService: TicketService,
    private rolePermissionService: RolePermissionService
  ) {
    const savedView = localStorage.getItem('ems_task_board_view');
    if (savedView === 'kanban' || savedView === 'swimlanes') {
      this.viewMode = savedView;
    }
  }

  ngOnInit(): void {
    this.taskModelResponse();
  }

  setViewMode(mode: 'kanban' | 'swimlanes'): void {
    this.viewMode = mode;
    localStorage.setItem('ems_task_board_view', mode);
  }

  get isManager(): boolean {
    return RoleGuard.managesTasks();
  }

  get canRaise(): boolean {
    const family = roleFamily(localStorage.getItem('role'));
    return family === 'TESTER';
  }

  get baseScopeTasks(): TaskModel[] {
    return this.tasks.filter((task) => {
      // 1. User Filter
      if (this.selectedUser === 'ME') {
        if (!this.isAssignedToCurrentUser(task)) return false;
      } else if (this.selectedUser !== 'ALL') {
        if (!this.isAssignedToUser(task, this.selectedUser)) return false;
      } else if (!this.showTeamTickets) {
        if (!this.isAssignedToCurrentUser(task)) return false;
      }

      // 2. Project Filter
      if (this.selectedProject !== 'ALL') {
        if ((task.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
          return false;
        }
      }

      return true;
    });
  }

  /** Distinct list of projects present in the task list */
  get projectList(): string[] {
    const set = new Set<string>();
    for (const t of this.tasks) {
      if (t.project && t.project.trim()) {
        set.add(t.project.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  countByProject(project: string): number {
    return this.tasks.filter((t) => {
      if ((t.project || '').trim().toUpperCase() !== project.trim().toUpperCase()) {
        return false;
      }
      if (this.selectedUser === 'ME') {
        return this.isAssignedToCurrentUser(t);
      } else if (this.selectedUser !== 'ALL') {
        return this.isAssignedToUser(t, this.selectedUser);
      } else if (!this.showTeamTickets) {
        return this.isAssignedToCurrentUser(t);
      }
      return true;
    }).length;
  }

  get filteredTasks(): TaskModel[] {
    const term = this.search.trim().toLowerCase();
    return this.tasks.filter((task) => {
      // 0. User Filter
      if (this.selectedUser === 'ME') {
        if (!this.isAssignedToCurrentUser(task)) return false;
      } else if (this.selectedUser !== 'ALL') {
        if (!this.isAssignedToUser(task, this.selectedUser)) return false;
      } else if (!this.showTeamTickets) {
        if (!this.isAssignedToCurrentUser(task)) return false;
      }

      // 1. Project Filter
      if (this.selectedProject !== 'ALL') {
        if ((task.project || '').trim().toUpperCase() !== this.selectedProject.trim().toUpperCase()) {
          return false;
        }
      }

      // 2. Priority filter
      const matchesPriority = this.priority === 'ALL' || (task.priority || '').toUpperCase() === this.priority;

      // 3. Status filter
      const matchesStatus = this.statusFilter === 'ALL' || statusMeta(task.status).value === this.statusFilter;

      // 4. Date-wise filter
      const matchesDate = this.matchesDateFilter(task);

      // 5. Search text filter
      const matchesSearch =
        !term ||
        [task.taskCode, task.taskTitle, task.project, task.assignedToName, task.assignedTesterName, task.module, task.screen]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      // 6. Quick View filter (Assigned to Me, Reported by Me, SLA Risk, Blocker)
      const matchesQuick = this.matchesQuickView(task);

      return matchesPriority && matchesStatus && matchesDate && matchesSearch && matchesQuick;
    });
  }

  setQuickView(view: 'ALL' | 'MY_TICKETS' | 'REPORTED_BY_ME' | 'SLA_RISK' | 'BLOCKER'): void {
    this.quickView = view;
    if (view === 'MY_TICKETS') {
      this.selectedUser = 'ME';
      this.showTeamTickets = false;
    } else if (view === 'ALL') {
      this.selectedUser = 'ALL';
    }
    this.pageIndex = 0;
  }

  matchesQuickView(task: TaskModel): boolean {
    if (this.quickView === 'ALL') return true;
    const email = (localStorage.getItem('email') || '').toLowerCase();
    const name = (localStorage.getItem('name') || '').toLowerCase();

    if (this.quickView === 'MY_TICKETS') {
      const assigned = (task.assignedToName || '').toLowerCase();
      const hasEmail = !!email && assigned.includes(email);
      const hasName = !!name && assigned.includes(name);
      return Boolean(assigned) && (hasEmail || hasName);
    }
    if (this.quickView === 'REPORTED_BY_ME') {
      const creator = ((task as any).createdBy || (task as any).createdByName || '').toLowerCase();
      const hasEmail = !!email && creator.includes(email);
      const hasName = !!name && creator.includes(name);
      return Boolean(creator) && (hasEmail || hasName);
    }
    if (this.quickView === 'SLA_RISK') {
      return this.isOverdue(task) || this.isDueSoon(task);
    }
    if (this.quickView === 'BLOCKER') {
      const p = (task.priority || '').toUpperCase();
      return p === 'HIGH' || p === 'CRITICAL' || p === 'BLOCKER';
    }
    return true;
  }

  /** Checks whether the task satisfies the selected date range */
  matchesDateFilter(task: TaskModel): boolean {
    if (!this.fromDate && !this.toDate) {
      return true;
    }

    const fromTime = this.fromDate ? new Date(this.fromDate + 'T00:00:00').getTime() : null;
    const toTime = this.toDate ? new Date(this.toDate + 'T23:59:59').getTime() : null;

    if (this.dateField === 'due') {
      if (!task.endDate) return false;
      const dueTime = new Date(task.endDate).getTime();
      if (fromTime !== null && dueTime < fromTime) return false;
      if (toTime !== null && dueTime > toTime) return false;
      return true;
    }

    if (this.dateField === 'start') {
      if (!task.startDate) return false;
      const startTime = new Date(task.startDate).getTime();
      if (fromTime !== null && startTime < fromTime) return false;
      if (toTime !== null && startTime > toTime) return false;
      return true;
    }

    // Default 'schedule' (active or scheduled in range):
    const taskStart = task.startDate ? new Date(task.startDate + 'T00:00:00').getTime() : null;
    const taskEnd = task.endDate ? new Date(task.endDate + 'T23:59:59').getTime() : (taskStart || null);

    if (fromTime !== null) {
      const latestPoint = taskEnd !== null ? taskEnd : taskStart;
      if (latestPoint !== null && latestPoint < fromTime) {
        return false;
      }
    }

    if (toTime !== null) {
      const earliestPoint = taskStart !== null ? taskStart : taskEnd;
      if (earliestPoint !== null && earliestPoint > toTime) {
        return false;
      }
    }

    return true;
  }

  onFilterChange(): void {
    this.activePreset = '';
    this.pageIndex = 0;
  }

  get hasActiveFilters(): boolean {
    return this.selectedProject !== 'ALL' ||
      this.selectedUser !== 'ALL' ||
      this.showTeamTickets ||
      !!this.fromDate ||
      !!this.toDate ||
      this.priority !== 'ALL' ||
      this.statusFilter !== 'ALL' ||
      !!this.search ||
      this.quickView !== 'ALL';
  }

  resetFilters(): void {
    this.selectedProject = 'ALL';
    this.selectedUser = 'ALL';
    this.showTeamTickets = false;
    this.fromDate = '';
    this.toDate = '';
    this.dateField = 'schedule';
    this.activePreset = '';
    this.quickView = 'ALL';
    this.priority = 'ALL';
    this.statusFilter = 'ALL';
    this.search = '';
    this.pageIndex = 0;
  }

  setDatePreset(preset: 'today' | 'week' | 'month'): void {
    this.activePreset = preset;
    const now = new Date();
    if (preset === 'today') {
      this.fromDate = this.toYmd(now);
      this.toDate = this.toYmd(now);
    } else if (preset === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.fromDate = this.toYmd(monday);
      this.toDate = this.toYmd(sunday);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.fromDate = this.toYmd(firstDay);
      this.toDate = this.toYmd(lastDay);
    }
    this.pageIndex = 0;
  }

  clearDates(): void {
    this.fromDate = '';
    this.toDate = '';
    this.activePreset = '';
    this.pageIndex = 0;
  }

  clearSearch(): void {
    this.search = '';
    this.pageIndex = 0;
  }

  private toYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  get statusColumns(): StatusMeta[] {
    return STATUS_META.length > 0 ? STATUS_META : DEFAULT_STATUS_LIST;
  }

  /** Columns for Kanban Board view (columns side-by-side) */
  get kanbanColumns(): { value: string; label: string; icon: string; badge: string; color: string; tasks: TaskModel[] }[] {
    const visible = this.filteredTasks;
    const colors: Record<string, string> = {
      TODO: '#94a3b8',
      ASSIGNED: '#3b82f6',
      IN_PROGRESS: '#f59e0b',
      IN_REVIEW: '#8b5cf6',
      DONE: '#10b981'
    };
    return this.statusColumns.map((meta) => ({
      ...meta,
      color: colors[meta.value] || '#6366f1',
      tasks: visible.filter((task) => statusMeta(task.status).value === meta.value)
    }));
  }

  /** Sections for horizontal Swimlanes view */
  get groups(): { value: string; label: string; icon: string; badge: string; tasks: TaskModel[] }[] {
    const visible = this.pagedTasks;
    return this.statusColumns.map((meta) => ({
      ...meta,
      tasks: visible.filter((task) => statusMeta(task.status).value === meta.value)
    }));
  }

  /** The slice actually rendered for swimlane view pager */
  get pagedTasks(): TaskModel[] {
    return pageSlice(this.filteredTasks, this.pageIndex, this.pageSize);
  }

  /** One chip per PRIORITY row in app_lookup */
  get priorityCounts(): { key: string; label: string; count: number }[] {
    const list = this.baseScopeTasks;
    return [
      { key: 'ALL', label: 'All', count: list.length },
      ...this.reference.items('PRIORITY').map((item) => ({
        key: item.code.toUpperCase(),
        label: item.label,
        count: this.countByPriority(item.code.toUpperCase())
      }))
    ];
  }

  /** The chip strip for lifecycle states */
  get statusCounts(): { key: string; label: string; count: number }[] {
    const list = this.baseScopeTasks;
    return [
      { key: 'ALL', label: 'All states', count: list.length },
      ...this.statusColumns.map((meta) => ({
        key: meta.value,
        label: meta.label,
        count: list.filter((task) => statusMeta(task.status).value === meta.value).length
      }))
    ];
  }

  get overdueCount(): number {
    const today = new Date().setHours(0, 0, 0, 0);
    return this.baseScopeTasks.filter((task) => task.endDate && new Date(task.endDate).getTime() < today && task.status !== 'DONE').length;
  }

  isOverdue(task: TaskModel): boolean {
    if (!task.endDate || task.status === 'DONE') return false;
    return new Date(task.endDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  isDueSoon(task: TaskModel): boolean {
    if (!task.endDate || task.status === 'DONE') return false;
    const dueTime = new Date(task.endDate).getTime();
    const now = Date.now();
    return dueTime > now && (dueTime - now) <= 24 * 60 * 60 * 1000;
  }

  slaOf(task: TaskModel): SlaStatus {
    return this.ticketService.computeSlaStatus(task);
  }

  priorityMetaOf(task: TaskModel): { code: string; label: string; badgeClass: string } {
    return this.ticketService.priorityPill(task.priority);
  }

  hasDistinctDescription(task: TaskModel): boolean {
    if (!task.description || !task.description.trim()) return false;
    return task.description.trim().toLowerCase() !== task.taskTitle.trim().toLowerCase();
  }

  countByPriority(priority: string): number {
    return this.baseScopeTasks.filter((task) => (task.priority || '').toUpperCase() === priority).length;
  }

  setPriority(priority: string): void {
    this.priority = priority;
    this.pageIndex = 0;
  }

  setStatusFilter(key: string): void {
    this.statusFilter = key;
    this.pageIndex = 0;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  taskModelResponse(): void {
    this.loading = true;
    const token = localStorage.getItem('token');
    const email = localStorage.getItem('email');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<TaskModel[]>('http://localhost:9001/api/assigntasks/register', { headers }).subscribe({
      next: (tasks: TaskModel[]) => {
        this.tasks = tasks || [];
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err: any) => {
        // Fallback to personal assigned endpoint if register fails
        this.http.get<TaskModel[]>(`${this.apiUrl}?email=${email}`, { headers }).subscribe({
          next: (fallbackTasks) => {
            this.tasks = fallbackTasks || [];
            this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredTasks.length, this.pageSize));
            this.loading = false;
          },
          error: (fallbackErr: any) => {
            console.error('Failed to fetch tasks', fallbackErr);
            this.errorMessage = 'Could not load tasks right now.';
            this.loading = false;
          }
        });
      }
    });
  }

  priorityClass(priority: string): string {
    const key = (priority || '').trim().toLowerCase();
    return key ? `is-${key}` : '';
  }

  priorityBadge(priority: string): string {
    return this.reference.badge('PRIORITY', priority);
  }

  priorityLabel(priority: string): string {
    return this.reference.label('PRIORITY', priority) || '—';
  }

  code(task: TaskModel): string {
    return taskCodeOf(task);
  }

  isBug(task: TaskModel): boolean {
    return (task.kind || 'TASK').toUpperCase() === 'BUG' || (task.taskCode || '').startsWith('BUG');
  }

  isProdIssue(task: TaskModel): boolean {
    const k = (task.kind || '').toUpperCase();
    return k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || (task.taskCode || '').startsWith('PROD');
  }

  kindBadge(task: TaskModel): string {
    if (this.isProdIssue(task)) return 'ems-badge--prod';
    return this.isBug(task) ? 'ems-badge--danger' : 'ems-badge--info';
  }

  kindLabel(task: TaskModel): string {
    if (this.isProdIssue(task)) return 'Production Issue';
    return this.isBug(task) ? 'Bug' : 'Ticket';
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter((part) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  attachmentUrl(filename: string): string {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    const clean = filename.replace(/\\/g, '/').split('/').pop() || filename;
    return 'http://localhost:9001/uploads/' + clean;
  }

  openFilePopup(filename: string): void {
    window.open(this.attachmentUrl(filename), '_blank');
  }

  openTicketDetails(task: TaskModel): void {
    const ref = this.dialog.open(TicketDetailDialog, {
      data: { item: task },
      width: '92vw',
      maxWidth: '1150px',
      maxHeight: '92vh'
    });
    ref.afterClosed().subscribe(() => {
      this.taskModelResponse();
    });
  }

  openBugDetails(task: TaskModel): void {
    this.openTicketDetails(task);
  }

  isAssignedToCurrentUser(task: TaskModel): boolean {
    if (!task) return false;

    const currentEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
    const currentName = (localStorage.getItem('name') || '').trim().toLowerCase();
    const currentId = (localStorage.getItem('id') || '').trim();

    // Match assigned developer (by name, email, or id)
    const assignedDev = (task.assignedToName || task.assignedTo || '').trim().toLowerCase();
    const isDevMatch = !!assignedDev && (
      (!!currentEmail && (assignedDev === currentEmail || assignedDev.includes(currentEmail))) ||
      (!!currentName && (assignedDev === currentName || assignedDev.includes(currentName) || currentName.includes(assignedDev))) ||
      (!!currentId && String(task.assignedTo).trim() === currentId)
    );

    // Match assigned QA tester (by name, email, or id)
    const assignedTesterEmail = (task.assignedTesterEmail || '').trim().toLowerCase();
    const assignedTesterName = (task.assignedTesterName || '').trim().toLowerCase();
    const testerId = String((task as any).assignedTesterId || '').trim();

    const isTesterMatch =
      (!!currentEmail && (
        (!!assignedTesterEmail && (assignedTesterEmail === currentEmail || assignedTesterEmail.includes(currentEmail))) ||
        (!!assignedTesterName && (assignedTesterName === currentEmail || assignedTesterName.includes(currentEmail)))
      )) ||
      (!!currentName && (
        (!!assignedTesterName && (assignedTesterName === currentName || assignedTesterName.includes(currentName) || currentName.includes(assignedTesterName)))
      )) ||
      (!!currentId && testerId === currentId);

    return isDevMatch || isTesterMatch;
  }

  canEditStatus(task: TaskModel): boolean {
    if (!task) return false;

    // RBAC: Check dynamic Edit permission for Ticket Board
    if (!this.rolePermissionService.hasPermission('TICKET_BOARD', 'edit')) {
      return false;
    }

    // Super Admin, Project Manager, or Team Leads maintain management authority to move any ticket
    if (this.isSuperAdmin || this.isManager) {
      return true;
    }

    // Only the assigned user (developer or tester) can modify status
    return this.isAssignedToCurrentUser(task);
  }

  statusTooltip(task: TaskModel): string {
    if (!this.rolePermissionService.hasPermission('TICKET_BOARD', 'edit')) {
      return 'Editing / status updates are restricted for your role';
    }
    if (this.canEditStatus(task)) {
      return 'Click to update workflow status';
    }
    const owner = task.assignedToName || task.assignedTo || task.assignedTesterName || 'another team member';
    return `Assigned to ${owner}. Only the assigned owner can change status.`;
  }

  onStatusChanged(task: TaskModel, status: string): void {
    task.status = status;
    // Re-assign tasks array to trigger immediate change detection and column repositioning
    this.tasks = [...this.tasks];
  }

  onReopened(task: TaskModel, event: { note: string }): void {
    task.reopenCount = (Number(task.reopenCount) || 0) + 1;
    task.lastReopenNote = event.note;
    this.tasks = [...this.tasks];
  }
}
