import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import { isSuperAdminRole } from '../models/role';
import { RolePermissionService } from '../services/role-permission.service';
import { MasterDataService, MasterEntry, MasterType } from '../services/master-data.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, lastPageOf, pageSlice } from '../shared/pagination';

export interface PreviewRow {
  module: string;
  subModule: string;
  screen: string;
  isValid: boolean;
}

/**
 * Master data: the module -> sub module -> screen tree the task forms pick from.
 *
 * <p>The three columns are read left to right, in the order a task is described:
 * a sub module only appears once its module is chosen, and a screen only once
 * its sub module is. Reading is open to every signed-in account - the task forms
 * need the lists - while adding and retiring is the CEO's job alone; the backend
 * enforces it again on every write.</p>
 */
@Component({
  selector: 'app-master-data',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    Pager
  ],
  templateUrl: './master-data.html',
  styleUrl: './master-data.css'
})
export class MasterData implements OnInit {
  private master = inject(MasterDataService);
  private snackBar = inject(MatSnackBar);

  readonly Math = Math;

  role = (localStorage.getItem('role') || '').toUpperCase();

  loading = true;
  saving = false;
  errorMessage = '';

  /** Excel Upload Modal State */
  showUploadModal = false;
  isDragging = false;
  uploading = false;
  selectedFile: File | null = null;
  parsedPreviewRows: PreviewRow[] = [];
  importWarnings: string[] = [];

  /** The row each column to the right is filtered by. */
  moduleId: number | null = null;
  subModuleId: number | null = null;

  /** What is currently typed in each column's add box. */
  newModule = '';
  newSubModule = '';
  newScreen = '';

  /**
   * Each column pages on its own, with the same size: scrolling the sub module
   * column must not move the module the user is looking at.
   */
  modulePage = 0;
  subModulePage = 0;
  screenPage = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  /** Below this many rows a column fits one page, so its pager stays away. */
  readonly smallestPage = PAGE_SIZE_OPTIONS[0];

  ngOnInit(): void {
    this.reload();
  }

  private rolePermissionService = inject(RolePermissionService);

  /* ---------- rights ---------- */

  /** Curating the vocabulary dynamically checks role permissions or super admin authority. */
  get canEdit(): boolean {
    return isSuperAdminRole(this.role) || this.rolePermissionService.hasPermission('MODULE_SCREEN_SETUP', 'edit');
  }

  get canDelete(): boolean {
    return isSuperAdminRole(this.role) || this.rolePermissionService.hasPermission('MODULE_SCREEN_SETUP', 'delete');
  }

  get canExport(): boolean {
    return isSuperAdminRole(this.role) || this.rolePermissionService.hasPermission('MODULE_SCREEN_SETUP', 'export');
  }

  /** Search filters per column */
  searchModule = '';
  searchSubModule = '';
  searchScreen = '';

  /* ---------- data ---------- */

  get modules(): MasterEntry[] {
    return this.master.modules;
  }

  get subModules(): MasterEntry[] {
    return this.master.subModules(this.moduleId);
  }

  get screens(): MasterEntry[] {
    return this.master.screens(this.subModuleId);
  }

  get filteredModules(): MasterEntry[] {
    const term = this.searchModule.trim().toLowerCase();
    if (!term) return this.modules;
    return this.modules.filter((m) => m.name.toLowerCase().includes(term));
  }

  get filteredSubModules(): MasterEntry[] {
    const term = this.searchSubModule.trim().toLowerCase();
    if (!term) return this.subModules;
    return this.subModules.filter((s) => s.name.toLowerCase().includes(term));
  }

  get filteredScreens(): MasterEntry[] {
    const term = this.searchScreen.trim().toLowerCase();
    if (!term) return this.screens;
    return this.screens.filter((s) => s.name.toLowerCase().includes(term));
  }

  /** The rows each column renders for its current page. */
  get pagedModules(): MasterEntry[] {
    return pageSlice(this.filteredModules, this.modulePage, this.pageSize);
  }

  get pagedSubModules(): MasterEntry[] {
    return pageSlice(this.filteredSubModules, this.subModulePage, this.pageSize);
  }

  get pagedScreens(): MasterEntry[] {
    return pageSlice(this.filteredScreens, this.screenPage, this.pageSize);
  }

