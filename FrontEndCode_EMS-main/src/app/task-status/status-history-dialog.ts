import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { StatusHistoryItem, WorkspaceService } from '../services/workspace.service';

export interface StatusMeta {
  value: string;
  label: string;
  icon: string;
  badge: string;
}

export const DEFAULT_STATUS_LIST: StatusMeta[] = [
  { value: 'TODO', label: 'To Do', icon: 'radio_button_unchecked', badge: 'ems-badge--neutral' },
  { value: 'ASSIGNED', label: 'Assigned', icon: 'assignment_ind', badge: 'ems-badge--info' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: 'timelapse', badge: 'ems-badge--warning' },
  { value: 'IN_REVIEW', label: 'In Review', icon: 'rate_review', badge: 'ems-badge--info' },
  { value: 'DONE', label: 'Done', icon: 'check_circle', badge: 'ems-badge--success' }
];

/** Single source of truth for how each lifecycle state renders. Initialized with standard defaults. */
export const STATUS_META: StatusMeta[] = [...DEFAULT_STATUS_LIST];

/**
 * Filled from the WORK_STATUS rows of `app_lookup` by ReferenceService. The
 * array is replaced in place so every component that imported it - the boards,
 * the filter chips, the editable pill - sees the new order and wording.
 */
export function applyStatusMeta(items: { code: string; label?: string; icon?: string | null; tone?: string | null }[]): void {
  const next = (items || []).map((item) => ({
    value: String(item.code || '').toUpperCase(),
    label: item.label || String(item.code || ''),
    icon: item.icon || 'radio_button_unchecked',
    badge: `ems-badge--${item.tone || 'neutral'}`
  }));
  STATUS_META.splice(0, STATUS_META.length, ...next);
}

/** Never returns undefined: an unknown state still renders as a neutral pill. */
export function statusMeta(value: string | null | undefined): StatusMeta {
  const key = (value || '').toUpperCase();
  return (
    STATUS_META.find((meta) => meta.value === key) ||
    STATUS_META[0] || {
      value: key || 'UNKNOWN',
      label: key || 'Unknown',
      icon: 'help_outline',
      badge: 'ems-badge--neutral'
    }
  );
}

export interface StatusHistoryData {
  entity: 'task' | 'assignment';
  id: number;
  title?: string;
}

@Component({
  selector: 'app-status-history-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './status-history-dialog.html',
  styleUrls: ['./status-history-dialog.css']
})
export class StatusHistoryDialog implements OnInit {
  items: StatusHistoryItem[] = [];
  loading = true;
  errorMessage = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StatusHistoryData,
    private workspace: WorkspaceService
  ) {}

  ngOnInit(): void {
    this.workspace.getStatusHistory(this.data.entity, this.data.id).subscribe({
      next: (items) => {
        this.items = items || [];
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load the history for this item.';
        this.loading = false;
      }
    });
  }

  label(value: string): string {
    return statusMeta(value).label;
  }

  badge(value: string): string {
    return statusMeta(value).badge;
  }
}
