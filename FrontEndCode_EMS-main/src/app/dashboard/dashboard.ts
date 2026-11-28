import { Component, OnInit } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { roleLabel, isSuperAdminRole } from '../models/role';
import { RolePermissionService } from '../services/role-permission.service';
import { QuickActions } from '../quick-actions/quick-actions';

export interface ProjectHealthRow {
  id: number;
  name: string;
  description?: string;
  taskCount: number;
  doneCount: number;
  overdueCount: number;
  progress: number;
  health: 'ON_TRACK' | 'AT_RISK' | 'DELAYED';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    RouterModule,
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    MatCardModule,
    CommonModule,
    MatDialogModule,
    MatListModule,
    MatTooltipModule,
    QuickActions
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  user: any = {};
  loading = true;
  errorMessage = '';

  teamSize = 0;
  projects: any[] = [];
  tasks: any[] = [];
  timesheets: any[] = [];

  today = new Date();

  constructor(
    private http: HttpClient,
    private Router: Router,
    private dialog: MatDialog,
    private rolePermissionService: RolePermissionService
  ) {}

  ngOnInit(): void {
    this.loadUserProfile();
    this.loadWorkspace();
  }

  get rawRole(): string {
    return (localStorage.getItem('role') || '').trim().toUpperCase();
  }

  get isProjectManager(): boolean {
    return this.rawRole === 'PROJECT_MANAGER';
  }

  get isSuperAdmin(): boolean {
    return isSuperAdminRole(this.rawRole);
  }

  get userRole(): string {
    return roleLabel(this.rawRole);
  }

  get displayName(): string {
    return this.user?.username || localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  }

  get firstName(): string {
    return (this.displayName || '').split(' ')[0] || this.displayName;
  }

  get avatarUrl(): string {
    return this.user?.registerImage
      ? `http://localhost:9001/attachments/${this.user.registerImage}`
      : '';
  }

  get initials(): string {
    return (this.displayName || 'U')
      .split(' ')
      .filter((part: string) => !!part)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('');
  }

  get projectCount(): number { return this.projects.length; }
  get openTaskCount(): number { return this.tasks.filter((t) => t.status !== 'DONE').length; }
  get doneTaskCount(): number { return this.tasks.filter((t) => t.status === 'DONE').length; }
  get inProgressCount(): number { return this.tasks.filter((t) => t.status === 'IN_PROGRESS').length; }
  get todoCount(): number { return this.tasks.filter((t) => t.status === 'TODO').length; }
  get inReviewCount(): number {
    return this.tasks.filter((t) => t.status === 'IN_REVIEW' || t.status === 'QA_READY' || t.status === 'TESTING').length;
  }

  get totalHours(): number {
    return this.timesheets.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
  }

  get completionRate(): number {
    return this.tasks.length ? Math.round((this.doneTaskCount / this.tasks.length) * 100) : 0;
  }

  get overdueTasks(): any[] {
    const now = new Date();
    return this.tasks
      .filter((t) => {
        if (t.status === 'DONE') return false;
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return !isNaN(d.getTime()) && d < now;
      })
      .slice(0, 5);
  }

  get blockedOrCriticalTasks(): any[] {
    return this.tasks
      .filter((t) => {
        if (t.status === 'DONE') return false;
        return t.status === 'ON_HOLD' || t.priority === 'High' || t.priority === 'Critical';
      })
      .slice(0, 5);
  }