  clearSearch(type: 'module' | 'subModule' | 'screen'): void {
    if (type === 'module') {
      this.searchModule = '';
      this.modulePage = 0;
    } else if (type === 'subModule') {
      this.searchSubModule = '';
      this.subModulePage = 0;
    } else {
      this.searchScreen = '';
      this.screenPage = 0;
    }
  }

  resetHierarchy(): void {
    this.moduleId = null;
    this.subModuleId = null;
    this.subModulePage = 0;
    this.screenPage = 0;
  }

  clearSubModuleSelection(): void {
    this.subModuleId = null;
    this.screenPage = 0;
  }

  get selectedModuleName(): string {
    return this.modules.find((entry) => entry.id === this.moduleId)?.name || '';
  }

  get selectedSubModuleName(): string {
    return this.subModules.find((entry) => entry.id === this.subModuleId)?.name || '';
  }

  get totalSubModulesCount(): number {
    let count = 0;
    for (const m of this.modules) {
      count += this.subModuleCount(m);
    }
    return count;
  }

  get totalScreensCount(): number {
    let count = 0;
    for (const m of this.modules) {
      for (const sm of this.master.subModules(m.id)) {
        count += this.screenCount(sm);
      }
    }
    return count;
  }

  subModuleCount(module: MasterEntry): number {
    return this.master.subModules(module.id).length;
  }

  screenCount(subModule: MasterEntry): number {
    return this.master.screens(subModule.id).length;
  }

  /**
   * `quiet` keeps the columns on screen while they refresh, so saving one value
   * does not blank the three lists the user is working in.
   */
  reload(quiet = false): void {
    if (!quiet) {
      this.loading = true;
    }
    this.errorMessage = '';

    this.master.reload().subscribe({
      next: () => {
        // Retiring a value takes its children with it, so a selection can point
        // at something that no longer exists; drop it instead of filtering by it.
        if (!this.modules.some((entry) => entry.id === this.moduleId)) {
          this.moduleId = null;
        }
        if (!this.subModules.some((entry) => entry.id === this.subModuleId)) {
          this.subModuleId = null;
        }
        // Retiring a row can shorten a column past the page that is open.
        this.modulePage = Math.min(this.modulePage, lastPageOf(this.modules.length, this.pageSize));
        this.subModulePage = Math.min(this.subModulePage, lastPageOf(this.subModules.length, this.pageSize));
        this.screenPage = Math.min(this.screenPage, lastPageOf(this.screens.length, this.pageSize));
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Could not load the master data right now.';
        this.loading = false;
      }
    });
  }

  /* ---------- selection ---------- */

  /**
   * The size is shared by the three columns, so choosing a bigger page here can
   * strand the two columns that were not touched past their last page. Clamp
   * them right away instead of leaving an empty column on screen.
   */
  setPageSize(size: number): void {
    this.pageSize = size;
    this.modulePage = Math.min(this.modulePage, lastPageOf(this.modules.length, size));
    this.subModulePage = Math.min(this.subModulePage, lastPageOf(this.subModules.length, size));
    this.screenPage = Math.min(this.screenPage, lastPageOf(this.screens.length, size));
  }

  selectModule(module: MasterEntry): void {
    this.moduleId = module.id;
    // The chosen sub module belongs to the previous module, so it cannot stay.
    this.subModuleId = null;
    // Both columns to the right now show a different tree: start them at page one.
    this.subModulePage = 0;
    this.screenPage = 0;
  }

  selectSubModule(subModule: MasterEntry): void {
    this.subModuleId = subModule.id;
    this.screenPage = 0;
  }

  /* ---------- writing ---------- */

  addModule(): void {
    this.add('MODULE', this.newModule, null, (entry) => {
      this.moduleId = entry.id;
      this.newModule = '';
    });
  }

  addSubModule(): void {
    this.add('SUB_MODULE', this.newSubModule, this.moduleId, (entry) => {
      this.subModuleId = entry.id;
      this.newSubModule = '';
    });
  }

  addScreen(): void {
    this.add('SCREEN', this.newScreen, this.subModuleId, (entry) => {
      this.newScreen = '';
    });
  }

