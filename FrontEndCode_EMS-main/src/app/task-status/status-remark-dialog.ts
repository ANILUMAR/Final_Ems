import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

export interface StatusRemarkData {
  id: number;
  title?: string;
  /** Lifecycle state the item is leaving (always "Done" today). */
  from: string;
  /** Lifecycle state the item is moving to. */
  to: string;
}

/**
 * Work that has reached Done may only move again with a written reason, so the
 * audit trail answers "why was this reopened?" instead of just "who did it".
 * Closing with a string returns the remark; closing any other way cancels.
 */
@Component({
  selector: 'app-status-remark-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './status-remark-dialog.html',
  styleUrls: ['./status-remark-dialog.css']
})
export class StatusRemarkDialog {
  note = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: StatusRemarkData) {}

  get remark(): string {
    return this.note.trim();
  }

  get isValid(): boolean {
    return this.remark.length > 0;
  }
}
