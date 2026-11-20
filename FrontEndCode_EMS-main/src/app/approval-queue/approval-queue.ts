import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { approvalBadge, approvalLabel, kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

/**
 * The testing team leader's decision screen.
 *
 * <p>Everything the testers raised arrives here - tasks and bugs alike, because
 * the leader decides on both. Waiting items come first; approving one puts it
 * on the developer team leader's assignment queue, sending it back returns it
 * to the tester with the comment they must correct against.</p>
 */
@Component({
  selector: 'app-approval-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    Pager
  ],
  templateUrl: './approval-queue.html',
  styleUrl: './approval-queue.css'
})
export class ApprovalQueue implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  /** PENDING, APPROVED, REJECTED or ALL. */
  filter = 'PENDING';

  /** The queue pages in the browser, so the chips still count every item. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /** The item whose reject box is open, and the reason being typed. */
  rejectingId: number | null = null;
  rejectNote = '';
  /** The item with a decision in flight. */
  busyId: number | null = null;

  constructor(private workflow: WorkflowService, private reference: ReferenceService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.workflow.approvals().subscribe({
      next: (rows) => {
        this.items = rows || [];
        // Deciding an item moves it out of the waiting chip, so the page can run
        // short; clamp instead of leaving the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load the review queue right now.';
      }
    });
  }

  get counts(): { all: number; pending: number; approved: number; rejected: number } {
    return {
      all: this.items.length,
      pending: this.count('PENDING'),
      approved: this.count('APPROVED'),
      rejected: this.count('REJECTED')
    };
  }

  private count(state: string): number {
    return this.items.filter((item) => this.stateOf(item) === state).length;
  }

  get filtered(): WorkItem[] {
    if (this.filter === 'ALL') {
      return this.items;
    }
    return this.items.filter((item) => this.stateOf(item) === this.filter);
  }

  /** The slice actually rendered for the current page. */
  get pagedItems(): WorkItem[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  setFilter(value: string): void {
    this.filter = value;
    this.pageIndex = 0;
    this.rejectingId = null;
    this.rejectNote = '';
  }

  stateOf(item: WorkItem): string {
    return (item.approvalState || 'PENDING').toUpperCase();
  }

  /* ---------- decisions ---------- */

  approve(item: WorkItem): void {
    if (this.busyId !== null) {
      return;
    }
    this.busyId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.workflow.review(item.id, 'APPROVE', undefined, item.kind).subscribe({
      next: (saved) => {
        this.busyId = null;
        this.successMessage = `${taskCodeOf(saved)} approved! It has been forwarded to the Java Team Leader's assignment queue.`;
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'The decision could not be saved.';
      }
    });
  }

  openReject(item: WorkItem): void {
    this.rejectingId = item.id;
    this.rejectNote = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelReject(): void {
    this.rejectingId = null;
    this.rejectNote = '';
  }

  get canReject(): boolean {
    return this.busyId === null && !!this.rejectNote.trim();
  }

  reject(item: WorkItem): void {
    if (!this.canReject) {
      return;
    }
    this.busyId = item.id;
    this.errorMessage = '';
    this.successMessage = '';
    this.workflow.review(item.id, 'REJECT', this.rejectNote.trim(), item.kind).subscribe({
      next: (saved) => {
        this.busyId = null;
        this.rejectingId = null;
        this.rejectNote = '';
        this.successMessage = `${taskCodeOf(saved)} sent back to ${saved.createdByName || 'the tester'} with your comment.`;
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'The decision could not be saved.';
      }
    });
  }

  /* ---------- template helpers ---------- */

  code(item: WorkItem): string {
    return taskCodeOf(item);
  }

  kind(item: WorkItem): string {
    return kindLabel(item.kind);
  }

  kindClass(item: WorkItem): string {
    return kindBadge(item.kind);
  }

  stateLabel(item: WorkItem): string {
    return approvalLabel(this.stateOf(item));
  }

  stateClass(item: WorkItem): string {
    return approvalBadge(this.stateOf(item));
  }

  priorityLabel(value?: string): string {
    return this.reference.label('PRIORITY', value || '') || (value || '—');
  }

  reporter(item: WorkItem): string {
    return item.createdByName || item.createdBy || 'a tester';
  }

  attachmentUrl(name: string): string {
    return 'http://localhost:9001/attachments/' + name;
  }
}
