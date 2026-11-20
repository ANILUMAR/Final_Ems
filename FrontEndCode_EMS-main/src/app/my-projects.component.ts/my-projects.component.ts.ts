import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TaskModel } from '../models/employee';
import { ProjectItem, TaskItem, WorkspaceService } from '../services/workspace.service';
import { ReferenceService } from '../services/reference.service';
import { RoleGuard } from '../role-guard';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

interface MyProjectRow {
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

    constructor(private http: HttpClient, private workspace: WorkspaceService,
                private reference: ReferenceService) {}

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

  /* ---------- loading ---------- */

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    const email = localStorage.getItem('email') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);

    forkJoin({
      assigned: this.http.get<TaskModel[]>(`http://localhost:9001/api/assigntasks/getAssignTask?email=${email}`, { headers }),
      projects: this.workspace.getProjects(),
      tracked: this.workspace.getTasks()
    }).subscribe({
      next: ({ assigned, projects, tracked }) => {
        this.assignedTasks = assigned || [];
        this.rows = this.groupByProject(this.assignedTasks, projects || [], tracked || []);
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

  private groupByProject(tasks: TaskModel[], projects: ProjectItem[], tracked: TaskItem[]): MyProjectRow[] {
    const groups = new Map<string, TaskModel[]>();

    tasks.forEach((task) => {
      const key = (task.project || 'Unassigned work').trim() || 'Unassigned work';
      const bucket = groups.get(key) || [];
      bucket.push(task);
      groups.set(key, bucket);
    });

    return Array.from(groups.entries())
      .map(([name, groupTasks]) => this.toRow(name, groupTasks, projects, tracked))
      .sort((a, b) => b.myTasks.length - a.myTasks.length);
  }

  private toRow(name: string, tasks: TaskModel[], projects: ProjectItem[], tracked: TaskItem[]): MyProjectRow {
    const project = projects.find((item) => (item.name || '').toLowerCase() === name.toLowerCase());
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

    return {
      name,
      description: project?.description || 'No project brief has been captured yet.',
      myTasks: tasks,
      tracked: projectTasks.length,
      done,
      progress,
      overdue,
      dueSoon,
      nextDue: dues[0] || null,
      team: Array.from(new Set(tasks.map((task) => task.assignedToName || '').filter((value) => !!value))),
      ...this.statusFor(projectTasks.length, done, overdue)
    };
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
