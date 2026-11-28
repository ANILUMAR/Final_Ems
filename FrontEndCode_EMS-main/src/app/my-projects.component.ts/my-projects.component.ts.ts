import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TaskModel } from '../models/employee';
import { ProjectItem, TaskItem, WorkspaceService } from '../services/workspace.service';
import { ReferenceService } from '../services/reference.service';
import { HierarchyService, ProjectRosterDto } from '../services/hierarchy.service';
import { RoleGuard } from '../role-guard';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

export interface MyProjectRow {
  name: string;
  description: string;
  myTasks: TaskModel[];
  tracked: number;
  done: number;
  progress: number | null;
  overdue: number;
  dueSoon: number;
  nextDue: string | null;
  team: string[];
  status: string;
  statusClass: string;
  // Team Hierarchy & Role details
  myRole: string;
  myRoleClass: string;
  myResponsibilities: string;
  myAllocation: number;
  myPriority: string;
  approvalStatus: string;
  workAuthorized: boolean;
  pmName?: string;
  pmEmail?: string;
  devLeadName?: string;
  devLeadEmail?: string;
  testerLeadName?: string;
  testerLeadEmail?: string;
  teamMembers?: { name: string; email: string; role: string; priority?: string }[];
}

@Component({
  selector: 'app-my-projects',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterModule, Pager],
  templateUrl: './my-projects.component.ts.html',
  styleUrl: './my-projects.component.ts.css'
})
export class MyProjectsComponent implements OnInit {
  loading = true;
  errorMessage = '';

  rows: MyProjectRow[] = [];
  private assignedTasks: TaskModel[] = [];

  /** Projects page in the browser, so the headline numbers still count them all. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    private http: HttpClient,
    private workspace: WorkspaceService,
    private reference: ReferenceService,
    private hierarchyService: HierarchyService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  /* ---------- headline numbers ---------- */

  get myProjectCount(): number {
    return this.rows.length;
  }

  get myTaskCount(): number {
    return this.assignedTasks.length;
  }

  /** The Task Board is the managers' view; a member lands on My Tasks instead. */
  get taskBoardLink(): string {
    return RoleGuard.managesTasks() ? '/tasks' : '/my-tasks';
  }

  get overdueCount(): number {
    return this.rows.reduce((sum, row) => sum + row.overdue, 0);
  }

  get dueSoonCount(): number {
    return this.rows.reduce((sum, row) => sum + row.dueSoon, 0);
  }

  /** The project cards actually rendered for the current page. */
  get pagedRows(): MyProjectRow[] {
    return pageSlice(this.rows, this.pageIndex, this.pageSize);
  }

  get userRole(): string {
    return (localStorage.getItem('role') || '').toUpperCase();
  }

  isTester(row?: MyProjectRow): boolean {
    const role = (row?.myRole || this.userRole).toUpperCase();
    return role.includes('TESTER') || role === 'TESTER';
  }

  isDevLead(row?: MyProjectRow): boolean {
    const role = (row?.myRole || this.userRole).toUpperCase();
    return role.includes('JAVA') || role.includes('DEVELOPER_LEAD') || role.includes('DEV LEAD');
  }

  isTestLead(row?: MyProjectRow): boolean {
    const role = (row?.myRole || this.userRole).toUpperCase();
    return role.includes('TESTING TEAM LEADER') || role.includes('TESTER_LEAD');
  }

  isPM(row?: MyProjectRow): boolean {
    const role = (row?.myRole || this.userRole).toUpperCase();
    return role.includes('PROJECT MANAGER') || role === 'PROJECT_MANAGER';
  }

  isAdmin(): boolean {
    const role = this.userRole;
    return role === 'SUPER_ADMIN' || role === 'ADMIN';
  }

