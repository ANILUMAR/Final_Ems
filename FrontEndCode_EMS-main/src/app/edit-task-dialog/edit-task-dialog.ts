import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { TaskModel } from '../models/employee';
import { ReferenceService } from '../services/reference.service';
import { MasterDataService, MasterEntry } from '../services/master-data.service';

/** What the register hands over: the row being edited. */
export interface TaskEditData {
  task: TaskModel;
}

interface OwnerOption {
  id: number;
  name: string;
}

interface ProjectOption {
  projectName: string;
}

/**
 * Edits the details of an existing task. Progress is deliberately absent: moving
 * an item between TODO and Done stays on the board, where it is recorded in the
 * status history.
 */
@Component({
  selector: 'app-edit-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule
  ],
  templateUrl: './edit-task-dialog.html',
  styleUrl: './edit-task-dialog.css'
})
export class EditTaskDialog implements OnInit {
  form: FormGroup;
  owners: OwnerOption[] = [];
  projects: ProjectOption[] = [];
  saving = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditTaskDialog, boolean>,
    private reference: ReferenceService,
    private master: MasterDataService,
    @Inject(MAT_DIALOG_DATA) public data: TaskEditData
  ) {
    const task = data?.task || ({} as TaskModel);
    this.form = this.fb.group({
      taskTitle: [task.taskTitle || '', [Validators.required, Validators.maxLength(100)]],
      project: [task.project || '', Validators.required],
      assignedTo: [null as number | null, Validators.required],
      priority: [this.priorityValue(task.priority), Validators.required],
      // Plain yyyy-MM-dd inputs: the backend stores and parses exactly that.
      startDate: [this.toIsoDate(task.startDate)],
      endDate: [this.toIsoDate(task.endDate)],
      module: [task.module || '', Validators.maxLength(100)],
      subModule: [task.subModule || '', Validators.maxLength(100)],
      screen: [task.screen || '', Validators.maxLength(100)],
      description: [task.description || '', Validators.maxLength(500)]
    });
  }

  ngOnInit(): void {
    this.fetchOwners();
    this.fetchProjects();
    // The three placement pickers come from the master data, which the service
    // caches - so opening a second dialog costs no extra request.
    this.master.load().subscribe(() => this.matchMasterSpelling());
  }

  /**
   * A saved task stores module / sub module / screen in upper case while the
   * master data keeps the spelling it was created with. Re-spelling the form
   * values means the picker lists one option per value, not two.
   */
  private matchMasterSpelling(): void {
    const module = this.findByName(this.master.modules, this.currentValue('module'));
    const subModule = this.findByName(
      module ? this.master.subModules(module.id) : [],
      this.currentValue('subModule')
    );
    const screen = this.findByName(
      subModule ? this.master.screens(subModule.id) : [],
      this.currentValue('screen')
    );

    this.form.patchValue({
      module: module?.name ?? this.currentValue('module'),
      subModule: subModule?.name ?? this.currentValue('subModule'),
      screen: screen?.name ?? this.currentValue('screen')
    }, { emitEvent: false });
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  private fetchOwners(): void {
    this.http.get<OwnerOption[]>('http://localhost:9001/api/assigntasks/getname', { headers: this.headers() })
      .subscribe({
        next: (data) => {
          this.owners = data || [];
          // The register only carries the owner's name, so the picker is prefilled
          // by matching that name against the account list.
          const current = (this.data?.task?.assignedToName || '').trim().toLowerCase();
          const match = this.owners.find((owner) => (owner.name || '').trim().toLowerCase() === current);
          if (match) {
            this.form.patchValue({ assignedTo: match.id });
          }
        },
        error: (err) => console.error('Failed to load owners', err)
      });
  }

  private fetchProjects(): void {
    this.http.get<any[]>('http://localhost:9001/api/projects', { headers: this.headers() })
      .subscribe({
        next: (data) => {
          this.projects = (data || []).map((project) => ({ projectName: project.name }));
        },
        error: (err) => console.error('Failed to load projects', err)
      });
  }

  /** The stored project may already be gone from the picker; keep it selectable. */
  get projectOptions(): string[] {
    const names = this.projects.map((project) => project.projectName).filter(Boolean);
    const current = (this.form?.get('project')?.value || '').trim();
    return current && !names.includes(current) ? [current, ...names] : names;
  }

  /* ---------- where in the app ---------- */

  /** Like the project picker: the stored value stays offered even once retired. */
  get moduleOptions(): string[] {
    return this.withCurrent(this.master.modules.map((entry) => entry.name), this.currentValue('module'));
  }

  get subModuleOptions(): string[] {
    const parent = this.selectedModule;
    const names = parent ? this.master.subModules(parent.id).map((entry) => entry.name) : [];
    return this.withCurrent(names, this.currentValue('subModule'));
  }

  get screenOptions(): string[] {
    const parent = this.selectedSubModule;
    const names = parent ? this.master.screens(parent.id).map((entry) => entry.name) : [];
    return this.withCurrent(names, this.currentValue('screen'));
  }

  get selectedModule(): MasterEntry | undefined {
    return this.findByName(this.master.modules, this.currentValue('module'));
  }

  get selectedSubModule(): MasterEntry | undefined {
    const parent = this.selectedModule;
    return this.findByName(parent ? this.master.subModules(parent.id) : [], this.currentValue('subModule'));
  }

  /** Changing the parent leaves the narrower picks pointing at another branch. */
  onModuleChange(): void {
    this.form.patchValue({ subModule: '', screen: '' }, { emitEvent: false });
  }

  onSubModuleChange(): void {
    this.form.patchValue({ screen: '' }, { emitEvent: false });
  }

  private currentValue(control: string): string {
    return String(this.form?.get(control)?.value || '').trim();
  }

  private findByName(list: MasterEntry[], name: string): MasterEntry | undefined {
    const wanted = name.toLowerCase();
    return wanted ? list.find((entry) => entry.name.trim().toLowerCase() === wanted) : undefined;
  }

  private withCurrent(names: string[], current: string): string[] {
    if (!current || names.some((name) => name.trim().toLowerCase() === current.toLowerCase())) {
      return names;
    }
    return [current, ...names];
  }

  save(): void {
    if (this.saving) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const value = this.form.value;

    this.http.put(
      `http://localhost:9001/api/assigntasks/${this.data.task.id}`,
      {
        taskTitle: value.taskTitle,
        project: value.project,
        assignedTo: value.assignedTo,
        priority: value.priority,
        startDate: value.startDate || null,
        endDate: value.endDate || null,
        module: value.module || '',
        subModule: value.subModule || '',
        screen: value.screen || '',
        description: value.description || ''
      },
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = typeof err?.error === 'string'
          ? err.error
          : 'Could not save this task right now.';
      }
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  /** The priorities offered here are the PRIORITY rows in app_lookup. */
  get priorities() {
    return this.reference.items('PRIORITY');
  }

  private priorityValue(priority?: string): string {
    const value = (priority || '').trim().toUpperCase();
    const codes = this.reference.codes('PRIORITY');
    if (codes.some((code) => code.toUpperCase() === value)) {
      return value;
    }
    return codes.length > 1 ? codes[1] : codes[0] || '';
  }

  private toIsoDate(value?: string): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  }
}
