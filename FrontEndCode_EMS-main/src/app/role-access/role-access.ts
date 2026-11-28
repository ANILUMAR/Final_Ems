import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RoleOption, ScreenPermissionItem } from '../models/role-permission';
import { RolePermissionService } from '../services/role-permission.service';
import { WorkspaceService } from '../services/workspace.service';
import { LocalAvatarService } from '../services/local-avatar.service';

export interface AssignedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  registerImage?: string;
  active?: boolean | null;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [], // All screens allowed
  PROJECT_MANAGER: [
    'DASHBOARD', 'PROJECT_OVERVIEW', 'TEAM_HIERARCHY', 'MY_PROJECTS',
    'SUBMIT_TIMESHEET', 'MY_TIMESHEETS', 'TIMESHEET_APPROVALS', 'TIMESHEET_REPORTS',
    'AUDIT_LOGS', 'USER_PROFILE', 'SETTINGS'
  ],
  TEAM_LEAD: [
    'DEVELOPER_BOARD', 'TESTER_BOARD', 'DEV_TEAM_ASSIGNMENT', 'TESTING_REVIEW',
    'DEV_COMPLETED_TICKETS', 'ON_HOLD_TICKETS', 'TESTED_COMPLETED_REVIEW', 'MY_TICKETS',
    'TICKET_BOARD', 'ALL_TICKETS', 'PROJECT_OVERVIEW', 'TEAM_HIERARCHY', 'MY_PROJECTS',
    'SUBMIT_TIMESHEET', 'MY_TIMESHEETS', 'TIMESHEET_APPROVALS', 'TIMESHEET_REPORTS',
    'USER_PROFILE', 'SETTINGS'
  ],
  DEVELOPER_LEAD: [
    'DEVELOPER_BOARD', 'DEV_TEAM_ASSIGNMENT', 'DEV_COMPLETED_TICKETS', 'ON_HOLD_TICKETS',
    'TESTED_COMPLETED_REVIEW', 'MY_TICKETS', 'TICKET_BOARD', 'TEAM_HIERARCHY', 'MY_PROJECTS',
    'SUBMIT_TIMESHEET', 'MY_TIMESHEETS', 'TIMESHEET_APPROVALS', 'TIMESHEET_REPORTS',
    'USER_PROFILE', 'SETTINGS'
  ],
  EMPLOYEE: [
    'DEVELOPER_BOARD', 'MY_TICKETS', 'MY_COMPLETED_TICKETS_DEV', 'ON_HOLD_TICKETS',
    'TICKET_BOARD', 'MY_PROJECTS', 'SUBMIT_TIMESHEET', 'MY_TIMESHEETS',
    'USER_PROFILE', 'SETTINGS'
  ],
  TESTER_LEAD: [
    'TESTER_BOARD', 'TESTING_LEAD_DASHBOARD', 'RAISE_TICKET', 'MY_SUBMISSIONS',
    'TESTING_REVIEW', 'TESTED_COMPLETED_REVIEW', 'MY_TICKETS', 'MY_COMPLETED_TICKETS_QA',
    'TICKET_BOARD', 'TEAM_HIERARCHY', 'MY_PROJECTS', 'SUBMIT_TIMESHEET', 'MY_TIMESHEETS',
    'TIMESHEET_APPROVALS', 'TIMESHEET_REPORTS', 'USER_PROFILE', 'SETTINGS'
  ],
  TESTER: [
    'TESTER_BOARD', 'RAISE_TICKET', 'MY_SUBMISSIONS', 'MY_TICKETS', 'MY_COMPLETED_TICKETS_QA',
    'TICKET_BOARD', 'MY_PROJECTS', 'SUBMIT_TIMESHEET', 'MY_TIMESHEETS',
    'USER_PROFILE', 'SETTINGS'
  ]
};

@Component({
  selector: 'app-role-access',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './role-access.html',
  styleUrls: ['./role-access.css']
})
export class RoleAccessComponent implements OnInit {
  private roleService = inject(RolePermissionService);
  private workspaceService = inject(WorkspaceService);
  private snackBar = inject(MatSnackBar);
  private avatarService = inject(LocalAvatarService);

