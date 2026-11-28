import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import {
  RoleOption,
  RolePermissionConfig,
  ScreenDefinition,
  ScreenPermissionItem
} from '../models/role-permission';
import { isSuperAdminRole } from '../models/role';

@Injectable({
  providedIn: 'root'
})
export class RolePermissionService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:9001/api/role-permissions';

  /** Cached accessible routes map for the current user's role (route -> allowed) */
  readonly accessibleRoutes = signal<Record<string, boolean>>({});

  /** Cached granular permission items for the current user's role */
  readonly currentRolePermissions = signal<ScreenPermissionItem[]>([]);

  /** Whether permissions have been successfully loaded for the current session */
  readonly isLoaded = signal<boolean>(false);

  /** Roles configurable by Admin */
  readonly availableRoles: RoleOption[] = [
    {
      code: 'SUPER_ADMIN',
      label: 'Super Admin',
      description: 'System-wide administrator with full control over all modules and settings',
      icon: 'workspace_premium',
      badgeClass: 'ems-badge--warning'
    },
    {
      code: 'PROJECT_MANAGER',
      label: 'Project Manager',
      description: 'Manages projects, deliverables, team allocations, and timesheets',
      icon: 'engineering',
      badgeClass: 'ems-badge--info'
    },
    {
      code: 'TEAM_LEAD',
      label: 'Team Leader',
      description: 'Oversees sprint execution, allocates work, triages bugs, reviews dev/QA completions, and approves timesheets',
      icon: 'groups',
      badgeClass: 'ems-badge--info'
    },
    {
      code: 'EMPLOYEE',
      label: 'Software Developer',
      description: 'Builds assigned features, fixes bugs, and submits daily timesheets',
      icon: 'code',
      badgeClass: 'ems-badge--neutral'
    },
    {
      code: 'TESTER_LEAD',
      label: 'QA Team Lead',
      description: 'Triages bug reports, coordinates QA releases, and assigns verification suites',
      icon: 'groups',
      badgeClass: 'ems-badge--info'
    },
    {
      code: 'TESTER',
      label: 'QA Engineer',
      description: 'Executes test cases, logs bug submissions, and verifies resolved issues',
      icon: 'bug_report',
      badgeClass: 'ems-badge--neutral'
    }
  ];

  constructor() {
    this.hydrateFromStorage();
    this.refreshCurrentUserPermissions().subscribe();
  }

  /**
   * Normalizes role representations (e.g. legacy ADMIN -> SUPER_ADMIN, DEVELOPER_LEAD -> TEAM_LEAD).
   */
  normalizeRole(role?: string | null): string {
    const r = String(role || '').trim().toUpperCase();
    if (r === 'ADMIN') return 'SUPER_ADMIN';
    if (r === 'TEAM_LEADER' || r === 'DEVELOPER_LEAD') return 'TEAM_LEAD';
    return r;
  }

  /**
   * Hydrates local permissions cache from localStorage for instant zero-latency UI rendering.
   * Only hydrates if the cached permissions belong to the CURRENT active role.
   */
  private hydrateFromStorage(): void {
    try {
      const currentRole = this.normalizeRole(localStorage.getItem('role'));
      const cachedRole = localStorage.getItem('ems_role_permissions_role');
      if (currentRole && cachedRole === currentRole) {
        const cached = localStorage.getItem('ems_role_permissions');
        if (cached) {
          const items = JSON.parse(cached) as ScreenPermissionItem[];
          if (Array.isArray(items) && items.length > 0) {
            this.applyPermissions(items, false);
          }
        }
      } else {
        this.clearPermissions();
      }
    } catch (e) {
      console.warn('Could not read cached permissions:', e);
    }
  }

  /**
   * Applies permission list into signals and updates routes accessibility map.
   */
  private applyPermissions(items: ScreenPermissionItem[], persist: boolean = true): void {
    this.currentRolePermissions.set(items);

    const currentRole = this.normalizeRole(localStorage.getItem('role'));
    const routeMap: Record<string, boolean> = {};
    for (const item of items) {
      if (item.route) {
        // Resolve whether this screen belongs to this role on this route
        const effectiveForRoute = this.getEffectiveScreenIdForRoute(item.route, currentRole);
        if (effectiveForRoute && effectiveForRoute !== item.screenId) {
          // Skip mapping the route from this non-applicable screen
          continue;
        }
        const prev = routeMap[item.route];
        routeMap[item.route] = prev !== undefined ? prev || item.allowed : item.allowed;
      }
    }
    this.accessibleRoutes.set(routeMap);
    this.isLoaded.set(true);

    if (persist) {
      try {
        localStorage.setItem('ems_role_permissions', JSON.stringify(items));
        if (currentRole) {
          localStorage.setItem('ems_role_permissions_role', currentRole);
        }
      } catch (_) {}
    }
  }

  /**
   * Guarantees permissions are loaded from backend before evaluating route guards.
   */
  ensurePermissionsLoaded(): Observable<RolePermissionConfig | null> {
    if (this.isLoaded()) {
      return of(null);
    }
    return this.refreshCurrentUserPermissions();
  }

  /**
   * Resolves the effective screenId for routes that represent different screens based on user role.
   */
  getEffectiveScreenIdForRoute(routePath: string, role?: string): string | null {
    const cleanPath = (routePath || '').split(/[?#]/)[0].trim();
    const currentRole = this.normalizeRole(role || localStorage.getItem('role'));

    if (cleanPath === '/developer-completed') {
      return currentRole === 'EMPLOYEE' ? 'MY_COMPLETED_TICKETS_DEV' : 'DEV_COMPLETED_TICKETS';
    }
    if (cleanPath === '/tasks/all') {
      return isSuperAdminRole(currentRole) ? 'TICKET_HUB' : 'ALL_TICKETS';
    }
    return null;
  }

  /**
   * Refreshes the active user's permissions and accessible routes from backend.
   * Strictly respects configured permissions for ALL roles, including Super Admin / Admin.
   */
  refreshCurrentUserPermissions(): Observable<RolePermissionConfig | null> {
    const rawRole = (localStorage.getItem('role') || '').trim().toUpperCase();
    if (!rawRole) {
      this.accessibleRoutes.set({});
      this.currentRolePermissions.set([]);
      this.isLoaded.set(true);
      return of(null);
    }

    const role = this.normalizeRole(rawRole);

    return this.getConfigForRole(role).pipe(
      tap((config) => {
        if (config && config.permissions) {
          let items = config.permissions;
          // Auto-heal legacy 2-screen state for TEAM_LEAD if encountered on sign-in
          if (role === 'TEAM_LEAD' && items.filter((p) => p.allowed).length <= 2) {
            const teamLeadDefaultSet = new Set([
              'DEVELOPER_BOARD', 'TESTER_BOARD', 'DEV_TEAM_ASSIGNMENT', 'TESTING_REVIEW',
              'DEV_COMPLETED_TICKETS', 'ON_HOLD_TICKETS', 'TESTED_COMPLETED_REVIEW', 'MY_TICKETS',
              'TICKET_BOARD', 'ALL_TICKETS', 'PROJECT_OVERVIEW', 'TEAM_HIERARCHY', 'MY_PROJECTS',
              'SUBMIT_TIMESHEET', 'MY_TIMESHEETS', 'TIMESHEET_APPROVALS', 'TIMESHEET_REPORTS',
              'USER_PROFILE', 'SETTINGS'
            ]);
            items = items.map((p) => {
              const isAllowed = teamLeadDefaultSet.has(p.screenId);
              return {
                ...p,
                allowed: isAllowed,
                canView: isAllowed,
                canEdit: isAllowed,
                canExport: isAllowed,
                canDelete: false
              };
            });
            this.saveConfigForRole('TEAM_LEAD', items).subscribe();
          }
          this.applyPermissions(items, true);
        }
      }),
      catchError((err) => {
        console.warn('Could not fetch role permissions from server, using local defaults:', err);
        this.isLoaded.set(true);
        return of(null);
      })
    );
  }

  /**
   * Clears cached role permissions upon user logout.
   */
  clearPermissions(): void {
    this.accessibleRoutes.set({});
    this.currentRolePermissions.set([]);
    this.isLoaded.set(false);
    try {
      localStorage.removeItem('ems_role_permissions');
      localStorage.removeItem('ems_role_permissions_role');
    } catch (_) {}
  }

  /**
   * Checks whether a screen is permitted for the active role.
   * If screenId is restricted, returns false immediately for that role.
   */
  isScreenAllowed(screenId?: string): boolean {
    if (!screenId) return true;

    // Safety guard: Super Admin retains access to the permission configuration screen itself
    if (screenId === 'ROLE_ACCESS_CONFIG' || screenId === 'USER_PROFILE' || screenId === 'SETTINGS') {
      const role = (localStorage.getItem('role') || '').trim().toUpperCase();
      if (isSuperAdminRole(role)) {
        return true;
      }
    }

    const items = this.currentRolePermissions();
    if (items.length === 0) {
      return true;
    }

    const item = items.find(
      (p) => p.screenId === screenId || (p.screenId && p.screenId.toUpperCase() === screenId.toUpperCase())
    );
    if (!item) {
      return true; // Screen not in catalogue
    }
    return item.allowed !== false;
  }

  /**
   * Checks whether the current user is allowed to access the specified route path.
   */
  canAccessRoute(routePath: string): boolean {
    const cleanPath = (routePath || '').split(/[?#]/)[0].trim();
    if (!cleanPath || cleanPath === '/' || cleanPath === '/login' || cleanPath === '/register' || cleanPath === '/profile' || cleanPath === '/settings') {
      return true;
    }

    // Safety guard: Super Admin can always access the Role Access screen
    const role = (localStorage.getItem('role') || '').trim().toUpperCase();
    if (isSuperAdminRole(role) && (cleanPath === '/role-access' || cleanPath.startsWith('/role-access/'))) {
      return true;
    }

    // Direct effective screen check for dual-purpose routes
    const effectiveScreen = this.getEffectiveScreenIdForRoute(cleanPath, role);
    if (effectiveScreen) {
      return this.isScreenAllowed(effectiveScreen);
    }

    const map = this.accessibleRoutes();
    if (Object.keys(map).length === 0) {
      return true;
    }

    // Direct route match
    if (map[cleanPath] !== undefined) {
      return map[cleanPath];
    }

    // Check parent path match (e.g. /tasks/all -> /tasks)
    for (const configuredRoute of Object.keys(map)) {
      if (cleanPath.startsWith(configuredRoute + '/')) {
        return map[configuredRoute];
      }
    }

    return true;
  }

  /**
   * Comprehensive granular permission checker for UI actions:
   * View, Add/Create, Edit/Update, Delete, Export
   */
  hasPermission(
    screenId: string,
    action: 'view' | 'add' | 'create' | 'edit' | 'update' | 'delete' | 'export'
  ): boolean {
    // Safety guard: Super Admin always retains authority over Role Access Configuration
    if (screenId === 'ROLE_ACCESS_CONFIG') {
      const role = (localStorage.getItem('role') || '').trim().toUpperCase();
      if (isSuperAdminRole(role)) {
        return true;
      }
    }

    const items = this.currentRolePermissions();
    if (items.length === 0) {
      return true;
    }

    const item = items.find(
      (p) => p.screenId === screenId || (p.screenId && p.screenId.toUpperCase() === screenId.toUpperCase())
    );
    if (!item) {
      return true;
    }

    // If screen access is disabled, all sub-actions are restricted!
    if (!item.allowed) {
      return false;
    }

    switch (action) {
      case 'view':
        return item.canView !== false;
      case 'add':
      case 'create':
      case 'edit':
      case 'update':
        return item.canEdit === true;
      case 'delete':
        return item.canDelete === true;
      case 'export':
        return item.canExport === true;
      default:
        return false;
    }
  }

  canView(screenId: string): boolean {
    return this.hasPermission(screenId, 'view');
  }

  canAdd(screenId: string): boolean {
    return this.hasPermission(screenId, 'add');
  }

  canEdit(screenId: string): boolean {
    return this.hasPermission(screenId, 'edit');
  }

  canDelete(screenId: string): boolean {
    return this.hasPermission(screenId, 'delete');
  }

  canExport(screenId: string): boolean {
    return this.hasPermission(screenId, 'export');
  }

  /* ================= ADMIN CONFIGURATION API ================= */

  /**
   * Master catalogue of all system screens.
   */
  getAllScreens(): Observable<ScreenDefinition[]> {
    return this.http.get<ScreenDefinition[]>(`${this.apiUrl}/screens`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Retrieve all role configurations (Super Admin only).
   */
  getAllConfigs(): Observable<RolePermissionConfig[]> {
    return this.http.get<RolePermissionConfig[]>(this.apiUrl, {
      headers: this.getHeaders()
    });
  }

  /**
   * Retrieve configuration for a specific role.
   */
  getConfigForRole(rawRole: string): Observable<RolePermissionConfig> {
    const role = this.normalizeRole(rawRole);
    return this.http.get<RolePermissionConfig>(`${this.apiUrl}/${encodeURIComponent(role)}`, {
      headers: this.getHeaders()
    });
  }

  /**
   * Save updated permissions for a role.
   */
  saveConfigForRole(rawRole: string, items: ScreenPermissionItem[]): Observable<RolePermissionConfig> {
    const normTargetRole = this.normalizeRole(rawRole);
    return this.http
      .put<RolePermissionConfig>(`${this.apiUrl}/${encodeURIComponent(normTargetRole)}`, items, {
        headers: this.getHeaders()
      })
      .pipe(
        tap((savedConfig) => {
          const currentRole = this.normalizeRole(localStorage.getItem('role'));
          // If the logged-in role was the one updated, apply updates to signals immediately!
          if (currentRole === normTargetRole) {
            const freshItems = savedConfig?.permissions || items;
            this.applyPermissions(freshItems, true);
          }
        })
      );
  }

  /**
   * Reset role permissions to system defaults.
   */
  resetRoleToDefault(rawRole: string): Observable<RolePermissionConfig> {
    const normTargetRole = this.normalizeRole(rawRole);
    return this.http
      .post<RolePermissionConfig>(`${this.apiUrl}/reset/${encodeURIComponent(normTargetRole)}`, {}, {
        headers: this.getHeaders()
      })
      .pipe(
        tap((resetConfig) => {
          const currentRole = this.normalizeRole(localStorage.getItem('role'));
          if (currentRole === normTargetRole && resetConfig?.permissions) {
            this.applyPermissions(resetConfig.permissions, true);
          }
        })
      );
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
