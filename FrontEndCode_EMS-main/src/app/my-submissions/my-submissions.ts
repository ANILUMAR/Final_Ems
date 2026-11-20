import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { approvalBadge, approvalLabel, kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

/**
 * The tester's own trail: everything they raised, in whichever state it is in.
 *
 * <p>This is where a rejection lands. The team leader's comment is shown on the
 * card and the item can be corrected and sent again from here - the task code
 * stays the same across the round trip, so the corrected report and the refused
 * one are the same item, not a new one.</p>
 */
@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    Pager
  ],
  templateUrl: './my-submissions.html',
  styleUrl: './my-submissions.css'
})
export class MySubmissions implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  /** ALL, PENDING, APPROVED or REJECTED. */
  filter = 'ALL';

  /** The trail pages in the browser, so the chips still count every item. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /** The item being corrected; null when no editor is open. */
  editing: WorkItem | null = null;
  editTitle = '';
  editPriority = '';
  editDescription = '';
  saving = false;

  constructor(
    private workflow: WorkflowService,
    private reference: ReferenceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.workflow.mySubmissions().subscribe({
      next: (rows) => {
        this.items = rows || [];
        // A decision can move an item out of the chosen chip, so the page may no
        // longer exist; clamp instead of leaving the pager past the end.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load your submissions right now.';
      }
    });
  }

  get priorities() {
    return this.reference.items('PRIORITY');
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

  stateOf(item: WorkItem): string {
    return (item.approvalState || 'PENDING').toUpperCase();
  }

  /** True once the developer team leader has handed the work out. */
  isAssigned(item: WorkItem): boolean {
    return !!item.assignedToName;
  }

  setFilter(value: string): void {
    this.filter = value;
    this.pageIndex = 0;
  }

  /* ---------- correction ---------- */

  startCorrection(item: WorkItem): void {
    this.editing = item;
    this.editTitle = item.taskTitle || '';
    this.editPriority = (item.priority || '').toUpperCase();
    this.editDescription = item.description || '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelCorrection(): void {
    this.editing = null;
  }

  get canResubmit(): boolean {
    return !!this.editing && !!this.editTitle.trim() && !this.saving;
  }

  resubmit(): void {
    if (!this.canResubmit || !this.editing) {
      return;
    }
    this.saving = true;
    const id = this.editing.id;
    this.workflow
      .correct(id, {
        taskTitle: this.editTitle.trim(),
        priority: this.editPriority,
        description: this.editDescription
      })
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.editing = null;
          this.successMessage = `${taskCodeOf(saved)} corrected and sent back for review.`;
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage =
            typeof err?.error === 'string' ? err.error : 'The correction could not be saved.';
        }
      });
  }

  /* ---------- helpers for the template ---------- */

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
    if (this.stateOf(item) === 'APPROVED' && this.isAssigned(item)) {
      return 'With a developer';
    }
    return approvalLabel(this.stateOf(item));
  }

  stateClass(item: WorkItem): string {
    if (this.stateOf(item) === 'APPROVED' && this.isAssigned(item)) {
      return 'ems-badge--info';
    }
    return approvalBadge(this.stateOf(item));
  }

  priorityLabel(value?: string): string {
    return this.reference.label('PRIORITY', value || '') || (value || '—');
  }

  attachmentUrl(name: string): string {
    return 'http://localhost:9001/attachments/' + name;
  }

  goToRaise(): void {
    this.router.navigate(['/issues/new']);
  }
}
