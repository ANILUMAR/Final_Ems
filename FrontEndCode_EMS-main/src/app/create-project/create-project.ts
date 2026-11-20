import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProjectItem, TaskItem, WorkspaceService } from '../services/workspace.service';

interface ProjectRow {
  id: number;
  name: string;
  description: string;
  owner: string;
  tasks: number;
  done: number;
}

/**
 * Admin-only screen: adds a project to the portfolio, the raise screen's project
 * picker and the project counter in one save. The name must be unique
 * (case-insensitive).
 */
@Component({
  selector: 'app-create-project',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './create-project.html',
  styleUrls: ['./create-project.css']
})
export class CreateProject implements OnInit {
  form: FormGroup;
  rows: ProjectRow[] = [];
  loading = true;
  saving = false;
  errorMessage = '';
  lastCreated: string | null = null;

  constructor(
    private fb: FormBuilder,
    private workspace: WorkspaceService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      description: ['', [Validators.maxLength(500)]]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  /* ---------- numbers ---------- */

  get totalTasks(): number {
    return this.rows.reduce((sum, row) => sum + row.tasks, 0);
  }

  get openTasks(): number {
    return this.rows.reduce((sum, row) => sum + (row.tasks - row.done), 0);
  }

  get canSubmit(): boolean {
    return this.form.valid && !this.saving;
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
        this.rows = (projects || [])
          .map((project) => this.toRow(project, tasks || []))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load projects', err);
        this.errorMessage = 'Could not load the project list right now.';
        this.loading = false;
      }
    });
  }

  /* ---------- create ---------- */

  onSubmit(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const name = (this.form.value.name || '').trim();
    const description = (this.form.value.description || '').trim();

    this.saving = true;
    this.workspace.createProject({ name, description }).subscribe({
      next: (project) => {
        this.saving = false;
        this.lastCreated = project.name;
        this.form.reset({ name: '', description: '' });
        this.snackBar.open(`Project "${project.name}" created.`, 'Close', { duration: 3000 });
        this.reload();
      },
      error: (err) => {
        this.saving = false;
        const message =
          typeof err?.error === 'string' && err.error.trim()
            ? err.error
            : 'Could not create the project. Please try again.';
        this.errorMessage = message;
        this.snackBar.open(message, 'Close', { duration: 4000 });
      }
    });
  }

  onReset(): void {
    this.form.reset({ name: '', description: '' });
    this.errorMessage = '';
    this.lastCreated = null;
  }

  /* ---------- helpers ---------- */

  private toRow(project: ProjectItem, tasks: TaskItem[]): ProjectRow {
    const projectTasks = tasks.filter((task) => this.taskBelongsTo(task, project));
    const done = projectTasks.filter((task) => task.status === 'DONE').length;

    return {
      id: project.id,
      name: project.name || 'Untitled project',
      description: project.description || 'No description captured yet.',
      owner: project.user?.name || project.user?.email || 'Unassigned',
      tasks: projectTasks.length,
      done
    };
  }

  /**
   * Tasks reference the project by id, but the legacy assignment flow stores the
   * project name, so both are accepted.
   */
  private taskBelongsTo(task: TaskItem, project: ProjectItem): boolean {
    if (task.project?.id != null && project.id != null) {
      return task.project.id === project.id;
    }
    return (task.project?.name || '').toLowerCase() === (project.name || '').toLowerCase();
  }
}