  readonly roles: RoleOption[] = this.roleService.availableRoles;
  selectedRole: string = 'SUPER_ADMIN';

  users: AssignedUser[] = [];
  selectedUser: AssignedUser | null = null;
  selectedUserId: string = '';
  isLoadingUsers: boolean = false;
  userFilterText: string = '';

  screenPermissions: ScreenPermissionItem[] = [];
  private originalJson: string = '';

  searchQuery: string = '';
  selectedCategory: string = 'ALL';
  readonly categories: string[] = ['ALL', 'Overview', 'Work', 'Delivery', 'Time', 'Administration', 'Account'];

  isLoading: boolean = false;
  isSaving: boolean = false;
  hasUnsavedChanges: boolean = false;

  ngOnInit(): void {
    // Dynamically determine initial role from logged-in session or fall back to SUPER_ADMIN / first role
    const currentRole = this.roleService.normalizeRole(localStorage.getItem('role'));
    if (currentRole && this.roles.some((r) => r.code === currentRole)) {
      this.selectedRole = currentRole;
    } else {
      this.selectedRole = this.roles[0]?.code || 'SUPER_ADMIN';
    }

    this.loadUsers();
    this.loadRoleConfig(this.selectedRole);
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.workspaceService.getEmployees().subscribe({
      next: (data: any[]) => {
        this.users = (data || []).map((u) => ({
          id: u.id,
          name: u.name || 'User',
          email: u.email || '',
          role: this.roleService.normalizeRole(u.role),
          phoneNumber: u.phoneNumber,
          address: u.address,
          registerImage: u.registerImage,
          active: u.active
        }));
        this.isLoadingUsers = false;

        // Optionally match current logged in user if active on this role
        const myEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
        if (myEmail) {
          const me = this.users.find(u => (u.email || '').trim().toLowerCase() === myEmail);
          if (me && me.role === this.selectedRole) {
            this.selectedUser = me;
            this.selectedUserId = String(me.id);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load registered users', err);
        this.isLoadingUsers = false;
      }
    });
  }

  getUsersForRole(roleCode: string): AssignedUser[] {
    const targetNorm = this.roleService.normalizeRole(roleCode);
    return this.users.filter((u) => this.roleService.normalizeRole(u.role) === targetNorm);
  }

  get usersForSelectedRole(): AssignedUser[] {
    let list = this.getUsersForRole(this.selectedRole);
    if (this.userFilterText.trim()) {
      const q = this.userFilterText.trim().toLowerCase();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phoneNumber && u.phoneNumber.toLowerCase().includes(q))
      );
    }
    return list;
  }

  selectRole(roleCode: string): void {
    if (this.selectedRole === roleCode) {
      return;
    }
    if (this.hasUnsavedChanges) {
      const confirmLeave = confirm(
        'You have unsaved permission changes for the current role. Discard and switch role?'
      );
      if (!confirmLeave) {
        return;
      }
    }
    this.selectedRole = roleCode;
    // If the currently selected user does not belong to the newly selected role, reset user selection
    if (this.selectedUser && this.selectedUser.role !== roleCode) {
      this.selectedUser = null;
      this.selectedUserId = '';
    }
    this.loadRoleConfig(roleCode);
  }

  selectUser(user: AssignedUser): void {
    if (this.selectedUser?.id === user.id) {
      // Toggle off user selection
      this.clearSelectedUser();
      return;
    }

    if (this.selectedRole !== user.role) {
      if (this.hasUnsavedChanges) {
        const confirmLeave = confirm(
          `You have unsaved permission changes for ${this.currentRole?.label || this.selectedRole}. Discard and switch to ${user.name}'s role (${user.role})?`
        );
        if (!confirmLeave) {
          this.selectedUserId = this.selectedUser ? String(this.selectedUser.id) : '';
          return;
        }
      }
      this.selectedRole = user.role;
      this.loadRoleConfig(user.role);
    }
    this.selectedUser = user;
    this.selectedUserId = String(user.id);
  }

