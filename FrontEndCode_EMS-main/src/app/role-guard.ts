import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { isManagerRole } from './models/role';

/**
 * Second gate behind AuthGuard: it makes the five identities genuinely
 * different.
 *
 * Routes declare who may enter via `data.roles` - a list of role codes, so a
 * team leader has to be named explicitly rather than inheriting the page from
 * their team. A route without the key is open to any signed-in role. When a
 * role is refused it is sent to its own home page instead of seeing a blank
 * router outlet.
 */
@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  constructor(private router: Router, private snackBar: MatSnackBar) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const allowed = (route.data?.['roles'] as string[] | undefined) ?? [];
    const role = (localStorage.getItem('role') || '').trim().toUpperCase();

    if (allowed.length > 0 && !allowed.includes(role)) {
      this.refuse(role, 'Your role does not have access to that page.');
      return false;
    }

    // Task management is the one right that also lives inside a role: a plain
    // tester holds it only while an administrator keeps the provision switched
    // on for that account. The CEO and the team leaders hold it by their role,
    // which is why they never need a provision.
    const access = route.data?.['access'] as string | undefined;
    if (access === 'taskManager' && !RoleGuard.managesTasks(role)) {
      this.refuse(role, 'An administrator has not given you task access.');
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

  private refuse(role: string, message: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'bottom'
    });
    this.router.navigate([RoleGuard.homeFor(role)]);
  }

  /** Landing page per role, shared with the login redirect. */
  static homeFor(role: string): string {
    switch ((role || '').trim().toUpperCase()) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/dashboard';
      case 'TESTER':
      case 'TESTER_LEAD':
        return '/tester-board';
      default:
        return '/developer-board';
    }
  }
}
