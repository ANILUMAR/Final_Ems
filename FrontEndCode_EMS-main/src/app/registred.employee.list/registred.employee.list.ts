import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { BulkOnboardDialog } from '../bulk-onboard/bulk-onboard';
import { EditEmployeeComponent } from '../edit-employee.ts/edit-employee.ts';
import { isManagerRole, isPlainTesterRole, isSuperAdminRole, roleBadgeClass, roleFamily, roleLabel as formatRole } from '../models/role';
import { RolePermissionService } from '../services/role-permission.service';
import { AuthService } from '../services/auth-service';
import { WorkspaceService } from '../services/workspace.service';
import { LocalAvatarService } from '../services/local-avatar.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

interface RegisteredEmployee {
  id: number;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  registerImage?: string;
  generatedDate?: string;
  /** null on records created before the flag existed - those are active. */
  active?: boolean | null;
  /**
   * Task-management provision, testers only. When true the tester may create,
   * edit and delete tasks; admins hold the same right without the flag.
   */
  taskManager?: boolean | null;
}

@Component({
  selector: 'app-registred.employee.list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RouterModule,
    Pager
  ],
  templateUrl: './registred.employee.list.html',
  styleUrl: './registred.employee.list.css'
})
export class RegistredEmployeeList implements OnInit {
  employees: RegisteredEmployee[] = [];
  loading = true;
  errorMessage = '';

  search = '';
  role = 'ALL';
  status: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  busyId: number | null = null;

  /* The whole list arrives in one call, so paging happens in the browser and
     search/filters still span every account, not just the visible page. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  private failedImages = new Set<string>();

  constructor(
    private workspace: WorkspaceService,
    private auth: AuthService,
    private dialog: MatDialog,
    private rolePermissionService: RolePermissionService,
    private avatarService: LocalAvatarService
  ) {}

  get canAddEmployee(): boolean {
    return isSuperAdminRole(localStorage.getItem('role')) ||
           this.rolePermissionService.canAdd('REGISTERED_EMPLOYEES');
  }

  get canEditEmployee(): boolean {
    return isSuperAdminRole(localStorage.getItem('role')) ||
           this.rolePermissionService.canEdit('REGISTERED_EMPLOYEES');
  }

  get canDeleteEmployee(): boolean {
    return isSuperAdminRole(localStorage.getItem('role')) ||
           this.rolePermissionService.canDelete('REGISTERED_EMPLOYEES');
  }

  ngOnInit(): void {
    this.reload();
  }

  /* ---------- derived data ---------- */

  get filteredEmployees(): RegisteredEmployee[] {
    const term = this.search.trim().toLowerCase();
    return this.employees.filter((employee) => {
      // The chips pick a family, so "Tester" also shows the tester team leader
      // and "Admin" shows the CEO - the role badge still spells out which one.
      const matchesRole = this.role === 'ALL' || roleFamily(employee.role) === this.role;
      const active = this.isActive(employee);
      const matchesStatus =
        this.status === 'ALL' || (this.status === 'ACTIVE' ? active : !active);
      const matchesSearch =
        !term ||
        [employee.name, employee.email, employee.role, employee.phoneNumber]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesRole && matchesStatus && matchesSearch;
    });
  }

  get adminCount(): number {
    return this.employees.filter((employee) => roleFamily(employee.role) === 'ADMIN').length;
  }

  /** The EMPLOYEE family now reads "Developer" on screen, so count that family. */
  get developerCount(): number {
    return this.employees.filter((employee) => roleFamily(employee.role) === 'EMPLOYEE').length;
  }

  get activeCount(): number {
    return this.employees.filter((employee) => this.isActive(employee)).length;
  }

  get inactiveCount(): number {
    return this.employees.length - this.activeCount;
  }

  /** The slice actually rendered for the current page. */
  get pagedEmployees(): RegisteredEmployee[] {
    return pageSlice(this.filteredEmployees, this.pageIndex, this.pageSize);
  }

  /** Any filter change starts again at the first page. */
  onSearchChange(): void {
    this.pageIndex = 0;
  }

  setRole(role: string): void {
    this.role = role;
    this.pageIndex = 0;
  }

  setStatus(status: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
    this.status = status;
    this.pageIndex = 0;
  }

  get newThisMonth(): number {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return this.employees.filter((employee) => {
      const joined = this.toDate(employee.generatedDate);
      return !!joined && joined.getTime() >= start.getTime();
    }).length;
  }

