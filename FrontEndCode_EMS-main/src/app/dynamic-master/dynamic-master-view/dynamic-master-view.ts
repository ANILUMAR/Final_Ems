import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicMasterService } from '../../services/dynamic-master.service';
import {
  DynamicFormSchema,
  DynamicMasterPageResult,
  DynamicMasterRecord,
  FormFieldDefinition,
  LookupOption
} from '../../models/dynamic-master.model';
import { isSuperAdminRole } from '../../models/role';
import { Pager } from '../../shared/pager';

@Component({
  selector: 'app-dynamic-master-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    Pager
  ],
  templateUrl: './dynamic-master-view.html',
  styleUrl: './dynamic-master-view.css'
})
export class DynamicMasterViewComponent implements OnInit {
  private dynamicMasterService = inject(DynamicMasterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  screenCode = '';
  schema: DynamicFormSchema | null = null;
  allSchemas: DynamicFormSchema[] = [];

  loading = true;
  saving = false;
  exporting = false;
  search = '';

  /** Records list & pagination */
  pageResult: DynamicMasterPageResult<DynamicMasterRecord> = {
    items: [],
    totalElements: 0,
    totalPages: 0,
    page: 0,
    size: 10
  };
  sortField = 'id';
  sortDir: 'asc' | 'desc' = 'desc';

  /** Modal Form State */
  showModal = false;
  isEditMode = false;
  currentRecordId: number | null = null;
  recordForm: FormGroup = this.fb.group({});
  lookupOptionsMap: Record<string, LookupOption[]> = {};

  role = (localStorage.getItem('role') || '').toUpperCase();

  get canEditSchema(): boolean {
    return isSuperAdminRole(this.role) || this.role === 'ADMIN';
  }

  ngOnInit(): void {
    // Listen to route param changes
    this.route.paramMap.subscribe((params) => {
      const code = params.get('screenCode');
      if (code) {
        this.screenCode = code;
        this.loadSchemaAndData();
      }
    });

    this.loadAllSchemas();
  }

  loadAllSchemas(): void {
    this.dynamicMasterService.listSchemas().subscribe({
      next: (list) => {
        this.allSchemas = list || [];
        if (!this.screenCode && this.allSchemas.length > 0) {
          this.switchScreen(this.allSchemas[0].screenCode);
        }
      },
      error: () => {}
    });
  }

  switchScreen(code: string): void {
    if (!code) return;
    this.router.navigate(['/dynamic-masters/view', code]);
  }

  loadSchemaAndData(): void {
    if (!this.screenCode) return;
    this.loading = true;

    this.dynamicMasterService.getSchema(this.screenCode).subscribe({
      next: (sch) => {
        this.schema = sch;
        this.preloadLookupOptions();
        this.loadRecords();
      },
      error: (err) => {
        this.snackBar.open('Could not load schema: ' + (err.error || err.message), 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  loadRecords(): void {
    this.loading = true;
    this.dynamicMasterService
      .listRecords(this.screenCode, {
        search: this.search,
        page: this.pageResult.page,
        size: this.pageResult.size,
        sortField: this.sortField,
        sortDir: this.sortDir
      })
      .subscribe({
        next: (res) => {
          this.pageResult = res;
          this.loading = false;
        },
        error: (err) => {
          this.snackBar.open('Failed to load records: ' + (err.error || err.message), 'Close', { duration: 4000 });
          this.loading = false;
        }
      });
  }

  get gridFields(): FormFieldDefinition[] {
    if (!this.schema?.fields) return [];
    return this.schema.fields.filter((f) => f.showInGrid !== false);
  }

  onSearchChange(): void {
    this.pageResult.page = 0;
    this.loadRecords();
  }

  clearSearch(): void {
    this.search = '';
    this.pageResult.page = 0;
    this.loadRecords();
  }

  onPageChange(newPage: number): void {
    this.pageResult.page = newPage;
    this.loadRecords();
  }

  onPageSizeChange(newSize: number): void {
    this.pageResult.size = newSize;
    this.pageResult.page = 0;
    this.loadRecords();
  }

  sortBy(fieldKey: string): void {
    if (this.sortField === fieldKey) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = fieldKey;
      this.sortDir = 'asc';
    }
    this.loadRecords();
  }

  /* =========================================================================
   * LOOKUP CHOICES PRELOADING
   * ========================================================================= */

  private preloadLookupOptions(): void {
    if (!this.schema?.fields) return;
    for (const f of this.schema.fields) {
      if (f.fieldType === 'LOOKUP' && f.lookupScreenCode) {
        this.dynamicMasterService.getLookupOptions(f.lookupScreenCode).subscribe({
          next: (opts) => {
            this.lookupOptionsMap[f.fieldKey] = opts || [];
          },
          error: () => {}
        });
      }
    }
  }

  getLookupDisplayLabel(field: FormFieldDefinition, value: any): string {
    if (value === undefined || value === null || value === '') return '—';
    const list = this.lookupOptionsMap[field.fieldKey];
    if (list) {
      const match = list.find((opt) => String(opt.value) === String(value) || opt.id === value);
      if (match) return match.label;
    }
    return String(value);
  }

  /* =========================================================================
   * DYNAMIC FORM MODAL (CREATE / EDIT)
   * ========================================================================= */

  openCreateModal(): void {
    this.isEditMode = false;
    this.currentRecordId = null;
    this.buildRecordForm();
    this.showModal = true;
  }

  openEditModal(record: DynamicMasterRecord): void {
    this.isEditMode = true;
    this.currentRecordId = record.id;
    this.buildRecordForm(record.data);
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.recordForm.reset();
  }

  private buildRecordForm(initialData?: Record<string, any>): void {
    if (!this.schema?.fields) return;

    const group: Record<string, any> = {};

    for (const field of this.schema.fields) {
      const validators = [];
      if (field.required) {
        validators.push(Validators.required);
      }
      if (field.minLength) {
        validators.push(Validators.minLength(field.minLength));
      }
      if (field.maxLength) {
        validators.push(Validators.maxLength(field.maxLength));
      }
      if (field.min !== undefined && field.min !== null) {
        validators.push(Validators.min(field.min));
      }
      if (field.max !== undefined && field.max !== null) {
        validators.push(Validators.max(field.max));
      }
      if (field.pattern) {
        validators.push(Validators.pattern(field.pattern));
      }

      let val = initialData && initialData[field.fieldKey] !== undefined
        ? initialData[field.fieldKey]
        : (field.defaultValue !== undefined ? field.defaultValue : '');

      if (field.fieldType === 'TOGGLE' && val === '') {
        val = true;
      }

      group[field.fieldKey] = [val, validators];
    }

    this.recordForm = this.fb.group(group);
  }

  submitRecord(): void {
    if (this.recordForm.invalid) {
      this.recordForm.markAllAsTouched();
      this.snackBar.open('Please fix the errors in the form before saving.', 'Close', { duration: 3000 });
      return;
    }

    this.saving = true;
    const payload = this.recordForm.value;

    const req$ = this.isEditMode && this.currentRecordId
      ? this.dynamicMasterService.updateRecord(this.screenCode, this.currentRecordId, payload)
      : this.dynamicMasterService.saveRecord(this.screenCode, payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.closeModal();
        this.snackBar.open(
          this.isEditMode ? 'Record updated successfully!' : 'New record created successfully!',
          undefined,
          { duration: 3000 }
        );
        this.loadRecords();
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open('Error saving record: ' + (err.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  deleteRecord(record: DynamicMasterRecord): void {
    const promptMsg = `Are you sure you want to delete record #${record.id}?`;
    if (!confirm(promptMsg)) return;

    this.dynamicMasterService.deleteRecord(this.screenCode, record.id).subscribe({
      next: () => {
        this.snackBar.open('Record deleted successfully.', undefined, { duration: 3000 });
        this.loadRecords();
      },
      error: (err) => {
        this.snackBar.open('Failed to delete record: ' + (err.error || err.message), 'Close', { duration: 4000 });
      }
    });
  }

  /* =========================================================================
   * EXCEL EXPORT
   * ========================================================================= */

  exportExcel(): void {
    this.exporting = true;
    this.dynamicMasterService.exportExcel(this.screenCode).subscribe({
      next: (blob) => {
        this.exporting = false;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.screenCode.toLowerCase()}_data.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.exporting = false;
        this.snackBar.open('Export failed: ' + (err.error || err.message), 'Close', { duration: 4000 });
      }
    });
  }
}
