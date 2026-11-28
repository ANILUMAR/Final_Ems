import { Component, OnInit, inject } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { roleLabel, isSuperAdminRole } from '../../models/role';
import { ThemeService } from '../../services/theme.service';
import { RolePermissionService } from '../../services/role-permission.service';
import { NavigationPreferenceService } from '../../services/navigation-preference.service';
import { LocalAvatarService } from '../../services/local-avatar.service';
import {
  NAV_GROUPS,
  NavGroup,
  NavItem,
  isNavItemVisible,
  groupHasVisibleItems
} from '../../models/navigation';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    CommonModule,
    RouterModule
  ],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header implements OnInit {
  user: any;

  readonly navPref = inject(NavigationPreferenceService);
  private avatarService = inject(LocalAvatarService);

  /** Shared navigation groups catalog */
  groups: NavGroup[] = NAV_GROUPS;

  constructor(
    private http: HttpClient,
    private Router: Router,
    private themeService: ThemeService,
    private rolePermissionService: RolePermissionService
  ) {}

  ngOnInit(): void {
    if (localStorage.getItem('email')) {
      this.loadUserProfile();
    }
  }

  get role(): string {
    return this.rolePermissionService.normalizeRole(
      this.user?.role || localStorage.getItem('role') || 'Member'
    );
  }

  /**
   * Evaluates if a navigation item is permitted for the active user's role.
   */
  isVisible(item: NavItem): boolean {
    this.rolePermissionService.currentRolePermissions();
    return isNavItemVisible(item, this.role, this.rolePermissionService);
  }

  /**
   * Checks if a group contains at least one authorized item.
   */
  groupHasItems(group: NavGroup): boolean {
    return groupHasVisibleItems(group, this.role, this.rolePermissionService);
  }

  /**
   * Returns list of authorized items in a group.
   */
  visibleItems(group: NavGroup): NavItem[] {
    return group.items.filter((item) => this.isVisible(item));
  }

  /**
   * Checks if any screen in the module group matches the active page URL.
   */
  groupHasActiveRoute(group: NavGroup): boolean {
    const currentUrl = (this.Router.url || '').split(/[?#]/)[0];
    return group.items.some((item) => {
      if (!this.isVisible(item)) return false;
      return currentUrl === item.route || currentUrl.startsWith(item.route + '/');
    });
  }

  /**
   * Checks if an individual item matches the active page URL.
   */
  isActive(item: NavItem): boolean {
    const currentUrl = (this.Router.url || '').split(/[?#]/)[0];
    return currentUrl === item.route;
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  get displayName(): string {
    return this.user?.username || localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  }

  get displayRole(): string {
    return roleLabel(this.user?.role || localStorage.getItem('role') || 'Member');
  }

  get userInitials(): string {
    return (this.displayName || 'U')
      .split(' ')
      .filter((part: string) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  get avatarUrl(): string {
    return this.avatarService.getAvatarUrl(
      this.user?.registerImage,
      this.user?.role || localStorage.getItem('role'),
      this.displayName
    );
  }

  onAvatarError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.avatarService.getDefaultAvatarForRole(
        this.user?.role || localStorage.getItem('role')
      );
    }
  }

  pageTitle(): string {
    const url = this.Router.url.split('?')[0];
    const titles: { [key: string]: string } = {
      '/dashboard': 'Executive Dashboard',
      '/developer-board': 'Development Board',
      '/developer-completed': 'Pending QA Release',
      '/completed-tasks': 'Completed Work Items',
      '/on-hold-tasks': 'On-Hold Tickets',
      '/tester-board': 'QA Testing Board',
      '/testing-lead-dashboard': 'QA Lead Dashboard',
      '/my-tasks': 'My Assigned Tickets',
      '/tasks': 'Kanban Board',
      '/tasks/all': isSuperAdminRole(this.user?.role || localStorage.getItem('role') || '') ? 'Ticket Hub' : 'All Tickets Registry',
      '/issues/new': 'Create Issue',
      '/my-submissions': 'My Reported Issues',
      '/review-list': 'QA Bug Triage',
      '/approvals': 'QA Bug Triage',
      '/team-assignment': 'Work Allocation',
      '/triage': 'Work Allocation',
      '/tested-completed': 'QA Verification Sign-off',
      '/projects': 'Projects Overview',
      '/my-projects': 'My Projects',
      '/hierarchy': 'Project Teams & Hierarchy',
      '/people/accounts': 'Employee Directory',
      '/timesheets/new': 'Log Time',
      '/timesheets/my': 'My Timesheet History',
      '/timesheets/approvals': 'Timesheet Approvals',
      '/timesheets': 'Timesheet Reports',
      '/role-access': 'Role Permissions (RBAC)',
      '/profile': 'My Profile',
      '/settings': 'System Settings',
      '/masters': 'Module & Screen Master',
      '/audit-logs': 'Audit Logs'
    };
    return titles[url] || 'Workspace';
  }

  loadUserProfile(): void {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('email');

    if (!username) {
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const url = `http://localhost:9001/api/UserProfile/userdetails?username=${encodeURIComponent(username)}`;

    this.http.get(url, { headers }).subscribe({
      next: (data: any) => {
        this.user = data;
        if (data?.username) { localStorage.setItem('name', data.username); }
        if (data?.role) { localStorage.setItem('role', data.role); }
      },
      error: (err: any) => {
        console.error('Failed to load profile:', err);
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