  /* ---------- data ---------- */

  /** `notice` survives the reload, so a refused toggle keeps its reason on screen. */
  reload(notice = ''): void {
    this.loading = true;
    this.errorMessage = notice;

    this.workspace.getEmployees().subscribe({
      next: (data: RegisteredEmployee[]) => {
        this.employees = data || [];
        // A reload can shrink the list (or the active page may no longer exist
        // after a filter), so never leave the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredEmployees.length, this.pageSize));
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to load registered employees', err);
        this.errorMessage = 'Could not load registered employees right now.';
        this.loading = false;
      }
    });
  }

  /** Opens the paste-a-list onboarding dialog; the directory refreshes on success. */
  openBulkOnboard(): void {
    this.dialog
      .open(BulkOnboardDialog, { width: '600px', maxWidth: '94vw' })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.reload();
        }
      });
  }

  editEmployee(employee: RegisteredEmployee): void {
    this.dialog
      // Two columns of fields need the room; at 560px the password pair and the
      // email field both wrapped their hints onto a second line.
      .open(EditEmployeeComponent, { width: '680px', maxWidth: '94vw', data: { ...employee } })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.reload();
        }
      });
  }

  /** Flips one account between active and inactive without opening the dialog. */
  toggleStatus(employee: RegisteredEmployee): void {
    if (this.busyId !== null) {
      return;
    }
    this.busyId = employee.id;
    this.errorMessage = '';

    this.auth.setUserStatus(employee.id, !this.isActive(employee)).subscribe({
      next: () => {
        this.busyId = null;
        this.reload();
      },
      error: (err: any) => {
        this.busyId = null;
        // The backend refuses self-deactivation and losing the last admin. Reload
        // anyway, so the switch snaps back to the state the server actually kept
        // instead of sitting in a position the account is not in.
        this.reload(
          typeof err?.error === 'string' ? err.error : 'Could not change this account right now.'
        );
      }
    });
  }

  /**
   * Grants or revokes a tester's task-management provision. This is the only
   * place the right is handed out: developers are never eligible, and admins do
   * not need it.
   */
  toggleTaskAccess(employee: RegisteredEmployee): void {
    if (this.busyId !== null || !this.canToggleTask(employee)) {
      return;
    }
    this.busyId = employee.id;
    this.errorMessage = '';

    this.auth.setTaskAccess(employee.id, employee.taskManager !== true).subscribe({
      next: () => {
        this.busyId = null;
        this.reload();
      },
      error: (err: any) => {
        this.busyId = null;
        this.reload(
          typeof err?.error === 'string' ? err.error : 'Could not change task access right now.'
        );
      }
    });
  }

  /* ---------- presentation helpers ---------- */

  isActive(employee: RegisteredEmployee): boolean {
    return employee.active !== false;
  }

  isAdmin(employee: RegisteredEmployee): boolean {
    return isSuperAdminRole(employee.role);
  }

  /**
   * The switch belongs to a plain tester. The CEO and the team leaders hold the
   * right by their role, and a developer can never be given it, so those rows
   * read "Full access" or a dash instead of offering a toggle.
   */
  canToggleTask(employee: RegisteredEmployee): boolean {
    return isPlainTesterRole(employee.role);
  }

  /** Whether this account may create, edit and delete tasks right now. */
  hasTaskAccess(employee: RegisteredEmployee): boolean {
    return isManagerRole(employee.role)
      || (isPlainTesterRole(employee.role) && employee.taskManager === true);
  }

  private toDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  registeredOn(employee: RegisteredEmployee): string {
    const date = this.toDate(employee.generatedDate);
    return date ? date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }

  roleLabel(role: string): string {
    return formatRole(role);
  }

  roleBadge(role: string): string {
    return roleBadgeClass(role);
  }

  initials(name: string): string {
    const parts = (name || '?').split(' ').filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  hasPhoto(employee: RegisteredEmployee): boolean {
    return true;
  }

  photoUrl(employee: RegisteredEmployee): string {
    if (this.failedImages.has(employee.email)) {
      return this.avatarService.getDefaultAvatarForRole(employee.role);
    }
    return this.avatarService.getAvatarUrl(
      employee.registerImage,
      employee.role,
      employee.name
    );
  }

  onImageError(event: Event, employee: RegisteredEmployee): void {
    this.failedImages.add(employee.email);
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = this.avatarService.getDefaultAvatarForRole(employee.role);
    }
  }
}
