import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { isSuperAdminRole } from '../models/role';
import { MasterDataService, MasterEntry, MasterType } from '../services/master-data.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, lastPageOf, pageSlice } from '../shared/pagination';

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

  role = (localStorage.getItem('role') || '').toUpperCase();

  loading = true;
  saving = false;
  errorMessage = '';

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

  /* ---------- rights ---------- */

  /** Curating the vocabulary is administrative work, so it is the CEO's alone. */
  get canEdit(): boolean {
    return isSuperAdminRole(this.role);
  }

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

  /** The rows each column renders for its current page. */
  get pagedModules(): MasterEntry[] {
    return pageSlice(this.modules, this.modulePage, this.pageSize);
  }

  get pagedSubModules(): MasterEntry[] {
    return pageSlice(this.subModules, this.subModulePage, this.pageSize);
  }

  get pagedScreens(): MasterEntry[] {
    return pageSlice(this.screens, this.screenPage, this.pageSize);
  }

  get selectedModuleName(): string {
    return this.modules.find((entry) => entry.id === this.moduleId)?.name || '';
  }

  get selectedSubModuleName(): string {
    return this.subModules.find((entry) => entry.id === this.subModuleId)?.name || '';
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
}
