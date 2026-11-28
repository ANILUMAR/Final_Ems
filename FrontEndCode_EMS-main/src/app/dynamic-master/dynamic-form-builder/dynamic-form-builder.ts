import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicMasterService } from '../../services/dynamic-master.service';
import { MasterDataService } from '../../services/master-data.service';
import {
  DynamicFormSchema,
  FormFieldDefinition,
  FormFieldType,
  OptionItem
} from '../../models/dynamic-master.model';

interface ComponentPaletteItem {
  type: FormFieldType;
  label: string;
  icon: string;
  category: 'INPUT' | 'CHOICE' | 'DATE_TOGGLE';
  defaultColSpan: number;
  defaultLabel: string;
}

@Component({
  selector: 'app-dynamic-form-builder',
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
    MatOptionModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './dynamic-form-builder.html',
  styleUrl: './dynamic-form-builder.css'
})
export class DynamicFormBuilderComponent implements OnInit {
  private dynamicMasterService = inject(DynamicMasterService);
  private masterDataService = inject(MasterDataService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  loading = false;
  saving = false;
  activeTab: 'DESIGNER' | 'PREVIEW' = 'DESIGNER';

  /** Master Schema currently being authored/edited */
  schema: DynamicFormSchema = {
    screenCode: '',
    screenName: '',
    module: '',
    subModule: '',
    description: '',
    fields: [],
    active: true
  };

  /** Index of the field currently selected in the Inspector panel */
  selectedFieldIndex = -1;

  /** Existing schemas available to link for LOOKUP fields */
  availableSchemas: DynamicFormSchema[] = [];

  /** Master hierarchy (Modules, Submodules, Screens) from existing system */
  masterModules: any[] = [];
  masterSubModules: any[] = [];

  /** Live Test Preview State */
  previewForm: FormGroup = this.fb.group({});
  previewLookupChoices: Record<string, any[]> = {};
  previewSubmissionResult: any = null;

  readonly paletteItems: ComponentPaletteItem[] = [
    { type: 'TEXT', label: 'Single-line Text', icon: 'text_fields', category: 'INPUT', defaultColSpan: 6, defaultLabel: 'Text Field' },
    { type: 'TEXTAREA', label: 'Multi-line Text', icon: 'notes', category: 'INPUT', defaultColSpan: 12, defaultLabel: 'Description' },
    { type: 'NUMBER', label: 'Number', icon: 'tag', category: 'INPUT', defaultColSpan: 6, defaultLabel: 'Quantity / Number' },
    { type: 'CURRENCY', label: 'Currency', icon: 'attach_money', category: 'INPUT', defaultColSpan: 6, defaultLabel: 'Price / Budget' },
    { type: 'EMAIL', label: 'Email Address', icon: 'email', category: 'INPUT', defaultColSpan: 6, defaultLabel: 'Email' },
    { type: 'PHONE', label: 'Phone Number', icon: 'phone', category: 'INPUT', defaultColSpan: 6, defaultLabel: 'Phone Number' },
    { type: 'SELECT', label: 'Dropdown Select', icon: 'arrow_drop_down_circle', category: 'CHOICE', defaultColSpan: 6, defaultLabel: 'Select Option' },
    { type: 'LOOKUP', label: 'Dynamic Master Lookup', icon: 'dataset', category: 'CHOICE', defaultColSpan: 6, defaultLabel: 'Master Relation' },
    { type: 'RADIO', label: 'Radio Choices', icon: 'radio_button_checked', category: 'CHOICE', defaultColSpan: 6, defaultLabel: 'Options' },
    { type: 'DATE', label: 'Date Picker', icon: 'calendar_today', category: 'DATE_TOGGLE', defaultColSpan: 6, defaultLabel: 'Date' },
    { type: 'TOGGLE', label: 'Switch / Toggle', icon: 'toggle_on', category: 'DATE_TOGGLE', defaultColSpan: 6, defaultLabel: 'Active Status' }
  ];

  ngOnInit(): void {
    this.loadPrerequisites();
    const codeParam = this.route.snapshot.paramMap.get('screenCode');
    if (codeParam) {
      this.loadExistingSchema(codeParam);
    } else {
      // Check query params if pre-filled from Master setup
      const queryCode = this.route.snapshot.queryParamMap.get('code');
      const queryName = this.route.snapshot.queryParamMap.get('name');
      const queryMod = this.route.snapshot.queryParamMap.get('module');
      const querySub = this.route.snapshot.queryParamMap.get('subModule');

      if (queryCode) this.schema.screenCode = this.normalizeCode(queryCode);
      if (queryName) this.schema.screenName = queryName;
      if (queryMod) this.schema.module = queryMod;
      if (querySub) this.schema.subModule = querySub;

      // Provide starter fields if empty
      if (this.schema.fields.length === 0) {
        this.addStarterFields();
      }
    }
  }

  private loadPrerequisites(): void {
    this.dynamicMasterService.listSchemas().subscribe({
      next: (list) => {
        this.availableSchemas = list || [];
      },
      error: () => {}
    });

    this.masterDataService.load().subscribe({
      next: () => {
        this.masterModules = this.masterDataService.modules || [];
      },
      error: () => {}
    });
  }

  private loadExistingSchema(code: string): void {
    this.loading = true;
    this.dynamicMasterService.getSchema(code).subscribe({
      next: (found) => {
        this.schema = found;
        if (this.schema.fields && this.schema.fields.length > 0) {
          this.selectedFieldIndex = 0;
        }
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open('Could not load schema: ' + (err.error || err.message), 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  private addStarterFields(): void {
    this.schema.fields = [
      {
        fieldKey: 'code',
        fieldLabel: 'Code',
        fieldType: 'TEXT',
        placeholder: 'e.g. DEPT-01',
        colSpan: 6,
        required: true,
        unique: true,
        showInGrid: true,
        filterable: true,
        sortable: true
      },
      {
        fieldKey: 'name',
        fieldLabel: 'Name',
        fieldType: 'TEXT',
        placeholder: 'e.g. Human Resources',
        colSpan: 6,
        required: true,
        showInGrid: true,
        filterable: true,
        sortable: true
      },
      {
        fieldKey: 'description',
        fieldLabel: 'Description',
        fieldType: 'TEXTAREA',
        placeholder: 'Optional notes and details...',
        colSpan: 12,
        required: false,
        showInGrid: false,
        filterable: true
      },
      {
        fieldKey: 'isActive',
        fieldLabel: 'Active',
        fieldType: 'TOGGLE',
        defaultValue: true,
        colSpan: 6,
        showInGrid: true
      }
    ];
    this.selectedFieldIndex = 0;
  }

  get selectedField(): FormFieldDefinition | null {
    if (this.selectedFieldIndex >= 0 && this.selectedFieldIndex < this.schema.fields.length) {
      return this.schema.fields[this.selectedFieldIndex];
    }
    return null;
  }

  selectField(index: number): void {
    this.selectedFieldIndex = index;
  }

  /* =========================================================================
   * PALETTE & FIELD MODIFICATIONS
   * ========================================================================= */

  addFieldFromPalette(item: ComponentPaletteItem): void {
    const key = this.generateFieldKey(item.defaultLabel);
    const newField: FormFieldDefinition = {
      fieldKey: key,
      fieldLabel: item.defaultLabel,
      fieldType: item.type,
      placeholder: 'Enter ' + item.defaultLabel.toLowerCase() + '...',
      colSpan: item.defaultColSpan,
      required: false,
      showInGrid: true,
      filterable: true,
      sortable: true,
      options: item.type === 'SELECT' || item.type === 'RADIO' ? [
        { label: 'Option 1', value: 'opt_1' },
        { label: 'Option 2', value: 'opt_2' }
      ] : []
    };

    if (item.type === 'TOGGLE') {
      newField.defaultValue = true;
    }

    this.schema.fields.push(newField);
    this.selectedFieldIndex = this.schema.fields.length - 1;
    this.snackBar.open(`Added "${newField.fieldLabel}" field`, undefined, { duration: 1800 });
  }

  removeField(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.schema.fields.splice(index, 1);
    if (this.selectedFieldIndex >= this.schema.fields.length) {
      this.selectedFieldIndex = this.schema.fields.length - 1;
    }
  }

  moveField(index: number, direction: 'UP' | 'DOWN', event?: Event): void {
    if (event) event.stopPropagation();
    if (direction === 'UP' && index > 0) {
      const temp = this.schema.fields[index];
      this.schema.fields[index] = this.schema.fields[index - 1];
      this.schema.fields[index - 1] = temp;
      this.selectedFieldIndex = index - 1;
    } else if (direction === 'DOWN' && index < this.schema.fields.length - 1) {
      const temp = this.schema.fields[index];
      this.schema.fields[index] = this.schema.fields[index + 1];
      this.schema.fields[index + 1] = temp;
      this.selectedFieldIndex = index + 1;
    }
  }

  duplicateField(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    const source = this.schema.fields[index];
    const copy: FormFieldDefinition = JSON.parse(JSON.stringify(source));
    copy.fieldKey = this.generateFieldKey(source.fieldKey + '_copy');
    copy.fieldLabel = source.fieldLabel + ' (Copy)';
    this.schema.fields.splice(index + 1, 0, copy);
    this.selectedFieldIndex = index + 1;
  }

  /* Option management for Dropdown / Radio */
  addOption(field: FormFieldDefinition): void {
    if (!field.options) field.options = [];
    const count = field.options.length + 1;
    field.options.push({ label: 'Option ' + count, value: 'option_' + count });
  }

  removeOption(field: FormFieldDefinition, optIndex: number): void {
    if (field.options) {
      field.options.splice(optIndex, 1);
    }
  }

  /* Regex Presets */
  applyRegexPreset(field: FormFieldDefinition, preset: string): void {
    switch (preset) {
      case 'ALPHANUMERIC':
        field.pattern = '^[A-Z0-9_-]+$';
        field.regexMessage = 'Only uppercase letters, digits, underscores, and hyphens permitted.';
        break;
      case 'EMAIL':
        field.pattern = '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$';
        field.regexMessage = 'Must be a valid email address.';
        break;
      case 'PHONE':
        field.pattern = '^\\+?[0-9]{7,15}$';
        field.regexMessage = 'Must be a valid phone number (7-15 digits).';
        break;
      case 'NUMBERS':
        field.pattern = '^[0-9]+$';
        field.regexMessage = 'Only numbers allowed.';
        break;
      case 'CLEAR':
        field.pattern = '';
        field.regexMessage = '';
        break;
    }
  }

  private generateFieldKey(label: string): string {
    let key = (label || 'field').trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^[0-9]/.test(key)) key = 'f_' + key;
    let candidate = key;
    let suffix = 1;
    while (this.schema.fields.some((f) => f.fieldKey === candidate)) {
      candidate = `${key}_${suffix++}`;
    }
    return candidate;
  }

  normalizeCode(val: string): string {
    return (val || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }

  onScreenNameChange(): void {
    if (!this.schema.screenCode && this.schema.screenName) {
      this.schema.screenCode = this.normalizeCode(this.schema.screenName) + '_MASTER';
    }
  }

  /* =========================================================================
   * LIVE TEST & PREVIEW
   * ========================================================================= */

  switchToPreview(): void {
    this.activeTab = 'PREVIEW';
    this.previewSubmissionResult = null;
    this.buildPreviewForm();
  }

  switchToDesigner(): void {
    this.activeTab = 'DESIGNER';
  }

  private buildPreviewForm(): void {
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

      let initVal = field.defaultValue !== undefined ? field.defaultValue : '';
      if (field.fieldType === 'TOGGLE' && initVal === '') {
        initVal = true;
      }
      group[field.fieldKey] = [initVal, validators];

      // If lookup, fetch sample choices
      if (field.fieldType === 'LOOKUP' && field.lookupScreenCode) {
        this.dynamicMasterService.getLookupOptions(field.lookupScreenCode).subscribe({
          next: (opts) => {
            this.previewLookupChoices[field.fieldKey] = opts || [];
          },
          error: () => {
            this.previewLookupChoices[field.fieldKey] = [
              { value: 'SAMPLE-1', label: 'Sample Choice 1' },
              { value: 'SAMPLE-2', label: 'Sample Choice 2' }
            ];
          }
        });
      }
    }
    this.previewForm = this.fb.group(group);
  }

  testSubmit(): void {
    if (this.previewForm.invalid) {
      this.previewForm.markAllAsTouched();
      this.snackBar.open('Form contains validation errors. Please fix them above.', 'Close', { duration: 3000 });
      return;
    }
    this.previewSubmissionResult = this.previewForm.value;
    this.snackBar.open('Validation Passed! Sample record created successfully in preview mode.', 'Close', { duration: 3500 });
  }

  /* =========================================================================
   * SAVE & PUBLISH
   * ========================================================================= */

  saveSchema(): void {
    if (!this.schema.screenName?.trim()) {
      this.snackBar.open('Please provide a Screen Name.', 'Close', { duration: 3000 });
      return;
    }
    this.schema.screenCode = this.normalizeCode(this.schema.screenCode);
    if (!this.schema.screenCode) {
      this.snackBar.open('Please provide a Screen Code (e.g. DEPT_MASTER).', 'Close', { duration: 3000 });
      return;
    }
    if (!this.schema.fields || this.schema.fields.length === 0) {
      this.snackBar.open('Please add at least one field to this master screen.', 'Close', { duration: 3000 });
      return;
    }

    // Check duplicate keys
    const keys = new Set<string>();
    for (const f of this.schema.fields) {
      if (keys.has(f.fieldKey)) {
        this.snackBar.open(`Duplicate field key detected: "${f.fieldKey}". Keys must be unique.`, 'Close', { duration: 3500 });
        return;
      }
      keys.add(f.fieldKey);
    }

    this.saving = true;
    this.dynamicMasterService.saveSchema(this.schema).subscribe({
      next: (saved) => {
        this.saving = false;
        this.snackBar.open(`Master Schema "${saved.screenName}" published successfully!`, 'View Screen', {
          duration: 5000
        }).onAction().subscribe(() => {
          this.router.navigate(['/dynamic-masters/view', saved.screenCode]);
        });
        this.router.navigate(['/dynamic-masters']);
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open('Error saving schema: ' + (err.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }
}