  /* ---------- loading ---------- */

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    const email = localStorage.getItem('email') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);

    forkJoin({
      assigned: this.http.get<TaskModel[]>(`http://localhost:9001/api/assigntasks/getAssignTask?email=${email}`, { headers }).pipe(
        catchError((err) => {
          console.warn('Could not fetch personal assigned tasks:', err);
          return of([] as TaskModel[]);
        })
      ),
      projects: this.workspace.getProjects().pipe(
        catchError(() => of([] as ProjectItem[]))
      ),
      tracked: this.workspace.getTasks().pipe(
        catchError(() => of([] as TaskItem[]))
      ),
      hierarchyProjects: this.hierarchyService.getMyProjects().pipe(
        catchError((err) => {
          console.warn('Could not fetch hierarchy projects:', err);
          return of([] as ProjectRosterDto[]);
        })
      )
    }).subscribe({
      next: ({ assigned, projects, tracked, hierarchyProjects }) => {
        this.assignedTasks = assigned || [];
        this.rows = this.groupByProject(this.assignedTasks, projects || [], tracked || [], hierarchyProjects || []);
        // Losing the last task of a project removes its card, so never leave the
        // pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.rows.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load my projects', err);
        this.errorMessage = 'Could not load your projects right now.';
        this.loading = false;
      }
    });
  }

  /* ---------- grouping ---------- */

  private groupByProject(
    tasks: TaskModel[],
    projects: ProjectItem[],
    tracked: TaskItem[],
    hierarchyProjects: ProjectRosterDto[]
  ): MyProjectRow[] {
    const groups = new Map<string, TaskModel[]>();

    // 1. Initialize groups from hierarchyProjects so every project the user is assigned to in hierarchy appears immediately!
    hierarchyProjects.forEach((hp) => {
      if (hp.projectName && hp.projectName.trim()) {
        const key = hp.projectName.trim();
        if (!groups.has(key)) {
          groups.set(key, []);
        }
      }
    });

    // 2. Map personal tasks into project groups
    tasks.forEach((task) => {
      const taskProj = (task.project || 'Unassigned work').trim() || 'Unassigned work';
      // Match case-insensitively with existing keys if possible
      let matchedKey = Array.from(groups.keys()).find((k) => k.toLowerCase() === taskProj.toLowerCase());
      if (!matchedKey) {
        matchedKey = taskProj;
        groups.set(matchedKey, []);
      }
      groups.get(matchedKey)!.push(task);
    });

    return Array.from(groups.entries())
      .map(([name, groupTasks]) => this.toRow(name, groupTasks, projects, tracked, hierarchyProjects))
      .sort((a, b) => {
        // Show work-authorized projects first, then by task count, then by name
        if (a.workAuthorized !== b.workAuthorized) {
          return a.workAuthorized ? -1 : 1;
        }
        return b.myTasks.length - a.myTasks.length || a.name.localeCompare(b.name);
      });
  }

  private toRow(
    name: string,
    tasks: TaskModel[],
    projects: ProjectItem[],
    tracked: TaskItem[],
    hierarchyProjects: ProjectRosterDto[]
  ): MyProjectRow {
    const project = projects.find((item) => (item.name || '').toLowerCase() === name.toLowerCase());
    const roster = hierarchyProjects.find((hp) => (hp.projectName || '').toLowerCase() === name.toLowerCase());

    const projectTasks = tracked.filter((task) => {
      const label = typeof task.project === 'object' && task.project ? task.project.name : String(task.project || '');
      return (label || '').toLowerCase() === name.toLowerCase();
    });

    const done = projectTasks.filter((task) => task.status === 'DONE').length;
    const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : null;

    const overdue = tasks.filter((task) => this.daysUntil(task.endDate) < 0).length;
    const dueSoon = tasks.filter((task) => {
      const days = this.daysUntil(task.endDate);
      return days >= 0 && days <= 7;
    }).length;

    const dues = tasks
      .map((task) => task.endDate)
      .filter((date): date is string => !!date)
      .sort();

    // Collect team members: combine task assignees and hierarchy roster members
    const teamSet = new Set<string>();
    tasks.forEach((t) => { if (t.assignedToName) teamSet.add(t.assignedToName); });
    if (roster) {
      if (roster.pmName) teamSet.add(roster.pmName);
      if (roster.devLeadName) teamSet.add(roster.devLeadName);
      if (roster.testerLeadName) teamSet.add(roster.testerLeadName);
      if (roster.members) {
        roster.members.forEach((m) => { if (m.memberName) teamSet.add(m.memberName); });
      }
    }

    const teamMembersList: { name: string; email: string; role: string; priority?: string }[] = [];
    if (roster) {
      if (roster.pmName) teamMembersList.push({ name: roster.pmName, email: roster.pmEmail || '', role: 'Project Manager' });
      if (roster.devLeadName) teamMembersList.push({ name: roster.devLeadName, email: roster.devLeadEmail || '', role: 'Java Team Leader' });
      if (roster.testerLeadName) teamMembersList.push({ name: roster.testerLeadName, email: roster.testerLeadEmail || '', role: 'Testing Team Leader' });
      if (roster.members) {
        roster.members.forEach((m) => teamMembersList.push({
          name: m.memberName,
          email: m.memberEmail,
          role: m.memberRole,
          priority: m.priority
        }));
      }
    }

    // Role styling
    const myRole = roster?.myRoleOnProject || this.resolveFallbackRole();
    let myRoleClass = 'badge-dev';
    const roleLower = myRole.toLowerCase();
    if (roleLower.includes('manager')) myRoleClass = 'badge-pm';
    else if (roleLower.includes('java') || roleLower.includes('developer lead') || roleLower.includes('dev lead')) myRoleClass = 'badge-devlead';
    else if (roleLower.includes('testing team leader') || roleLower.includes('tester lead') || roleLower.includes('qa lead')) myRoleClass = 'badge-testlead';
    else if (roleLower.includes('tester')) myRoleClass = 'badge-tester';
    else if (roleLower.includes('admin') || roleLower.includes('ceo')) myRoleClass = 'badge-admin';

    const description = (roster?.projectDescription || project?.description || 'No project brief has been captured yet.').trim();

    return {
      name,
      description,
      myTasks: tasks,
      tracked: projectTasks.length,
      done,
      progress,
      overdue,
      dueSoon,
      nextDue: dues[0] || null,
      team: Array.from(teamSet),
      myRole,
      myRoleClass,
      myResponsibilities: roster?.myResponsibilities || '',
      myAllocation: roster?.myAllocation != null ? roster.myAllocation : 100,
      myPriority: roster?.myPriority || 'HIGH',
      approvalStatus: roster?.approvalStatus || 'APPROVED',
      workAuthorized: roster ? (roster.workAuthorized ?? false) : true,
      pmName: roster?.pmName,
      pmEmail: roster?.pmEmail,
      devLeadName: roster?.devLeadName,
      devLeadEmail: roster?.devLeadEmail,
      testerLeadName: roster?.testerLeadName,
      testerLeadEmail: roster?.testerLeadEmail,
      teamMembers: teamMembersList,
      ...this.statusFor(projectTasks.length, done, overdue)
    };
  }

  private resolveFallbackRole(): string {
    const raw = (localStorage.getItem('role') || '').toUpperCase();
    if (raw === 'SUPER_ADMIN' || raw === 'ADMIN') return 'Super Admin / CEO';
    if (raw === 'PROJECT_MANAGER') return 'Project Manager';
    if (raw === 'DEVELOPER_LEAD') return 'Java Team Leader';
    if (raw === 'TESTER_LEAD') return 'Testing Team Leader';
    if (raw === 'TESTER') return 'Tester';
    return 'Developer';
  }

  /**
   * Which PROJECT_STATUS row describes this project. The rule stays in code (it
   * is a business rule); the words and colours are read from app_lookup.
   */
  private statusFor(tracked: number, done: number, overdue: number): { status: string; statusClass: string } {
    if (!tracked) {
      return this.projectStatus('NOT_STARTED');
    }
    if (done === tracked) {
      return this.projectStatus('COMPLETED');
    }
    return this.projectStatus(overdue > 0 ? 'AT_RISK' : 'ON_TRACK');
  }

  private projectStatus(code: string): { status: string; statusClass: string } {
    return {
      status: this.reference.label('PROJECT_STATUS', code),
      statusClass: this.reference.badge('PROJECT_STATUS', code)
    };
  }

  /* ---------- helpers ---------- */

  private daysUntil(date: string): number {
    if (!date) {
      return Number.POSITIVE_INFINITY;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((new Date(date).getTime() - today.getTime()) / 86400000);
  }

  fillClass(progress: number | null): string {
    if (progress === null) {
      return 'is-neutral';
    }
    if (progress >= 100) {
      return 'is-success';
    }
    return progress > 0 ? 'is-info' : 'is-neutral';
  }

  initials(name: string): string {
    const parts = (name || '?').split(' ').filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  isOverdue(task: TaskModel): boolean {
    return this.daysUntil(task.endDate) < 0;
  }

  dueLabel(task: TaskModel): string {
    if (!task.endDate) {
      return 'No due date';
    }
    const days = this.daysUntil(task.endDate);
    if (days < 0) {
      return `Overdue by ${Math.abs(days)}d`;
    }
    if (days === 0) {
      return 'Due today';
    }
    return `Due in ${days}d`;
  }
}
