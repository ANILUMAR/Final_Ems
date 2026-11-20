import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TaskModel, TimesheetEntry } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { WorkspaceService } from '../services/workspace.service';
import { ReferenceService } from '../services/reference.service';

@Component({
  selector: 'app-submit-timesheet',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    RouterModule
  ],
  templateUrl: './submit-timesheet.component.ts.html',
  styleUrls: ['./submit-timesheet.component.ts.css']
})
export class SubmitTimesheetComponent implements OnInit {
  form: FormGroup;
  maxDate = new Date();

  projectOptions: string[] = [];
  recent: TimesheetEntry[] = [];

  loading = true;
  submitting = false;
  errorMessage = '';

  todayHours = 0;
  weekHours = 0;
  pendingCount = 0;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private timesheetService: Timesheet,
    private workspace: WorkspaceService,
    private snackBar: MatSnackBar,
    private reference: ReferenceService
  ) {
    this.form = this.fb.group({
      date: [new Date(), Validators.required],
      project: ['', Validators.required],
      hours: [8, [Validators.required, Validators.min(1), Validators.max(12)]],
      status: [this.defaultStatus(), Validators.required]
    });
  }

  /** The states a person may book under; approved/rejected are outcomes only. */
  get timesheetStatuses() {
    return this.reference.choices('TIMESHEET_STATUS');
  }

  /** First choice in the list, i.e. "Pending approval" unless it was reordered. */
  defaultStatus(): string {
    const codes = this.reference.choices('TIMESHEET_STATUS').map((item) => item.code);
    return codes[0] || '';
  }

  resetForm(): void {
    this.form.reset({ date: new Date(), hours: 8, status: this.defaultStatus() });
  }

  ngOnInit(): void {
    this.load();
  }

  /* ---------- data ---------- */

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    const email = localStorage.getItem('email') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);

    forkJoin({
      projects: this.workspace.getProjects(),
      assigned: this.http.get<TaskModel[]>(`http://localhost:9001/api/assigntasks/getAssignTask?email=${email}`, { headers }),
      entries: this.timesheetService.getTimesheets()
    }).subscribe({
      next: ({ projects, assigned, entries }) => {
        const names = new Set<string>();
        (projects || []).forEach((project) => project.name && names.add(project.name));
        (assigned || []).forEach((task) => task.project && names.add(task.project));

        this.projectOptions = Array.from(names).sort();
        this.recent = this.mine(entries || []);
        this.summarise();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load timesheet context', err);
        this.errorMessage = 'Could not load your projects and previous entries right now.';
        this.loading = false;
      }
    });
  }

  private mine(entries: TimesheetEntry[]): TimesheetEntry[] {
    const email = (localStorage.getItem('email') || '').toLowerCase();
    const name = (localStorage.getItem('name') || '').toLowerCase();

    return entries
      .filter((entry) => {
        const owner = (entry.employeeName || '').toLowerCase();
        return (!!email && owner === email) || (!!name && owner === name);
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  private summarise(): void {
    const today = this.toIsoDate(new Date());
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const weekStart = this.toIsoDate(startOfWeek);

    this.todayHours = this.recent
      .filter((entry) => this.toIsoDate(entry.date) === today)
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

    this.weekHours = this.recent
      .filter((entry) => this.toIsoDate(entry.date) >= weekStart)
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);

    this.pendingCount = this.recent.filter((entry) => (entry.status || '').toUpperCase() === 'PENDING').length;
  }

  /* ---------- actions ---------- */

  setHours(hours: number): void {
    this.form.patchValue({ hours });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please complete the required fields.', 'Close', { duration: 3000 });
      return;
    }

    const value = this.form.value;
    const payload: TimesheetEntry = {
      employeeName: localStorage.getItem('email') || localStorage.getItem('name') || 'Unknown',
      date: this.toIsoDate(value.date),
      hours: Number(value.hours),
      project: value.project,
      status: value.status || this.defaultStatus()
    };

    this.submitting = true;
    this.timesheetService.saveTimesheet(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.form.patchValue({ hours: 8, status: this.defaultStatus() });
        this.snackBar.open('Timesheet submitted for approval.', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        console.error('Timesheet submit failed', err);
        this.submitting = false;
        this.snackBar.open('Could not submit the timesheet. Please try again.', 'Close', { duration: 4000 });
      }
    });
  }

  /* ---------- helpers ---------- */

  toIsoDate(value: Date | string): string {
    if (!value) {
      return '';
    }
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) {
      return String(value);
    }
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  statusBadge(status: string): string {
    return this.reference.badge('TIMESHEET_STATUS', status);
  }

  /** The word on the pill, e.g. "Pending approval". */
  statusLabel(status: string): string {
    return this.reference.label('TIMESHEET_STATUS', status) || '—';
  }
}
