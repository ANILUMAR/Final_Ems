import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllTaskComponent } from './all-task-component/all-task-component';
import { ApprovalQueue } from './approval-queue/approval-queue';
import { AssignmentQueue } from './assignment-queue/assignment-queue';
import { AuthGuard } from './auth-guard';
import { Dashboard } from './dashboard/dashboard';
import { AuditLogs } from './audit-logs/audit-logs';
import { DynamicMasterHubComponent } from './dynamic-master/dynamic-master-hub/dynamic-master-hub';
import { DynamicFormBuilderComponent } from './dynamic-master/dynamic-form-builder/dynamic-form-builder';
import { DynamicMasterViewComponent } from './dynamic-master/dynamic-master-view/dynamic-master-view';
import { DeveloperCompletedComponent } from './developer-completed/developer-completed';
import { OnHoldTasksComponent } from './on-hold-tasks/on-hold-tasks';
import { EmployeeDashboardComponent } from './employee-dashboard.component/employee-dashboard.component';
import { EmployeeMyTask } from './employee-my-task/employee-my-task';
import { Forgotpassward } from './forgotpassward/forgotpassward';
import { Loading } from './loading/loading';
import { Login } from './login/login';
import { MasterData } from './master-data/master-data';
import { Menu } from './menu/menu';
import { MyProjectsComponent } from './my-projects.component.ts/my-projects.component.ts';
import { MySubmissions } from './my-submissions/my-submissions';
import { ProjectOverviewComponent } from './project-overview.component/project-overview.component';
import { RaiseIssue } from './raise-issue/raise-issue';
import { Register } from './register/register';
import { RegistredEmployeeList } from './registred.employee.list/registred.employee.list';
import { RoleGuard } from './role-guard';
import { SubmitTimesheetComponent } from './submit-timesheet.component.ts/submit-timesheet.component.ts';
import { TaskListComponent } from './task-list.component/task-list.component';
import { TesterDashboardComponent } from './tester-dashboard.component/tester-dashboard.component';
import { TestingLeadDashboardComponent } from './testing-lead-dashboard/testing-lead-dashboard';
import { TestedCompletedComponent } from './tested-completed/tested-completed';
import { TesterCompletedComponent } from './tester-completed/tester-completed';
import { UpdateProfileComponent } from './update-profile.component/update-profile.component';
import { ViewTimesheets } from './view-timesheets/view-timesheets';
import { MyTimesheetsComponent } from './my-timesheets/my-timesheets';
import { TimesheetApprovalsComponent } from './timesheet-approvals/timesheet-approvals';
import { TeamHierarchyComponent } from './team-hierarchy/team-hierarchy';
import { RoleAccessComponent } from './role-access/role-access';

