import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, map, of } from 'rxjs';
import { isManagerRole, isSuperAdminRole } from './models/role';
import { RolePermissionService } from './services/role-permission.service';

/**
 * Gatekeeper enforcing dynamic Role-Based Screen Access Control.
 * Ensures that if a screen is restricted for a particular role, users assigned to that role
 * are strictly blocked from accessing it via direct URL or in-app navigation.
 */
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(
    private router: Router,
    private snackBar: MatSnackBar,
    private rolePermissionService: RolePermissionService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state?: RouterStateSnapshot): boolean | Observable<boolean> {
    if (!this.rolePermissionService.isLoaded()) {
      return this.rolePermissionService.ensurePermissionsLoaded().pipe(
        map(() => this.checkAccess(route, state))
      );
    }
    return this.checkAccess(route, state);
  }

  private checkAccess(route: ActivatedRouteSnapshot, state?: RouterStateSnapshot): boolean {
    const rawRole = (localStorage.getItem('role') || '').trim().toUpperCase();
    const role = this.rolePermissionService.normalizeRole(rawRole);

    const allowed = (route.data?.['roles'] as string[] | undefined) ?? [];
    if (allowed.length > 0) {
      const normAllowed = allowed.map((r) => this.rolePermissionService.normalizeRole(r));
      if (!allowed.includes(rawRole) && !normAllowed.includes(role)) {
        this.refuse(role, 'Your role does not have access to that page.');
        return false;
      }
    }

    // Task management provision check
    const access = route.data?.['access'] as string | undefined;
    if (access === 'taskManager' && !RoleGuard.managesTasks(role)) {
      this.refuse(role, 'An administrator has not given you task access.');
      return false;
    }

    // Resolve target path and role-effective screenId
    const targetPath = (state?.url || ('/' + route.url.map((s) => s.path).join('/'))).split(/[?#]/)[0];
    let screenId = route.data?.['screenId'] as string | undefined;
    const effectiveScreen = this.rolePermissionService.getEffectiveScreenIdForRoute(targetPath, role);
    if (effectiveScreen) {
      screenId = effectiveScreen;
    }

    // Dynamic screen-level permission check
    if (screenId && !this.rolePermissionService.isScreenAllowed(screenId)) {
      this.refuse(role, 'Access to this screen has been restricted for your role.');
      return false;
    }

    // Dynamic route access control
    if (targetPath !== '/' && !this.rolePermissionService.canAccessRoute(targetPath)) {
      this.refuse(role, 'Access to this screen has been restricted for your role.');
      return false;
    }

    return true;
  }

  /** Whether the signed-in account may create, edit and delete tasks. */
  static managesTasks(role?: string): boolean {
    const current = (role || localStorage.getItem('role') || '').trim().toUpperCase();
    if (isManagerRole(current)) {
      return true;
    }
    return current === 'TESTER' && localStorage.getItem('taskManager') === 'true';
  }

  getSafeLandingRoute(role: string): string {
    const normRole = this.rolePermissionService.normalizeRole(role);
    const defaultHome = RoleGuard.homeFor(normRole);
    if (this.rolePermissionService.canAccessRoute(defaultHome)) {
      return defaultHome;
    }

    // Role-tailored candidate landing routes in preference order
    const candidatesByRole: Record<string, string[]> = {
      SUPER_ADMIN: ['/dashboard', '/projects', '/tasks', '/audit-logs', '/role-access'],
      PROJECT_MANAGER: ['/dashboard', '/projects', '/hierarchy', '/my-projects', '/timesheets/approvals', '/profile'],
      TEAM_LEAD: ['/triage', '/developer-board', '/approvals', '/tasks', '/developer-completed', '/tested-completed', '/my-tasks', '/profile'],
      DEVELOPER_LEAD: ['/developer-board', '/tasks', '/triage', '/developer-completed', '/my-tasks', '/profile'],
      EMPLOYEE: ['/developer-board', '/my-tasks', '/tasks', '/developer-completed', '/my-projects', '/profile'],
      TESTER_LEAD: ['/tester-board', '/testing-lead-dashboard', '/approvals', '/tasks', '/my-tasks', '/profile'],
      TESTER: ['/tester-board', '/my-submissions', '/issues/new', '/tasks', '/my-tasks', '/profile']
    };

    const candidates = candidatesByRole[normRole] || ['/profile'];
    for (const candidate of candidates) {
      if (this.rolePermissionService.canAccessRoute(candidate)) {
        return candidate;
      }
    }
    return '/profile';
  }

  private refuse(role: string, message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
    const safeHome = this.getSafeLandingRoute(role);
    this.router.navigate([safeHome]);
  }

  /** Landing page per role, shared with the login redirect. */
  static homeFor(role: string): string {
    switch ((role || '').trim().toUpperCase()) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
      case 'PROJECT_MANAGER':
        return '/dashboard';
      case 'TEAM_LEAD':
      case 'TEAM_LEADER':
        return '/triage';
      case 'TESTER':
      case 'TESTER_LEAD':
        return '/tester-board';
      default:
        return '/developer-board';
    }
  }
}
