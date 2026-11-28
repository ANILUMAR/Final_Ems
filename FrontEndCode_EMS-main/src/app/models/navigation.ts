import { RoleGuard } from '../role-guard';
import { RolePermissionService } from '../services/role-permission.service';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  screenId?: string;
  queryParams?: Record<string, string>;
  roles?: string[];
  /** Extra right inside the role: a plain tester needs the admin's provision to manage tasks. */
  access?: 'taskManager';
}

export interface NavGroup {
  title: string;
  icon: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    icon: 'space_dashboard',
    items: [
      { label: 'Executive Dashboard', icon: 'space_dashboard', route: '/dashboard', screenId: 'DASHBOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] },
      { label: 'Development Board', icon: 'code', route: '/developer-board', screenId: 'DEVELOPER_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] },
      { label: 'QA Testing Board', icon: 'bug_report', route: '/tester-board', screenId: 'TESTER_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD', 'TESTER'] },
      { label: 'QA Lead Dashboard', icon: 'rule', route: '/testing-lead-dashboard', screenId: 'TESTING_LEAD_DASHBOARD', roles: ['TESTER_LEAD'] },
    ],
  },
  {
    title: 'Work',
    icon: 'assignment',
    items: [
      { label: 'Create Issue', icon: 'add_circle', route: '/issues/new', screenId: 'RAISE_TICKET', roles: ['TESTER_LEAD', 'TESTER'] },
      { label: 'My Reported Issues', icon: 'fact_check', route: '/my-submissions', screenId: 'MY_SUBMISSIONS', roles: ['TESTER_LEAD', 'TESTER'] },
      { label: 'Ticket Hub', icon: 'view_quilt', route: '/tasks/all', screenId: 'TICKET_HUB', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'QA Bug Triage', icon: 'approval', route: '/approvals', screenId: 'TESTING_REVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD'] },
      { label: 'Work Allocation', icon: 'assignment_ind', route: '/triage', screenId: 'DEV_TEAM_ASSIGNMENT', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD'] },
      { label: 'Pending QA Release', icon: 'inventory_2', route: '/developer-completed', screenId: 'DEV_COMPLETED_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD'] },
      { label: 'On-Hold Tickets', icon: 'pause_circle_outline', route: '/on-hold-tasks', screenId: 'ON_HOLD_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] },
      { label: 'QA Verification Sign-off', icon: 'verified', route: '/tested-completed', screenId: 'TESTED_COMPLETED_REVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD', 'DEVELOPER_LEAD'] },
      { label: 'My Assigned Tickets', icon: 'task_alt', route: '/my-tasks', screenId: 'MY_TICKETS', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] },
      { label: 'My Completed Work (Dev)', icon: 'check_circle', route: '/developer-completed', screenId: 'MY_COMPLETED_TICKETS_DEV', roles: ['EMPLOYEE'] },
      { label: 'My Completed Work (QA)', icon: 'fact_check', route: '/tester-completed', screenId: 'MY_COMPLETED_TICKETS_QA', roles: ['TESTER', 'TESTER_LEAD'] },
      { label: 'Kanban Board', icon: 'view_kanban', route: '/tasks', screenId: 'TICKET_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'EMPLOYEE', 'TESTER'] },
      { label: 'All Tickets Registry', icon: 'list_alt', route: '/tasks/all', screenId: 'ALL_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER', 'TESTER_LEAD', 'DEVELOPER_LEAD'], access: 'taskManager' },
      { label: 'Module & Screen Master', icon: 'account_tree', route: '/masters', screenId: 'MODULE_SCREEN_SETUP', roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    title: 'Delivery',
    icon: 'insights',
    items: [
      { label: 'Projects Overview', icon: 'insights', route: '/projects', screenId: 'PROJECT_OVERVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD'] },
      { label: 'Project Teams & Hierarchy', icon: 'account_tree', route: '/hierarchy', screenId: 'TEAM_HIERARCHY', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD'] },
      { label: 'My Projects', icon: 'folder_open', route: '/my-projects', screenId: 'MY_PROJECTS' },
    ],
  },
  {
    title: 'Time',
    icon: 'schedule',
    items: [
      { label: 'Log Time', icon: 'edit_calendar', route: '/timesheets/new', screenId: 'SUBMIT_TIMESHEET', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER', 'SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] },
      { label: 'My Timesheet History', icon: 'calendar_month', route: '/timesheets/my', screenId: 'MY_TIMESHEETS', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER', 'SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] },
      { label: 'Timesheet Approvals', icon: 'approval', route: '/timesheets/approvals', screenId: 'TIMESHEET_APPROVALS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'PROJECT_MANAGER'] },
      { label: 'Timesheet Reports', icon: 'table_view', route: '/timesheets', screenId: 'TIMESHEET_REPORTS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'PROJECT_MANAGER'] },
    ],
  },
  {
    title: 'Administration',
    icon: 'admin_panel_settings',
    items: [
      { label: 'Employee Directory', icon: 'badge', route: '/people/accounts', screenId: 'REGISTERED_EMPLOYEES', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Module & Screen Master', icon: 'account_tree', route: '/dynamic-masters/view/MODULE_SCREEN_MASTER', screenId: 'MODULE_SCREEN_MASTER', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Organization Master', icon: 'corporate_fare', route: '/dynamic-masters/view/ORGANIZATION_MASTER', screenId: 'ORGANIZATION_MASTER', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Dynamic Master Hub', icon: 'dynamic_form', route: '/dynamic-masters', screenId: 'DYNAMIC_MASTERS', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Dynamic Form Builder', icon: 'tune', route: '/dynamic-masters/builder', screenId: 'DYNAMIC_FORM_BUILDER', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Role Permissions (RBAC)', icon: 'admin_panel_settings', route: '/role-access', screenId: 'ROLE_ACCESS_CONFIG', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { label: 'Audit Logs', icon: 'manage_history', route: '/audit-logs', screenId: 'AUDIT_LOGS', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] },
    ],
  },
  {
    title: 'Account',
    icon: 'manage_accounts',
    items: [
      { label: 'My Profile', icon: 'manage_accounts', route: '/profile', screenId: 'USER_PROFILE' },
      { label: 'System Settings', icon: 'tune', route: '/settings', screenId: 'SETTINGS' },
    ],
  },
];

/**
 * Checks whether a navigation item is visible for the specified role under dynamic RBAC rules.
 */
export function isNavItemVisible(
  item: NavItem,
  role: string,
  rolePermissionService: RolePermissionService
): boolean {
  if (!role) {
    return false;
  }

  // 1. Dynamic screen-level permission check:
  // If the admin has marked this screen restricted for this role, hide it immediately!
  if (item.screenId && !rolePermissionService.isScreenAllowed(item.screenId)) {
    return false;
  }

  // 2. Dynamic route access check:
  // If the target route is restricted for this role, hide it immediately!
  if (!rolePermissionService.canAccessRoute(item.route)) {
    return false;
  }

  // 3. Baseline role compatibility
  if (item.roles && item.roles.length > 0) {
    const normRoles = item.roles.map((r) => rolePermissionService.normalizeRole(r));
    if (!normRoles.includes(role) && !item.roles.includes(role)) {
      return false;
    }
  }

  // 4. Task manager provision for testers
  if (item.access === 'taskManager') {
    return RoleGuard.managesTasks(role);
  }

  return true;
}

/**
 * Checks whether a navigation group has at least one visible item.
 */
export function groupHasVisibleItems(
  group: NavGroup,
  role: string,
  rolePermissionService: RolePermissionService
): boolean {
  return group.items.some((item) => isNavItemVisible(item, role, rolePermissionService));
}