export const routes: Routes = [
  { path: '', component: Loading },

  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgotpassward', component: Forgotpassward },

  // The role surfaces. `data.roles` is enforced by RoleGuard and lists role
  // codes, so a team leader is named explicitly: SUPER_ADMIN is the CEO (every
  // page), *_LEAD / TEAM_LEAD runs a team, TESTER / EMPLOYEE only ever reach their own work.
  { path: 'dashboard', component: Dashboard, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DASHBOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] } },
  { path: 'developer-board', component: EmployeeDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DEVELOPER_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'developer-completed', component: DeveloperCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DEV_COMPLETED_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'completed-tasks', component: DeveloperCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DEV_COMPLETED_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'on-hold-tasks', component: OnHoldTasksComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'ON_HOLD_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'tester-board', component: TesterDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TESTER_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD', 'TESTER'] } },
  { path: 'testing-lead-dashboard', component: TestingLeadDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TESTING_LEAD_DASHBOARD', roles: ['TESTER_LEAD'] } },
  { path: 'tested-completed', component: TestedCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TESTED_COMPLETED_REVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD', 'DEVELOPER_LEAD'] } },
  { path: 'tester-completed', component: TesterCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MY_COMPLETED_TICKETS_QA', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'TESTER'] } },

  // The intake, step by step: a tester raises a task or a bug, the testing team
  // leader approves or sends it back, and the developer team leader hands the
  // approved work out.
  { path: 'issues/new', component: RaiseIssue, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'RAISE_TICKET', roles: ['TESTER_LEAD', 'TESTER'] } },
  { path: 'my-submissions', component: MySubmissions, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MY_SUBMISSIONS', roles: ['TESTER_LEAD', 'TESTER'] } },
  // Review List Screen: what the testers raised, waiting for review & approval.
  { path: 'review-list', component: ApprovalQueue, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TESTING_REVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD'] } },
  { path: 'approvals', component: ApprovalQueue, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TESTING_REVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD'] } },
  // Team Assignment List: work approved, waiting for developer/team assignment.
  { path: 'team-assignment', component: AssignmentQueue, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DEV_TEAM_ASSIGNMENT', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD'] } },
  { path: 'triage', component: AssignmentQueue, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DEV_TEAM_ASSIGNMENT', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD'] } },

  // Leaders read the cross-team board; a member only their own list.
  { path: 'my-tasks', component: EmployeeMyTask, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MY_TICKETS', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] } },
  { path: 'tasks', component: TaskListComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TICKET_BOARD', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'EMPLOYEE', 'TESTER'] } },
  // Creating and maintaining work needs the task-management right: the CEO and
  // both team leaders hold it by role, a plain tester only while an
  // administrator keeps their provision switched on. There is exactly one way
  // in: /issues/new above, then /triage to give it an owner.
  { path: 'tasks/all', component: AllTaskComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'ALL_TICKETS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER', 'TESTER_LEAD', 'DEVELOPER_LEAD'], access: 'taskManager' } },
  // The retired Create Task screen: an old bookmark lands on the one intake.
  { path: 'tasks/new', redirectTo: 'issues/new', pathMatch: 'full' },
  // Audit Logs: Comprehensive historical timeline of all transactions, activities, and deletions.
  { path: 'audit-logs', component: AuditLogs, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'AUDIT_LOGS', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] } },
  { path: 'tasks/deleted', redirectTo: 'audit-logs', pathMatch: 'full' },

  // The module / sub module / screen lists the task forms pick from. Reading
  // them is open to any account; maintaining them is administrative work, so
  // the screen itself belongs to the CEO alone.
  { path: 'masters', component: MasterData, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MODULE_SCREEN_SETUP', roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'dynamic-masters', component: DynamicMasterHubComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DYNAMIC_MASTERS', roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'dynamic-masters/builder', component: DynamicFormBuilderComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DYNAMIC_FORM_BUILDER', roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'dynamic-masters/builder/:screenCode', component: DynamicFormBuilderComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'DYNAMIC_FORM_BUILDER', roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'dynamic-masters/view/:screenCode', component: DynamicMasterViewComponent, canActivate: [AuthGuard] },
  { path: 'module-screen-master', redirectTo: 'dynamic-masters/view/MODULE_SCREEN_MASTER', pathMatch: 'full' },
  { path: 'organization-master', redirectTo: 'dynamic-masters/view/ORGANIZATION_MASTER', pathMatch: 'full' },
  { path: 'role-access', component: RoleAccessComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'ROLE_ACCESS_CONFIG', roles: ['SUPER_ADMIN', 'ADMIN'] } },

  { path: 'projects', component: ProjectOverviewComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'PROJECT_OVERVIEW', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD'] } },
  { path: 'projects/new', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'hierarchy', component: TeamHierarchyComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TEAM_HIERARCHY', roles: ['SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD'] } },
  { path: 'team-hierarchy', redirectTo: 'hierarchy', pathMatch: 'full' },
  { path: 'my-projects', component: MyProjectsComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MY_PROJECTS' } },
  // Employee Directory was merged into Registered Employees (same data, same
  // edit dialog), so /people now opens the accounts screen directly.
  { path: 'people', redirectTo: 'people/accounts', pathMatch: 'full' },
  // People and their logins stay with the CEO: a leader runs work, not accounts.
  { path: 'people/accounts', component: RegistredEmployeeList, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'REGISTERED_EMPLOYEES', roles: ['SUPER_ADMIN', 'ADMIN'] } },

  // Daily Task-Wise Timesheet System:
  { path: 'timesheets/new', component: SubmitTimesheetComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'SUBMIT_TIMESHEET', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER', 'SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] } },
  { path: 'timesheets/my', component: MyTimesheetsComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'MY_TIMESHEETS', roles: ['TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER', 'SUPER_ADMIN', 'ADMIN', 'PROJECT_MANAGER'] } },
  { path: 'timesheets/approvals', component: TimesheetApprovalsComponent, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TIMESHEET_APPROVALS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'PROJECT_MANAGER'] } },
  { path: 'timesheets', component: ViewTimesheets, canActivate: [AuthGuard, RoleGuard], data: { screenId: 'TIMESHEET_REPORTS', roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'PROJECT_MANAGER'] } },

  { path: 'profile', component: UpdateProfileComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: Menu, canActivate: [AuthGuard] },

  // Legacy dotted paths kept so older bookmarks still resolve in-app.
  { path: 'employee-dashboard.component', redirectTo: 'developer-board', pathMatch: 'full' },
  { path: 'tester-dashboard.component', redirectTo: 'tester-board', pathMatch: 'full' },
  { path: 'employee-my-task', redirectTo: 'my-tasks', pathMatch: 'full' },
  { path: 'task-list.component', redirectTo: 'tasks', pathMatch: 'full' },
  { path: 'create-task', redirectTo: 'tasks/new', pathMatch: 'full' },
  { path: 'all-task-component', redirectTo: 'tasks/all', pathMatch: 'full' },
  { path: 'project-overview.component', redirectTo: 'projects', pathMatch: 'full' },
  { path: 'my-projects.component', redirectTo: 'my-projects', pathMatch: 'full' },
  { path: 'employee-directory.component', redirectTo: 'people/accounts', pathMatch: 'full' },
  { path: 'registred.employee.list', redirectTo: 'people/accounts', pathMatch: 'full' },
  { path: 'submit-timesheet.component', redirectTo: 'timesheets/new', pathMatch: 'full' },
  { path: 'view-timesheets', redirectTo: 'timesheets', pathMatch: 'full' },
  { path: 'update-profile.component', redirectTo: 'profile', pathMatch: 'full' },
  { path: 'menu', redirectTo: 'settings', pathMatch: 'full' },

  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