  get pendingTimesheets(): any[] {
    return this.timesheets
      .filter((t) => t.status === 'PENDING' || !t.status)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  get projectRows(): ProjectHealthRow[] {
    const now = new Date();
    return this.projects.map((project) => {
      const projectTasks = this.tasks.filter(
        (task) => task.project?.id === project.id || task.projectId === project.id
      );
      const done = projectTasks.filter((task) => task.status === 'DONE').length;
      const overdue = projectTasks.filter((task) => {
        if (task.status === 'DONE') return false;
        if (!task.dueDate) return false;
        const d = new Date(task.dueDate);
        return !isNaN(d.getTime()) && d < now;
      }).length;
      const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

      let health: 'ON_TRACK' | 'AT_RISK' | 'DELAYED' = 'ON_TRACK';
      if (overdue > 0) {
        health = 'DELAYED';
      } else if (progress < 25 && projectTasks.length > 3) {
        health = 'AT_RISK';
      }

      return {
        ...project,
        taskCount: projectTasks.length,
        doneCount: done,
        overdueCount: overdue,
        progress,
        health
      };
    });
  }

  get healthSummary() {
    const rows = this.projectRows;
    return {
      onTrack: rows.filter((r) => r.health === 'ON_TRACK').length,
      atRisk: rows.filter((r) => r.health === 'AT_RISK').length,
      delayed: rows.filter((r) => r.health === 'DELAYED').length
    };
  }

  get workflowStages() {
    const total = this.tasks.length || 1;
    return [
      {
        key: 'TODO',
        label: 'Intake & Backlog',
        count: this.todoCount,
        percent: Math.round((this.todoCount / total) * 100),
        color: '#64748b',
        icon: 'pending_actions'
      },
      {
        key: 'IN_PROGRESS',
        label: 'In Development',
        count: this.inProgressCount,
        percent: Math.round((this.inProgressCount / total) * 100),
        color: '#3b82f6',
        icon: 'code'
      },
      {
        key: 'IN_REVIEW',
        label: 'QA Verification',
        count: this.inReviewCount,
        percent: Math.round((this.inReviewCount / total) * 100),
        color: '#f59e0b',
        icon: 'bug_report'
      },
      {
        key: 'DONE',
        label: 'Released & Done',
        count: this.doneTaskCount,
        percent: Math.round((this.doneTaskCount / total) * 100),
        color: '#10b981',
        icon: 'check_circle'
      }
    ];
  }

  get recentTimesheets(): any[] {
    return [...this.timesheets]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 6);
  }

  openHelpDialog(templateRef: any) {
    this.dialog.open(templateRef, { width: '560px', maxWidth: '92vw' });
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);
  }

  loadUserProfile(): void {
    const username = localStorage.getItem('email');
    if (!username) {
      return;
    }

    this.http.get(
      `http://localhost:9001/api/UserProfile/userdetails?username=${encodeURIComponent(username)}`,
      { headers: this.authHeaders() }
    ).subscribe({
      next: (data: any) => { this.user = data; },
      error: (err) => console.error('Failed to load profile:', err)
    });
  }

  loadWorkspace(): void {
    this.loading = true;
    this.errorMessage = '';
    let degraded = false;

    const guarded = <T>(source: Observable<T>, fallback: T, label: string): Observable<T> =>
      source.pipe(
        catchError((err: any) => {
          console.error(`Failed to load ${label}:`, err);
          degraded = true;
          return of(fallback);
        })
      );

    forkJoin({
      team: guarded<number>(this.http.get<number>('http://localhost:9001/api/auth/totalEmployees', { headers: this.authHeaders() }), 0, 'team size'),
      projects: guarded<any[]>(this.http.get<any[]>('http://localhost:9001/api/projects', { headers: this.authHeaders() }), [], 'projects'),
      tasks: guarded<any[]>(this.http.get<any[]>('http://localhost:9001/api/tasks', { headers: this.authHeaders() }), [], 'tasks'),
      timesheets: guarded<any[]>(this.http.get<any[]>('http://localhost:9001/api/timesheets', { headers: this.authHeaders() }), [], 'timesheets')
    }).subscribe({
      next: ({ team, projects, tasks, timesheets }) => {
        this.teamSize = Number(team) || 0;
        this.projects = projects || [];
        this.tasks = tasks || [];
        this.timesheets = timesheets || [];
        this.errorMessage = degraded ? 'Some dashboard metrics could not be loaded. Please ensure services are active.' : '';
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load dashboard data:', err);
        this.errorMessage = 'Some dashboard data could not be loaded.';
        this.loading = false;
      }
    });
  }

  onLogout(): void {
    this.rolePermissionService.clearPermissions();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('taskManager');
    localStorage.removeItem('ems_role_permissions');
    localStorage.removeItem('ems_role_permissions_role');
    this.Router.navigate(['/login']);
  }
}
