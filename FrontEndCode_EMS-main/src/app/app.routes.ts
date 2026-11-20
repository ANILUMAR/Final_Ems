import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AllTaskComponent } from './all-task-component/all-task-component';
import { ApprovalQueue } from './approval-queue/approval-queue';
import { AssignmentQueue } from './assignment-queue/assignment-queue';
import { AuthGuard } from './auth-guard';
import { CreateProject } from './create-project/create-project';
import { Dashboard } from './dashboard/dashboard';
import { DeletedTasks } from './deleted-tasks/deleted-tasks';
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

export const routes: Routes = [
  { path: '', component: Loading },

  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgotpassward', component: Forgotpassward },

  // The role surfaces. `data.roles` is enforced by RoleGuard and lists role
  // codes, so a team leader is named explicitly: SUPER_ADMIN is the CEO (every
  // page), *_LEAD runs a team, TESTER / EMPLOYEE only ever reach their own work.
  { path: 'dashboard', component: Dashboard, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'developer-board', component: EmployeeDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'developer-completed', component: DeveloperCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'on-hold-tasks', component: OnHoldTasksComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'EMPLOYEE'] } },
  { path: 'tester-board', component: TesterDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'TESTER'] } },
  { path: 'testing-lead-dashboard', component: TestingLeadDashboardComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD'] } },
  { path: 'tested-completed', component: TestedCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'DEVELOPER_LEAD'] } },
  { path: 'tester-completed', component: TesterCompletedComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'TESTER'] } },

  // The intake, step by step: a tester raises a task or a bug, the testing team
  // leader approves or sends it back, and the developer team leader hands the
  // approved work out. Each step is its own route, so each role opens only the
  // screen its part of the flow happens on. Raising is the testing team's job
  // alone - the CEO reads both decisions (below) but no longer files work, and
  // the developer side only receives, so neither of these screens is offered
  // to them.
  { path: 'issues/new', component: RaiseIssue, canActivate: [AuthGuard, RoleGuard], data: { roles: ['TESTER_LEAD', 'TESTER'] } },
  { path: 'my-submissions', component: MySubmissions, canActivate: [AuthGuard, RoleGuard], data: { roles: ['TESTER_LEAD', 'TESTER'] } },
  // Screen 1: what the testers raised, waiting for a decision. The CEO and the
  // testing team leader are the two approvers.
  { path: 'approvals', component: ApprovalQueue, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD'] } },
  // Screen 2: work the testing side approved, waiting for an owner. The CEO and
  // the developer team leader hand it out.
  { path: 'triage', component: AssignmentQueue, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD'] } },

  // Leaders read the cross-team board; a member only their own list.
  { path: 'my-tasks', component: EmployeeMyTask, canActivate: [AuthGuard, RoleGuard], data: { roles: ['DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] } },
  { path: 'tasks', component: TaskListComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'TESTER_LEAD'] } },
  // Creating and maintaining work needs the task-management right: the CEO and
  // both team leaders hold it by role, a plain tester only while an
  // administrator keeps their provision switched on. There is exactly one way
  // in: /issues/new above, then /triage to give it an owner.
  { path: 'tasks/all', component: AllTaskComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER', 'TESTER_LEAD', 'DEVELOPER_LEAD'], access: 'taskManager' } },
  // The retired Create Task screen: an old bookmark lands on the one intake.
  { path: 'tasks/new', redirectTo: 'issues/new', pathMatch: 'full' },
  // Where removed work goes: the audit list of who deleted what, and why.
  { path: 'tasks/deleted', component: DeletedTasks, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },

  // The module / sub module / screen lists the task forms pick from. Reading
  // them is open to any account; maintaining them is administrative work, so
  // the screen itself belongs to the CEO alone.
  { path: 'masters', component: MasterData, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },

  { path: 'projects', component: ProjectOverviewComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'projects/new', component: CreateProject, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
  { path: 'my-projects', component: MyProjectsComponent, canActivate: [AuthGuard, RoleGuard] },
  // Employee Directory was merged into Registered Employees (same data, same
  // edit dialog), so /people now opens the accounts screen directly.
  { path: 'people', redirectTo: 'people/accounts', pathMatch: 'full' },
  // People and their logins stay with the CEO: a leader runs work, not accounts.
  { path: 'people/accounts', component: RegistredEmployeeList, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },

  { path: 'timesheets', component: ViewTimesheets, canActivate: [AuthGuard, RoleGuard], data: { roles: ['SUPER_ADMIN', 'ADMIN'] } },
  // Submitting hours belongs to the people doing the work; the CEO reviews.
  { path: 'timesheets/new', component: SubmitTimesheetComponent, canActivate: [AuthGuard, RoleGuard], data: { roles: ['DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] } },

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
