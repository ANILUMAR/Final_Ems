import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { assignableRoles, roleBadgeClass, roleLabel } from '../models/role';
import { AuthService } from '../services/auth-service';
import { ReferenceService } from '../services/reference.service';

@Component({
  selector: 'app-edit-employee',
  standalone: true,   // ✅ mark as standalone
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogContent,
    MatDialogActions
],
  template: `
    <div class="ee-head">
      <span class="ee-avatar">
        <img *ngIf="hasPhoto(); else initialsTpl" [src]="photoUrl()" [alt]="data.name" (error)="photoFailed = true" />
        <ng-template #initialsTpl>{{ initials }}</ng-template>
      </span>

      <div class="ee-who">
        <h2 mat-dialog-title class="ee-title">Edit employee</h2>
        <span class="ee-mail">{{ data.email }}</span>
      </div>

      <span class="ems-badge" [ngClass]="headerBadge">
        {{ roleLabel(data.role) }}
      </span>
    </div>

    <mat-dialog-content class="ee-body">
      <div class="ee-grid">
        <mat-form-field appearance="outline">
          <mat-label>Full name</mat-label>
          <input matInput [(ngModel)]="data.name" placeholder="e.g. Raju Kumar" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <!-- Filled from GET /api/auth/roles, so a role added on the backend
               shows up here without touching this template. -->
          <mat-select [(ngModel)]="data.role">
            <!-- The stored value stays EMPLOYEE; only the label reads "Developer". -->
            <mat-option *ngFor="let role of roles" [value]="role">{{ roleLabel(role) }}</mat-option>
          </mat-select>
          <mat-hint>Decides which screens this person can open.</mat-hint>
        </mat-form-field>

        <!-- The address is both the contact and the sign-in name, so it is
             edited here rather than being read-only in the header. -->
        <mat-form-field appearance="outline" class="ee-span-2">
          <mat-label>Email</mat-label>
          <input matInput [(ngModel)]="data.email" placeholder="name@ems.com"
                 autocomplete="off" spellcheck="false" />
          <mat-hint>This is also the address this person signs in with.</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput [(ngModel)]="data.phoneNumber" placeholder="Optional" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Address</mat-label>
          <input matInput [(ngModel)]="data.address" placeholder="Optional" />
        </mat-form-field>
      </div>

      <!-- Sign-in credentials are a separate decision from the details above,
           so they get their own heading instead of trailing the same grid. -->
      <h3 class="ee-section">Password</h3>

      <div class="ee-grid">

        <mat-form-field appearance="outline">
          <mat-label>New password</mat-label>
          <!-- Always starts empty. The saved password is shown in the block below
               and is never edited in place, so simply opening this dialog - or a
               browser autofilling the form - cannot reset somebody's login. -->
          <input matInput [(ngModel)]="newPassword" type="password"
                 autocomplete="new-password" placeholder="Leave blank to keep the saved password" />
          <mat-hint>At least 6 characters.</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Confirm password</mat-label>
          <input matInput [(ngModel)]="confirmPassword" type="password"
                 autocomplete="new-password" placeholder="Repeat the new password" />
        </mat-form-field>
      </div>

      <div class="ee-secret">
        <div class="ee-secret__text">
          <span class="ee-secret__title">Saved password</span>
          <span class="ee-secret__value" [class.ee-secret__value--muted]="!hasSavedPassword">
            {{ savedPasswordText }}
          </span>
        </div>
        <button mat-icon-button type="button" (click)="showPassword = !showPassword"
                [disabled]="!hasSavedPassword"
                [attr.aria-label]="showPassword ? 'Hide saved password' : 'Show saved password'">
          <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      </div>

      <div class="ee-photo">
        <div class="ee-photo__text">
          <span class="ee-photo__title">Profile photo</span>
          <span class="ee-photo__hint">
            {{ selectedFile ? selectedFile.name : 'PNG or JPG — replaces the current picture' }}
          </span>
        </div>
        <label class="ee-photo__btn">
          <mat-icon>upload</mat-icon>
          <span>{{ selectedFile ? 'Change' : 'Choose file' }}</span>
          <input type="file" accept="image/*" (change)="onFileSelected($event)" hidden />
        </label>
      </div>

      <p class="ee-error" *ngIf="errorMessage">
        <mat-icon>error_outline</mat-icon>
        <span>{{ errorMessage }}</span>
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" (click)="onClose()" [disabled]="saving">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="update()" [disabled]="saving">
        <mat-icon>{{ saving ? 'hourglass_top' : 'save' }}</mat-icon>
        {{ saving ? 'Saving…' : 'Save changes' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ee-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 22px 24px 14px;
      border-bottom: 1px solid var(--ems-border-soft);
    }

    .ee-avatar {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid rgba(123, 156, 255, 0.28);
      background: var(--ems-primary-soft);
      color: var(--ems-primary);
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.4px;
    }

    .ee-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .ee-who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .ee-title {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 17px;
      font-weight: 650;
      line-height: 1.3;
      color: var(--ems-text);
    }

    .ee-mail {
      font-size: 12.5px;
      color: var(--ems-text-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ee-body { display: block; padding-top: 16px; }

    .ee-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      /* The row gap clears the hint/error line of one field from the label of
         the field below it; 2px left the two touching. */
      gap: 8px 14px;
    }

    .ee-grid mat-form-field { width: 100%; }

    .ee-span-2 { grid-column: 1 / -1; }

    /* Same small uppercase heading the Edit task dialog uses, so the two
       dialogs read alike. */
    .ee-section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 18px 0 10px;
      font-size: 11.5px;
      font-weight: 650;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--ems-text-3);
    }

    .ee-secret {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 2px 0 12px;
      padding: 8px 8px 8px 14px;
      border: 1px solid var(--ems-border);
      border-radius: var(--ems-radius-sm);
      background: var(--ems-surface-3);
    }

    .ee-secret__text {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .ee-secret__title {
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--ems-text-3);
    }

    .ee-secret__value {
      font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      font-size: 13.5px;
      color: var(--ems-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ee-secret__value--muted {
      font-family: inherit;
      font-style: italic;
      color: var(--ems-text-3);
    }

    .ee-photo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 4px 0 2px;
      padding: 12px 14px;
      border: 1px dashed var(--ems-border);
      border-radius: var(--ems-radius-sm);
      background: rgba(255, 255, 255, 0.02);
    }

    .ee-photo__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .ee-photo__title { font-size: 13px; font-weight: 600; color: var(--ems-text); }

    .ee-photo__hint {
      font-size: 11.5px;
      color: var(--ems-text-3);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ee-photo__btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border-radius: var(--ems-radius-pill);
      border: 1px solid var(--ems-border);
      background: var(--ems-surface-3);
      color: var(--ems-text);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: border-color 120ms ease, color 120ms ease;
    }

    .ee-photo__btn:hover { border-color: var(--ems-primary); color: var(--ems-primary); }

    .ee-photo__btn mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .ee-error {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 14px 0 0;
      padding: 10px 12px;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--ems-danger);
      background: var(--ems-danger-soft);
      border: 1px solid rgba(248, 113, 113, 0.3);
      border-radius: var(--ems-radius-sm);
    }

    .ee-error mat-icon { font-size: 16px; width: 16px; height: 16px; margin-top: 1px; }

    /* A single column once the dialog is too narrow for two fields side by side. */
    @media (max-width: 620px) {
      .ee-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class EditEmployeeComponent {
  selectedFile?: File;
  roles: string[] = [];
  saving = false;
  errorMessage = '';
  photoFailed = false;

  /** New login password - empty keeps whatever the account already has. */
  newPassword = '';
  confirmPassword = '';
  showPassword = false;

  /** Decrypted copy of the password saved for this account, if one exists. */
  private savedPassword = '';
  passwordLoaded = false;

  /** Exposed to the template: EMPLOYEE renders as "Developer". */
  readonly roleLabel = roleLabel;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<EditEmployeeComponent>,
    private authservice:AuthService,
    private reference: ReferenceService
  ) {
    // Status is not edited here any more - the switch in the accounts table owns
    // it, so this dialog never sends `active` and cannot contradict the row.
    this.loadRoles();
    this.loadPassword();
  }

  get initials(): string {
    const parts = String(this.data.name || '?').trim().split(/\s+/).filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?';
  }

  /** Admins read as blue - the tone comes from the role's own row. */
  get headerBadge(): string {
    return roleBadgeClass(this.data.role);
  }

  hasPhoto(): boolean {
    return !!this.data.registerImage && !this.photoFailed;
  }

  photoUrl(): string {
    return 'http://localhost:9001/attachments/' + this.data.registerImage;
  }

  loadRoles() {
    this.authservice.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles && roles.length ? [...roles] : this.fallbackRoles();
        if (this.data.role && !this.roles.includes(this.data.role)) {
          this.roles.push(this.data.role);
        }
      },
      error: () => {
        // Same list, taken from the copy the app already loaded.
        this.roles = this.fallbackRoles();
      }
    });
  }

  /** The five identities from the loaded lookup, minus the legacy ADMIN code. */
  private fallbackRoles(): string[] {
    const roles = assignableRoles(this.reference.codes('ROLE'));
    this.data.role = assignableRoles([this.data.role])[0] || this.data.role;
    return roles;
  }

  /** Reads the saved password so the admin can see the value behind the mask. */
  loadPassword() {
    this.authservice.getUserPassword(this.data.id).subscribe({
      next: (response) => {
        this.savedPassword = String(response?.password || '').trim();
        this.passwordLoaded = true;
      },
      error: () => {
        // A failed read must not block the dialog - the account simply shows as
        // having no readable copy, and a blank change box keeps the current one.
        this.savedPassword = '';
        this.passwordLoaded = true;
      }
    });
  }

  get hasSavedPassword(): boolean {
    return !!this.savedPassword;
  }

  /** The saved password, masked until the eye is pressed. */
  get savedPasswordText(): string {
    if (!this.passwordLoaded) {
      return 'Loading…';
    }
    if (!this.savedPassword) {
      return 'No readable copy stored for this account';
    }
    if (this.showPassword) {
      return this.savedPassword;
    }
    return '•'.repeat(Math.max(8, this.savedPassword.length));
  }

  onClose() {
    this.dialogRef.close();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  update() {
    if (this.saving) {
      return;
    }
    this.errorMessage = '';

    // Validate locally first so a typo cannot half-save the row: the backend
    // rejects the whole request when the password is too short, but the admin
    // should not have to round-trip to learn that.

    // The email is the sign-in name, so a blank or malformed value is refused
    // here instead of being sent and rejected by the server.
    const email = String(this.data.email || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.errorMessage = 'Enter a valid email address, e.g. name@ems.com.';
      return;
    }
    this.data.email = email;

    const password = (this.newPassword || '').trim();
    if (password && password.length < 6) {
      this.errorMessage = 'The new password needs at least 6 characters.';
      return;
    }
    if (password && password !== (this.confirmPassword || '').trim()) {
      this.errorMessage = 'The two passwords do not match.';
      return;
    }

    this.saving = true;

    this.authservice.updateUser(this.data.id, this.data, this.selectedFile, password).subscribe({
      next: (response) => {
        this.saving = false;
        this.dialogRef.close(response); // return updated user or success message
      },
      error: (err) => {
        console.error('Update failed', err);
        this.saving = false;
        // The backend refuses unknown roles, self-demotion and losing the last
        // administrator; show its reason instead of a silent failure.
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : err?.error?.error || 'Update failed. Please try again.';
      }
    });
  }
}
