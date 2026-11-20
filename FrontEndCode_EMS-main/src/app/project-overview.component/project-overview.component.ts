import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProjectItem, TaskItem, WorkspaceService } from '../services/workspace.service';
import { ReferenceService } from '../services/reference.service';
import { statusMeta } from '../task-status/status-history-dialog';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

interface ProjectRow {
  id: number;
  name: string;
  description: string;
  owner: string;
  total: number;
  done: number;
  progress: number;
  contributors: string[];
  status: string;
  statusClass: string;
}

@Component({
  selector: 'app-project-overview',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterModule, Pager],
  templateUrl: './project-overview.component.html',
  styleUrls: ['./project-overview.component.css']
})
export class ProjectOverviewComponent implements OnInit {
  loading = true;
  errorMessage = '';

  rows: ProjectRow[] = [];
  selectedId: number | null = null;
  private allTasks: TaskItem[] = [];

  /**
   * Both lists page in the browser: the portfolio rows and the task breakdown
   * of the project on the right. They keep separate pages, because picking a
   * project must not reopen its tasks halfway down.
   */
  projectPage = 0;
  taskPage = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  get selectedTasks(): TaskItem[] {
    const project = this.selected;
    return project ? this.allTasks.filter((task) => this.taskBelongsTo(task, { id: project.id, name: project.name } as ProjectItem)) : [];
  }

  /** The rows each list renders for its current page. */
  get pagedRows(): ProjectRow[] {
    return pageSlice(this.rows, this.projectPage, this.pageSize);
  }

  get pagedSelectedTasks(): TaskItem[] {
    return pageSlice(this.selectedTasks, this.taskPage, this.pageSize);
  }

  constructor(private workspace: WorkspaceService, private reference: ReferenceService) {}

  ngOnInit(): void {
    this.reload();
  }

  /* ---------- portfolio level numbers ---------- */

  get totalProjects(): number {
    return this.rows.length;
  }

  get totalTasks(): number {
    return this.rows.reduce((sum, row) => sum + row.total, 0);
  }

  get openTasks(): number {
    return this.rows.reduce((sum, row) => sum + (row.total - row.done), 0);
  }

  get completionRate(): number {
    return this.totalTasks ? Math.round((this.rows.reduce((sum, row) => sum + row.done, 0) / this.totalTasks) * 100) : 0;
  }

  get contributorCount(): number {
    const people = new Set<string>();
    this.rows.forEach((row) => row.contributors.forEach((person) => people.add(person)));
    return people.size;
  }

  get selected(): ProjectRow | null {
    return this.rows.find((row) => row.id === this.selectedId) || this.rows[0] || null;
  }

  /* ---------- loading ---------- */

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      projects: this.workspace.getProjects(),
      tasks: this.workspace.getTasks()
    }).subscribe({
      next: ({ projects, tasks }) => {
        this.allTasks = tasks || [];
        this.rows = (projects || []).map((project) => this.toRow(project, this.allTasks));
        if (!this.rows.some((row) => row.id === this.selectedId)) {
          this.selectedId = this.rows[0]?.id ?? null;
          // A different project is in the detail card, so its tasks start at the top.
          this.taskPage = 0;
        }
        // A reload can shrink either list, so never leave a pager past its end.
        this.projectPage = Math.min(this.projectPage, lastPageOf(this.rows.length, this.pageSize));
        this.taskPage = Math.min(this.taskPage, lastPageOf(this.selectedTasks.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load portfolio', err);
        this.errorMessage = 'Could not load the project portfolio right now.';
        this.loading = false;
      }
    });
  }

  select(row: ProjectRow): void {
    this.selectedId = row.id;
    // The detail card now shows another project: its tasks begin at page one.
    this.taskPage = 0;
  }

  /**
   * Both lists share the size, so choosing a bigger page on one of them can
   * strand the other past its last page. Clamp both instead of leaving a list
   * empty until something else reloads it.
   */
  setPageSize(size: number): void {
    this.pageSize = size;
    this.projectPage = Math.min(this.projectPage, lastPageOf(this.rows.length, size));
    this.taskPage = Math.min(this.taskPage, lastPageOf(this.selectedTasks.length, size));
  }

  /* ---------- helpers ---------- */

  private toRow(project: ProjectItem, tasks: TaskItem[]): ProjectRow {
    const projectTasks = tasks.filter((task) => this.taskBelongsTo(task, project));
    const done = projectTasks.filter((task) => task.status === 'DONE').length;
    const progress = projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0;

    return {
      id: project.id,
      name: project.name || 'Untitled project',
      description: project.description || 'No description captured for this project yet.',
      owner: this.displayName(project.user) || 'Unassigned',
      total: projectTasks.length,
      done,
      progress,
      contributors: this.uniqueNames(projectTasks),
      ...this.statusFor(projectTasks.length, done, progress)
    };
  }

  private taskBelongsTo(task: TaskItem, project: ProjectItem): boolean {
    if (task.project && typeof task.project === 'object') {
      return task.project.id === project.id;
    }
    const label = String(task.project || '').toLowerCase();
    return !!label && label === String(project.name || '').toLowerCase();
  }

  /**
   * Which PROJECT_STATUS row describes this project. The rule stays in code (it
   * is a business rule); the words and colours are read from app_lookup.
   */
  private statusFor(total: number, done: number, progress: number): { status: string; statusClass: string } {
    if (!total) {
      return this.projectStatus('NOT_STARTED');
    }
    if (done === total) {
      return this.projectStatus('COMPLETED');
    }
    return this.projectStatus(progress >= 50 ? 'ON_TRACK' : 'AT_RISK');
  }

  private projectStatus(code: string): { status: string; statusClass: string } {
    return {
      status: this.reference.label('PROJECT_STATUS', code),
      statusClass: this.reference.badge('PROJECT_STATUS', code)
    };
  }

  private uniqueNames(tasks: TaskItem[]): string[] {
    const names = tasks.map((task) => this.displayName(task.user)).filter((name): name is string => !!name);
    return Array.from(new Set(names));
  }

  private displayName(user: any): string {
    if (!user) {
      return '';
    }
    return user.username || user.name || user.email || '';
  }

  initials(name: string): string {
    const parts = (name || '?').split(' ').filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  /** Both come from the WORK_STATUS row, so the words match every other board. */
  statusBadge(task: TaskItem): string {
    return statusMeta(task.status).badge;
  }

  statusLabel(task: TaskItem): string {
    return statusMeta(task.status).label;
  }

  fillClass(progress: number): string {
    if (progress >= 100) {
      return 'is-success';
    }
    return progress > 0 ? 'is-info' : 'is-neutral';
  }
}
