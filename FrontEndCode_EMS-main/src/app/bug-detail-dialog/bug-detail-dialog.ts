import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TaskModel } from '../models/employee';
import { WorkItem, taskCodeOf } from '../models/work-item';
import { ReferenceService } from '../services/reference.service';

export interface BugDetailDialogData {
  item: TaskModel | WorkItem;
}

@Component({
  selector: 'app-bug-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './bug-detail-dialog.html',
  styleUrls: ['./bug-detail-dialog.css']
})
export class BugDetailDialog {
  zoom = false;

  constructor(
    private dialogRef: MatDialogRef<BugDetailDialog>,
    @Inject(MAT_DIALOG_DATA) public data: BugDetailDialogData,
    private reference: ReferenceService
  ) {}

  get item(): any {
    return this.data?.item;
  }

  get bugCode(): string {
    return taskCodeOf(this.item);
  }

  get priorityLabel(): string {
    return this.reference.label('PRIORITY', this.item?.priority) || this.item?.priority || 'Normal';
  }

  get priorityBadge(): string {
    return this.reference.badge('PRIORITY', this.item?.priority);
  }

  get imageUrl(): string | null {
    const filename = this.item?.reproductionStepsImage || this.item?.attachmentPath;
    if (!filename) return null;
    if (filename.startsWith('data:') || filename.startsWith('http')) {
      return filename;
    }
    return 'http://localhost:9001/attachments/' + filename;
  }

  get reproductionStepsList(): string[] {
    const raw = this.item?.reproductionSteps || '';
    if (!raw.trim()) return [];
    return raw
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  isImage(filename: string): boolean {
    const ext = (filename || '').toLowerCase();
    return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif');
  }

  openExternalImage(): void {
    if (this.imageUrl) {
      window.open(this.imageUrl, '_blank');
    }
  }

  downloadDiagram(): void {
    if (!this.imageUrl) return;
    const a = document.createElement('a');
    a.href = this.imageUrl;
    a.download = `${this.bugCode}_reproduction_flow.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  close(): void {
    this.dialogRef.close();
  }
}
