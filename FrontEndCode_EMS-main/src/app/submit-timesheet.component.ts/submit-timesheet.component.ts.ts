import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DailyTimesheet, DailyTimesheetTaskItem, TaskModel } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { WorkspaceService } from '../services/workspace.service';
import { ReferenceService } from '../services/reference.service';

interface TaskDropdownOption {
  taskId: number | null;
  taskCode: string;
  taskTitle: string;
  kind: string;
  isOther: boolean;
}

interface FormTaskEntry {
  id?: string;
  project: string;
  taskId?: number | null;
  taskCode: string;
  taskTitle: string;
  kind: string;
  workDescription: string;
  hours: number;
  remarks: string;
  availableTasks: TaskDropdownOption[];
  loadingTasks: boolean;
}

@Component({
  selector: 'app-submit-timesheet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  workDate: Date = new Date();
  maxDate = new Date();

  projectOptions: string[] = [];
  entries: FormTaskEntry[] = [];
  overtimeRemarks = '';

  currentSheetId?: string;
  currentStatus: string = 'NEW';
  isReadOnly = false;
  rejectionReason = '';

  reportingPerson = {
    name: 'Team Leader',
    email: '',
    role: ''
  };

  recent: DailyTimesheet[] = [];

  loading = true;
  saving = false;
  submitting = false;
  errorMessage = '';

  todayHours = 0;
  weekHours = 0;
  pendingCount = 0;
  approvedCount = 0;
  rejectedCount = 0;

  // Cached project tasks to avoid re-fetching on multiple rows with same project
  private projectTaskCache: Map<string, TaskDropdownOption[]> = new Map();

  constructor(
    private http: HttpClient,
    private timesheetService: Timesheet,
    private workspace: WorkspaceService,
    private snackBar: MatSnackBar,
    private reference: ReferenceService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initFirstEntry();

    this.route.queryParams.subscribe((params) => {
      const editDate = params['editDate'] || params['date'];
      if (editDate) {
        const parsed = new Date(editDate);
        if (!isNaN(parsed.getTime())) {
          this.workDate = parsed;
        }
      }
      this.loadContext();
    });
  }

  initFirstEntry(): void {
    this.entries = [this.createBlankEntry()];
  }

  createBlankEntry(project = ''): FormTaskEntry {
    return {
      project: project,
      taskId: null,
      taskCode: 'OTHER',
      taskTitle: 'Other Work (Meetings, Training, Admin)',
      kind: 'OTHER',
      workDescription: '',
      hours: 2,
      remarks: '',
      availableTasks: [
        {
          taskId: null,
          taskCode: 'OTHER',
          taskTitle: 'Other Work (Meetings, Training, Admin)',
          kind: 'OTHER',
          isOther: true
        }
      ],
      loadingTasks: false
    };
  }

  /* ---------- Calculations & Status ---------- */

  get totalHours(): number {
    const sum = this.entries.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);
    return Math.round(sum * 10) / 10;
  }

  get isUnderStandardHours(): boolean {
    return this.totalHours > 0 && this.totalHours < 8.0;
  }

  get isOvertime(): boolean {
    return this.totalHours > 8.0;
  }

  /* ---------- Context & Data Loading ---------- */

  loadContext(): void {
    this.loading = true;
    this.errorMessage = '';

    const email = localStorage.getItem('email') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);

    forkJoin({
      projects: this.workspace.getProjects(),
      assigned: this.http.get<TaskModel[]>(`http://localhost:9001/api/assigntasks/getAssignTask?email=${email}`, { headers }),
      reporting: this.timesheetService.getReportingPerson(),
      summary: this.timesheetService.getSummary(),
      mySheets: this.timesheetService.getMyDailyTimesheets()
    }).subscribe({
      next: ({ projects, assigned, reporting, summary, mySheets }) => {
        const names = new Set<string>();
        (projects || []).forEach((p) => p.name && names.add(p.name));
        (assigned || []).forEach((t) => t.project && names.add(t.project));

        const projectParam = this.route.snapshot.queryParams['project'];
        if (projectParam) {
          names.add(projectParam);
        }

        this.projectOptions = Array.from(names).sort();

        if (projectParam && this.entries.length && (!this.entries[0].project || this.entries[0].project === '')) {
          this.entries[0].project = projectParam;
          this.onProjectSelect(0);
        }

        if (reporting) {
          this.reportingPerson = {
            name: reporting.reportingPersonName || 'Team Leader',
            email: reporting.reportingPersonEmail || '',
            role: reporting.employeeRole || ''
          };
        }

        if (summary) {
          this.todayHours = summary.todayHours || 0;
          this.weekHours = summary.weekHours || 0;
          this.pendingCount = summary.pendingCount || 0;
          this.approvedCount = summary.approvedCount || 0;
          this.rejectedCount = summary.rejectedCount || 0;
        }

        this.recent = mySheets || [];
        this.checkExistingTimesheetForDate();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load timesheet context', err);
        this.errorMessage = 'Could not load your workspace projects and reporting setup.';
        this.loading = false;
      }
    });
  }

  onDateChange(): void {
    this.checkExistingTimesheetForDate();
  }

  /**
   * Checks if a timesheet already exists for the selected date.
   * If approved: locks form into read-only mode.
   * If draft or rejected: loads entries for editing/resubmission.
   * If submitted: shows warning that approval is currently pending.
   */
  checkExistingTimesheetForDate(): void {
    const isoDate = this.toIsoDate(this.workDate);
    const existing = this.recent.find((s) => this.toIsoDate(s.workDate) === isoDate);

    if (existing) {
      this.currentSheetId = existing.id;
      this.currentStatus = (existing.status || 'DRAFT').toUpperCase();
      this.isReadOnly = this.currentStatus === 'APPROVED';
      this.rejectionReason = existing.rejectionReason || '';
      this.overtimeRemarks = existing.overtimeRemarks || '';

      if (existing.entries && existing.entries.length > 0) {
        this.entries = existing.entries.map((item) => ({
          id: item.id,
          project: item.project,
          taskId: item.taskId,
          taskCode: item.taskCode || 'OTHER',
          taskTitle: item.taskTitle || 'Other Work',
          kind: item.kind || 'TASK',
          workDescription: item.workDescription || '',
          hours: item.hours || 0,
          remarks: item.remarks || '',
          availableTasks: [],
          loadingTasks: false
        }));

        // Load project task dropdown options for each row
        this.entries.forEach((entry, idx) => {
          if (entry.project) {
            this.loadTasksForEntry(idx, entry.project, entry.taskCode);
          }
        });
        return;
      }
    }

    // New sheet for this date
    this.currentSheetId = undefined;
    this.currentStatus = 'NEW';
    this.isReadOnly = false;
    this.rejectionReason = '';
    this.overtimeRemarks = '';
    this.initFirstEntry();

    if (this.projectOptions.length > 0) {
      this.entries[0].project = this.projectOptions[0];
      this.onProjectSelect(0);
    }
  }

  /* ---------- Row Management ---------- */

  addTaskEntry(): void {
    if (this.isReadOnly) return;
    const defaultProj = this.entries.length > 0 ? this.entries[this.entries.length - 1].project : (this.projectOptions[0] || '');
    const newEntry = this.createBlankEntry(defaultProj);
    this.entries.push(newEntry);
    if (defaultProj) {
      this.onProjectSelect(this.entries.length - 1);
    }
  }

  removeTaskEntry(index: number): void {
    if (this.isReadOnly) return;
    if (this.entries.length > 1) {
      this.entries.splice(index, 1);
    } else {
      this.snackBar.open('Timesheet requires at least one task entry.', 'Close', { duration: 3000 });
    }
  }

  onProjectSelect(index: number): void {
    const entry = this.entries[index];
    if (!entry || !entry.project) return;
    this.loadTasksForEntry(index, entry.project);
  }

  private loadTasksForEntry(index: number, project: string, keepTaskCode?: string): void {
    const entry = this.entries[index];
    if (!entry) return;

    if (this.projectTaskCache.has(project)) {
      entry.availableTasks = this.projectTaskCache.get(project) || [];
      this.syncSelectedTask(entry, keepTaskCode);
      return;
    }

    entry.loadingTasks = true;
    this.timesheetService.getMyTasksForProject(project).subscribe({
      next: (tasks) => {
        const formatted: TaskDropdownOption[] = (tasks || []).map((t) => ({
          taskId: t.taskId || null,
          taskCode: t.taskCode || 'OTHER',
          taskTitle: t.taskTitle || 'Other Work',
          kind: t.kind || 'TASK',
          isOther: !!t.isOther
        }));

        this.projectTaskCache.set(project, formatted);
        entry.availableTasks = formatted;
        this.syncSelectedTask(entry, keepTaskCode);
        entry.loadingTasks = false;
      },
      error: () => {
        entry.availableTasks = [
          { taskId: null, taskCode: 'OTHER', taskTitle: 'Other Work (Meetings, Training, Admin)', kind: 'OTHER', isOther: true }
        ];
        entry.loadingTasks = false;
      }
    });
  }

  private syncSelectedTask(entry: FormTaskEntry, keepCode?: string): void {
    if (keepCode) {
      const match = entry.availableTasks.find((t) => t.taskCode === keepCode);
      if (match) {
        entry.taskId = match.taskId;
        entry.taskCode = match.taskCode;
        entry.taskTitle = match.taskTitle;
        entry.kind = match.kind;
        return;
      }
    }
    // Select first if available
    if (entry.availableTasks.length > 0) {
      const first = entry.availableTasks[0];
      entry.taskId = first.taskId;
      entry.taskCode = first.taskCode;
      entry.taskTitle = first.taskTitle;
      entry.kind = first.kind;
    }
  }

  onTaskSelect(index: number, taskCode: string): void {
    const entry = this.entries[index];
    if (!entry) return;
    const match = entry.availableTasks.find((t) => t.taskCode === taskCode);
    if (match) {
      entry.taskId = match.taskId;
      entry.taskCode = match.taskCode;
      entry.taskTitle = match.taskTitle;
      entry.kind = match.kind;
    }
  }

  /* ---------- Submission Actions ---------- */

  saveAsDraft(): void {
    this.submitTimesheet(false);
  }

  submitForApproval(): void {
    this.submitTimesheet(true);
  }

  private submitTimesheet(submit: boolean): void {
    if (this.isReadOnly) {
      this.snackBar.open('This timesheet has already been approved and cannot be altered.', 'Close', { duration: 4000 });
      return;
    }

    if (!this.workDate) {
      this.snackBar.open('Work date is mandatory.', 'Close', { duration: 3000 });
      return;
    }

    // Row validations
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (!e.project || !e.project.trim()) {
        this.snackBar.open(`Task entry #${i + 1}: Please select a project.`, 'Close', { duration: 3500 });
        return;
      }
      if (!e.workDescription || !e.workDescription.trim()) {
        this.snackBar.open(`Task entry #${i + 1}: Work description is required.`, 'Close', { duration: 3500 });
        return;
      }
      if (!e.hours || e.hours <= 0) {
        this.snackBar.open(`Task entry #${i + 1}: Hours must be greater than zero.`, 'Close', { duration: 3500 });
        return;
      }
    }

    // Overtime validation on submission
    if (submit && this.isOvertime && (!this.overtimeRemarks || !this.overtimeRemarks.trim())) {
      this.snackBar.open('Daily total exceeds standard 8 hours. Overtime remarks are required before submitting.', 'Close', { duration: 4500 });
      return;
    }

    const payload: Partial<DailyTimesheet> = {
      id: this.currentSheetId,
      workDate: this.toIsoDate(this.workDate),
      overtimeRemarks: this.overtimeRemarks ? this.overtimeRemarks.trim() : '',
      entries: this.entries.map((e) => ({
        id: e.id,
        project: e.project.trim(),
        taskId: e.taskId,
        taskCode: e.taskCode,
        taskTitle: e.taskTitle,
        kind: e.kind,
        workDescription: e.workDescription.trim(),
        hours: Number(e.hours),
        remarks: e.remarks ? e.remarks.trim() : ''
      }))
    };

    if (submit) {
      this.submitting = true;
    } else {
      this.saving = true;
    }

    this.timesheetService.saveDaily(payload, submit).subscribe({
      next: (saved) => {
        this.submitting = false;
        this.saving = false;
        const msg = submit
          ? (this.currentStatus === 'REJECTED' ? 'Timesheet resubmitted for approval.' : 'Timesheet submitted to reporting lead for approval.')
          : 'Timesheet saved as Draft.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.loadContext();
      },
      error: (err) => {
        this.submitting = false;
        this.saving = false;
        console.error('Failed to save timesheet', err);
        const errMsg = err?.error?.message || 'Could not save timesheet. Please verify all fields and try again.';
        this.snackBar.open(errMsg, 'Close', { duration: 5000 });
      }
    });
  }

  loadEntryForEdit(sheet: DailyTimesheet): void {
    if (!sheet) return;
    this.workDate = new Date(sheet.workDate);
    this.checkExistingTimesheetForDate();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.workDate = new Date();
    this.checkExistingTimesheetForDate();
  }

  /* ---------- Helpers ---------- */

  toIsoDate(value: Date | string): string {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return String(value);
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  statusBadge(status?: string): string {
    const s = (status || 'DRAFT').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'ems-badge--success';
      case 'SUBMITTED':
      case 'PENDING': return 'ems-badge--info';
      case 'UNDER_REVIEW': return 'ems-badge--warning';
      case 'REJECTED': return 'ems-badge--danger';
      default: return 'ems-badge--neutral';
    }
  }

  statusLabel(status?: string): string {
    const s = (status || 'DRAFT').toUpperCase();
    switch (s) {
      case 'APPROVED': return 'Approved';
      case 'SUBMITTED': return 'Submitted';
      case 'PENDING': return 'Pending Approval';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'REJECTED': return 'Rejected';
      case 'DRAFT': return 'Draft';
      default: return s;
    }
  }
}