  /** Saving a name that already exists under the same parent is a no-op. */
  private add(
    type: MasterType,
    draft: string,
    parentId: number | null,
    done: (entry: MasterEntry) => void
  ): void {
    if (!this.canEdit || this.saving) {
      return;
    }

    const name = (draft || '').trim();
    if (!name) {
      return;
    }
    if (parentId == null && type !== 'MODULE') {
      this.snackBar.open(
        type === 'SUB_MODULE'
          ? 'Choose a module first: a sub module belongs to one.'
          : 'Choose a sub module first: a screen belongs to one.',
        'Dismiss',
        { duration: 4000 }
      );
      return;
    }

    this.saving = true;
    this.master.create(type, name, parentId).subscribe({
      next: (entry) => {
        this.saving = false;
        done(entry);
        this.reload(true);
        this.snackBar.open(`"${entry.name}" is saved.`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(
          this.messageOf(err, 'Could not save that value.'),
          'Dismiss',
          { duration: 4000 }
        );
      }
    });
  }

  /** Retiring is how a value leaves the pickers; work that already uses it keeps the name. */
  retire(entry: MasterEntry): void {
    if (!this.canEdit || this.saving) {
      return;
    }

    this.saving = true;
    this.master.retire(entry).subscribe({
      next: () => {
        this.saving = false;
        this.reload(true);
        this.snackBar.open(
          `"${entry.name}" retired. Tasks that already use it keep their name.`,
          'Close',
          { duration: 4000 }
        );
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(
          this.messageOf(err, 'Could not retire that value.'),
          'Dismiss',
          { duration: 4000 }
        );
      }
    });
  }

  private messageOf(err: any, fallback: string): string {
    return typeof err?.error === 'string' && err.error.trim() ? err.error : fallback;
  }

  /* ---------- presentation ---------- */

  /** Says what else goes, because retiring a parent retires everything under it. */
  retireHint(entry: MasterEntry): string {
    if (entry.type === 'MODULE') {
      return `Retire "${entry.name}" and everything under it`;
    }
    if (entry.type === 'SUB_MODULE') {
      return `Retire "${entry.name}" and its screens`;
    }
    return `Retire "${entry.name}"`;
  }

  /* ---------- Excel Upload & Template Processing ---------- */

  get previewSlice(): PreviewRow[] {
    return this.parsedPreviewRows.slice(0, 10);
  }

  get previewModuleCount(): number {
    return new Set(this.parsedPreviewRows.map((r) => r.module).filter(Boolean)).size;
  }

  get previewSubModuleCount(): number {
    return new Set(
      this.parsedPreviewRows.map((r) => `${r.module} > ${r.subModule}`).filter((r) => !r.endsWith(' > '))
    ).size;
  }

  get previewScreenCount(): number {
    return this.parsedPreviewRows.filter((r) => !!r.screen).length;
  }

  openUploadModal(): void {
    this.showUploadModal = true;
    this.selectedFile = null;
    this.parsedPreviewRows = [];
    this.importWarnings = [];
    this.uploading = false;
  }

  closeUploadModal(): void {
    if (this.uploading) return;
    this.showUploadModal = false;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.parsedPreviewRows = [];
    this.importWarnings = [];
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  handleFile(file: File): void {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.snackBar.open('Please select an Excel (.xlsx or .xls) file.', 'Close', { duration: 4000 });
      return;
    }
    this.selectedFile = file;
    this.parsedPreviewRows = [];
    this.importWarnings = [];

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const raw: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        this.processExcelRows(raw);
      } catch (err: any) {
        this.snackBar.open('Failed to parse Excel file: ' + (err?.message || err), 'Close', { duration: 4000 });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private processExcelRows(raw: any[][]): void {
    if (!raw || raw.length === 0) {
      this.importWarnings.push('The selected Excel sheet has no data.');
      return;
    }

    let colModule = -1;
    let colSub = -1;
    let colScreen = -1;
    let headerRowIdx = -1;

    for (let r = 0; r < Math.min(raw.length, 10); r++) {
      const row = raw[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').trim().toLowerCase();
        if (cell.includes('sub') && (cell.includes('mod') || cell.includes('module'))) {
          colSub = c;
        } else if (cell.includes('module') || cell === 'mod') {
          if (colModule === -1) colModule = c;
        } else if (cell.includes('screen') || cell.includes('page')) {
          colScreen = c;
        }
      }
      if (colModule !== -1) {
        headerRowIdx = r;
        break;
      }
    }

    if (colModule === -1) {
      colModule = 0;
      colSub = 1;
      colScreen = 2;
      headerRowIdx = -1;
    }

    const start = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    const rows: PreviewRow[] = [];

    for (let r = start; r < raw.length; r++) {
      const row = raw[r];
      if (!Array.isArray(row)) continue;

      const module = colModule >= 0 ? String(row[colModule] || '').trim() : '';
      const subModule = colSub >= 0 ? String(row[colSub] || '').trim() : '';
      const screen = colScreen >= 0 ? String(row[colScreen] || '').trim() : '';

      if (!module && !subModule && !screen) continue;

      const isValid = !!module && (!screen || !!subModule);
      rows.push({ module, subModule, screen, isValid });
    }

    this.parsedPreviewRows = rows;
    if (rows.length === 0) {
      this.importWarnings.push('No valid rows found to import.');
    }
  }

  confirmImport(): void {
    if (!this.selectedFile || this.parsedPreviewRows.length === 0 || this.uploading) return;

    this.uploading = true;
    this.master.uploadExcel(this.selectedFile).subscribe({
      next: (res) => {
        this.uploading = false;
        this.showUploadModal = false;
        this.snackBar.open(
          `Successfully saved ${res.totalRows} rows: ${res.modulesProcessed} modules, ${res.subModulesProcessed} sub-modules, and ${res.screensProcessed} screens.`,
          'Close',
          { duration: 5000 }
        );
        this.reload(true);
        this.resetHierarchy();
      },
      error: (err) => {
        const payload = this.parsedPreviewRows
          .filter((r) => r.isValid)
          .map((r) => ({ module: r.module, subModule: r.subModule, screen: r.screen }));
        if (payload.length > 0) {
          this.master.importBulk(payload).subscribe({
            next: (res) => {
              this.uploading = false;
              this.showUploadModal = false;
              this.snackBar.open(
                `Successfully saved ${res.totalRows} rows: ${res.modulesProcessed} modules, ${res.subModulesProcessed} sub-modules, and ${res.screensProcessed} screens.`,
                'Close',
                { duration: 5000 }
              );
              this.reload(true);
              this.resetHierarchy();
            },
            error: (fallbackErr) => {
              this.uploading = false;
              this.snackBar.open(this.messageOf(fallbackErr, 'Failed to import Excel data.'), 'Dismiss', {
                duration: 5000
              });
            }
          });
        } else {
          this.uploading = false;
          this.snackBar.open(this.messageOf(err, 'Failed to upload Excel file.'), 'Dismiss', { duration: 5000 });
        }
      }
    });
  }

  downloadSampleTemplate(): void {
    this.master.downloadTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Module_Screen_Setup_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        this.snackBar.open('Template downloaded successfully.', 'Close', { duration: 3000 });
      },
      error: () => {
        try {
          const sample = [
            ['Module', 'Sub Module', 'Screen'],
            ['Employee Management', 'Authentication', 'Login Screen'],
            ['Employee Management', 'Authentication', 'Registration Screen'],
            ['Employee Management', 'Authentication', 'Forgot Password'],
            ['Employee Management', 'Profile', 'View Profile'],
            ['Employee Management', 'Profile', 'Edit Profile'],
            ['Delivery Management', 'Ticket Board', 'Task Board'],
            ['Delivery Management', 'Ticket Board', 'Swimlanes View'],
            ['Delivery Management', 'Review Pipeline', 'Approval Queue'],
            ['Timesheets', 'Daily Entry', 'Submit Timesheet'],
            ['Timesheets', 'Approvals', 'Timesheet Approvals']
          ];
          const ws = XLSX.utils.aoa_to_sheet(sample);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Module_Screen_Setup');
          XLSX.writeFile(wb, 'Module_Screen_Setup_Template.xlsx');
          this.snackBar.open('Sample template created and downloaded.', 'Close', { duration: 3000 });
        } catch (e: any) {
          this.snackBar.open('Could not download template: ' + (e?.message || e), 'Dismiss', { duration: 4000 });
        }
      }
    });
  }
}