  onUserDropdownChange(): void {
    if (!this.selectedUserId) {
      this.clearSelectedUser();
      return;
    }
    const targetUser = this.users.find((u) => String(u.id) === String(this.selectedUserId));
    if (targetUser) {
      this.selectUser(targetUser);
    }
  }

  clearSelectedUser(): void {
    this.selectedUser = null;
    this.selectedUserId = '';
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  loadRoleConfig(role: string): void {
    const normRole = this.roleService.normalizeRole(role);
    this.isLoading = true;
    this.hasUnsavedChanges = false;
    this.roleService.getConfigForRole(normRole).subscribe({
      next: (config) => {
        let permissions = (config.permissions || []).map((p) => {
          const resolvedName = p.screenName || p.name || this.fallbackScreenName(p.screenId);
          return {
            ...p,
            screenName: resolvedName,
            name: resolvedName
          };
        });

        // Auto-heal legacy 2-screen state for TEAM_LEAD if encountered
        if (normRole === 'TEAM_LEAD' && permissions.filter((p) => p.allowed).length <= 2) {
          const teamLeadDefaults = new Set(DEFAULT_ROLE_PERMISSIONS['TEAM_LEAD'] || []);
          permissions = permissions.map((p) => {
            const isAllowed = teamLeadDefaults.has(p.screenId);
            return {
              ...p,
              allowed: isAllowed,
              canView: isAllowed,
              canEdit: isAllowed,
              canExport: isAllowed,
              canDelete: false
            };
          });
          // Auto-persist directly to backend database so refresh retains full permissions
          this.roleService.saveConfigForRole('TEAM_LEAD', permissions).subscribe();
        }

        this.screenPermissions = permissions;
        this.originalJson = JSON.stringify(this.screenPermissions);
        this.isLoading = false;
        this.hasUnsavedChanges = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to load screen permissions for ' + role, 'Dismiss', {
          duration: 3500
        });
        this.isLoading = false;
      }
    });
  }

  get currentRole(): RoleOption | undefined {
    return this.roles.find((r) => r.code === this.selectedRole);
  }

  getScreenTitle(item: ScreenPermissionItem): string {
    return item.screenName || item.name || this.fallbackScreenName(item.screenId);
  }

  getModuleScreenLabel(item: ScreenPermissionItem): string {
    const title = this.getScreenTitle(item);
    return `${item.category || 'General'} › ${title}`;
  }

  private fallbackScreenName(screenId: string): string {
    if (!screenId) return 'Screen';
    return screenId
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  get filteredPermissions(): ScreenPermissionItem[] {
    let items = this.screenPermissions;
    if (this.selectedCategory !== 'ALL') {
      items = items.filter((item) => item.category === this.selectedCategory);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter((item) => {
        const title = this.getScreenTitle(item).toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const full = this.getModuleScreenLabel(item).toLowerCase();
        return title.includes(q) || cat.includes(q) || desc.includes(q) || full.includes(q);
      });
    }
    return items;
  }

  // --- Statistics ---
  get totalScreens(): number {
    return this.screenPermissions.length;
  }

  get assignedScreens(): number {
    return this.screenPermissions.filter((p) => p.allowed).length;
  }

  get restrictedScreens(): number {
    return this.screenPermissions.filter((p) => !p.allowed).length;
  }

  get viewCount(): number {
    return this.screenPermissions.filter((p) => p.allowed && p.canView).length;
  }

  get editCount(): number {
    return this.screenPermissions.filter((p) => p.allowed && p.canEdit).length;
  }

  get deleteCount(): number {
    return this.screenPermissions.filter((p) => p.allowed && p.canDelete).length;
  }

  get exportCount(): number {
    return this.screenPermissions.filter((p) => p.allowed && p.canExport).length;
  }

  // --- Actions ---
  toggleScreen(item: ScreenPermissionItem): void {
    item.allowed = !item.allowed;
    if (item.allowed) {
      // By default when enabling a screen, enable view permission
      item.canView = true;
    } else {
      // When revoking screen access, clear sub-permissions
      item.canView = false;
      item.canEdit = false;
      item.canDelete = false;
      item.canExport = false;
    }
    this.checkDirty();
  }

  toggleAll(allowed: boolean): void {
    this.filteredPermissions.forEach((item) => {
      item.allowed = allowed;
      if (allowed) {
        item.canView = true;
      } else {
        item.canView = false;
        item.canEdit = false;
        item.canDelete = false;
        item.canExport = false;
      }
    });
    this.checkDirty();
  }

  togglePermission(
    item: ScreenPermissionItem,
    field: 'canView' | 'canEdit' | 'canDelete' | 'canExport'
  ): void {
    if (!item.allowed) return;
    item[field] = !item[field];
    this.checkDirty();
  }

  savePermissions(): void {
    this.isSaving = true;
    this.roleService.saveConfigForRole(this.selectedRole, this.screenPermissions).subscribe({
      next: (saved) => {
        this.screenPermissions = (saved.permissions || []).map((p) => ({ ...p }));
        this.originalJson = JSON.stringify(this.screenPermissions);
        this.hasUnsavedChanges = false;
        this.isSaving = false;
        const userNotice = this.selectedUser ? ` (applies to ${this.selectedUser.name})` : '';
        this.snackBar.open(
          `Screen permissions for ${this.currentRole?.label || this.selectedRole}${userNotice} saved successfully!`,
          'Close',
          {
            duration: 3500,
            panelClass: ['ems-snack--success']
          }
        );
      },
      error: (err) => {
        this.snackBar.open('Error saving permissions: ' + (err.error?.message || err.message), 'Dismiss', {
          duration: 4000
        });
        this.isSaving = false;
      }
    });
  }

  resetToDefaults(): void {
    const userNotice = this.selectedUser ? ` (currently inspecting ${this.selectedUser.name})` : '';
    const confirmReset = confirm(
      `Are you sure you want to reset all screen permissions for ${
        this.currentRole?.label || this.selectedRole
      }${userNotice} to system defaults?`
    );
    if (!confirmReset) return;

    const normRole = this.roleService.normalizeRole(this.selectedRole);
    const defaults = DEFAULT_ROLE_PERMISSIONS[normRole];
    if (defaults) {
      const allowedSet = new Set(defaults);
      const isSuper = normRole === 'SUPER_ADMIN';
      this.screenPermissions = this.screenPermissions.map((p) => {
        const isAllowed = isSuper || allowedSet.has(p.screenId);
        return {
          ...p,
          allowed: isAllowed,
          canView: isAllowed,
          canEdit: isAllowed && !isSuper ? true : isSuper,
          canExport: isAllowed && !isSuper ? true : isSuper,
          canDelete: isSuper
        };
      });
      this.savePermissions();
      return;
    }

    this.isLoading = true;
    this.roleService.resetRoleToDefault(this.selectedRole).subscribe({
      next: (resetConfig) => {
        this.screenPermissions = (resetConfig.permissions || []).map((p) => ({ ...p }));
        this.originalJson = JSON.stringify(this.screenPermissions);
        this.hasUnsavedChanges = false;
        this.isLoading = false;
        this.snackBar.open(
          `Permissions for ${this.currentRole?.label || this.selectedRole} reset to defaults.`,
          'Close',
          { duration: 3500 }
        );
      },
      error: (err) => {
        this.snackBar.open('Failed to reset defaults: ' + err.message, 'Dismiss', {
          duration: 4000
        });
        this.isLoading = false;
      }
    });
  }

  private checkDirty(): void {
    this.hasUnsavedChanges = JSON.stringify(this.screenPermissions) !== this.originalJson;
  }

  getAvatar(user: AssignedUser | null): string {
    if (!user) return this.avatarService.getDefaultAvatarForRole(this.selectedRole);
    return this.avatarService.getAvatarUrl(user.registerImage, user.role, user.name);
  }

  onImgError(event: Event, user: AssignedUser | null): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.src = this.avatarService.getDefaultAvatarForRole(user?.role || this.selectedRole);
    }
  }
}
