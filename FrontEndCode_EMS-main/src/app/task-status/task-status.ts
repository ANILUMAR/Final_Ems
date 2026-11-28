import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkspaceService } from '../services/workspace.service';
import { DEFAULT_STATUS_LIST, STATUS_META, StatusHistoryDialog, statusMeta, StatusMeta } from './status-history-dialog';
import { StatusRemarkDialog } from './status-remark-dialog';

/**
 * Editable status pill used on every board. Clicking it opens the four lifecycle
 * states plus the audit trail, so an employee updates progress in place and a
 * manager can see who moved the item last.
 */
@Component({
  selector: 'app-task-status',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './task-status.html',
  styleUrls: ['./task-status.css']
})
export class TaskStatus {
  /** Assignment cards and Task rows use the same control but different endpoints. */
  @Input() entity: 'task' | 'assignment' = 'assignment';
  @Input() id!: number;
  @Input() kind?: string;
  @Input() title = '';
  /**
   * False turns the pill into a read-only badge: it still opens the audit trail
   * but offers no transitions. The admin's own boards keep the controls; the
   * developer/tester boards are someone else's work, so they are only read.
   */
  @Input() editable = true;
  @Input() readOnlyTooltip = 'View status history';
  @Output() changed = new EventEmitter<string>();
  /** Fires only for a reopen, so the card can carry the reason next to the work. */
  @Output() reopened = new EventEmitter<{ note: string }>();

  get options(): StatusMeta[] {
    return STATUS_META.length > 0 ? STATUS_META : DEFAULT_STATUS_LIST;
  }

  saving = false;
  /** Falls back to the first lifecycle state, i.e. the list's "To do" row. */
  private state = STATUS_META.length ? STATUS_META[0].value : 'TODO';

  @Input() set status(value: string | null | undefined) {
    this.state = (value || (STATUS_META[0]?.value ?? '')).toUpperCase();
  }

  get status(): string {
    return this.state;
  }

  get meta() {
    return statusMeta(this.status);
  }

  constructor(
    private workspace: WorkspaceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  select(next: string): void {
    if (this.saving || !next || next === this.status) {
      return;
    }

    // Done is a terminal state: moving out of it again needs a written reason,
    // which the backend also enforces.
    if (this.status === 'DONE' && next !== 'DONE') {
      this.dialog
        .open(StatusRemarkDialog, {
          width: '520px',
          maxWidth: '94vw',
          data: { id: this.id, title: this.title, from: statusMeta('DONE').label, to: statusMeta(next).label }
        })
        .afterClosed()
        .subscribe((note: string | null) => {
          if (note) {
            this.save(next, note);
          }
        });
      return;
    }

    this.save(next);
  }

  private save(next: string, note?: string): void {
    this.saving = true;
    const request$ =
      this.entity === 'task'
        ? this.workspace.updateTaskStatus(this.id, next, note)
        : this.workspace.updateAssignmentStatus(this.id, next, note, this.kind);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.state = next;
        this.changed.emit(next);
        if (note) {
          this.reopened.emit({ note });
        }
        this.snackBar.open(
          note
            ? `Moved to ${statusMeta(next).label} — remark saved to history`
            : `Moved to ${statusMeta(next).label}`,
          'Dismiss',
          { duration: 3000 }
        );
      },
      error: (err) => {
        this.saving = false;
        const message = typeof err?.error === 'string' ? err.error : 'Could not update the status.';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
      }
    });
  }

  openHistory(): void {
    this.dialog.open(StatusHistoryDialog, {
      width: '540px',
      maxHeight: '80vh',
      data: { entity: this.entity, id: this.id, title: this.title }
    });
  }
}
