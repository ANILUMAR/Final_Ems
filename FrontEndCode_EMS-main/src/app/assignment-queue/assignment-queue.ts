import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import {
  DeveloperLoad,
  DevQueue,
  kindBadge,
  kindLabel,
  taskCodeOf,
  WorkItem
} from '../models/work-item';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

/**
 * The developer team leader's screen.
 *
 * <p>Only work the testing team leader approved arrives here - nothing else,
 * however it was created, because this is the queue that puts work into the
 * developers' hands. The right-hand panel carries each developer's open load
 * next to the item being handed out, so the choice is made against the priority
 * of the work and the amount already in somebody's hands, not by memory.</p>
 */
@Component({
  selector: 'app-assignment-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    Pager
  ],
  templateUrl: './assignment-queue.html',
  styleUrl: './assignment-queue.css'
})
export class AssignmentQueue implements OnInit {
  queue: DevQueue = { items: [], developers: [], awaiting: 0, assigned: 0 };
  loading = true;
  errorMessage = '';
  successMessage = '';

  /** Which list is on the left: work still to place, or work already placed. */
  tab: 'awaiting' | 'assigned' = 'awaiting';

  /** Each tab pages in the browser; switching tabs starts again at page one. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  /** The item being handed out; the right panel follows this. */
  selected: WorkItem | null = null;
  developerId: number | null = null;
  priority = '';
  startDate = '';
  endDate = '';
  note = '';
  assigning = false;

  constructor(private workflow: WorkflowService, private reference: ReferenceService) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.workflow.devQueue().subscribe({
      next: (queue) => {
        this.queue = {
          items: queue?.items || [],
          developers: queue?.developers || [],
          awaiting: queue?.awaiting || 0,
          assigned: queue?.assigned || 0
        };
        // Keep the open panel in step with the refreshed rows.
        if (this.selected) {
          this.selected = this.queue.items.find((item) => item.id === this.selected?.id) || null;
        }
        // Placing an item moves it to the assigned tab, so the page can run
        // short; clamp instead of leaving the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.currentTotal, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'Could not load the assignment queue right now.';
      }
    });
  }

  get awaiting(): WorkItem[] {
    return this.queue.items.filter((item) => !item.assignedToName);
  }

  get assigned(): WorkItem[] {
    return this.queue.items.filter((item) => !!item.assignedToName);
  }

  /** The rows the open tab renders for the current page. */
  get pagedAwaiting(): WorkItem[] {
    return pageSlice(this.awaiting, this.pageIndex, this.pageSize);
  }

  get pagedAssigned(): WorkItem[] {
    return pageSlice(this.assigned, this.pageIndex, this.pageSize);
  }

  /** How many rows the open tab holds, so the pager follows the visible list. */
  get currentTotal(): number {
    return this.tab === 'awaiting' ? this.awaiting.length : this.assigned.length;
  }

  get priorities() {
    return this.reference.items('PRIORITY');
  }

  /** Developers with nothing in their hands are called out in the panel. */
  get freeDevelopers(): number {
    return this.queue.developers.filter((developer) => developer.active && developer.openTasks === 0).length;
  }

  setTab(tab: 'awaiting' | 'assigned'): void {
    this.tab = tab;
    // The other list has its own length, so page one is the only safe start.
    this.pageIndex = 0;
  }

  /* ---------- the hand-over ---------- */

  select(item: WorkItem): void {
    this.selected = item;
    this.developerId = null;
    this.priority = (item.priority || '').toUpperCase();
    this.note = '';
    this.startDate = this.toIsoDate(item.startDate);
    this.endDate = this.toIsoDate(item.endDate);
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelSelection(): void {
    this.selected = null;
    this.developerId = null;
    this.note = '';
  }

  get canAssign(): boolean {
    return !!this.selected && this.developerId !== null && !this.assigning;
  }

  assign(): void {
    if (!this.canAssign || !this.selected || this.developerId === null) {
      return;
    }
    this.assigning = true;
    this.errorMessage = '';
    this.successMessage = '';
    const item = this.selected;
    this.workflow
      .assign(item.id, {
        developerId: this.developerId,
        priority: this.priority,
        startDate: this.startDate,
        endDate: this.endDate,
        note: this.note.trim(),
        kind: item.kind
      })
      .subscribe({
        next: (saved) => {
          this.assigning = false;
          this.successMessage = `${taskCodeOf(saved)} assigned to Java Developer ${saved.assignedToName}. It is on their board now.`;
          this.selected = null;
          this.developerId = null;
          this.tab = 'awaiting';
          this.load();
        },
        error: (err) => {
          this.assigning = false;
          this.errorMessage = typeof err?.error === 'string' ? err.error : 'The assignment could not be saved.';
        }
      });
  }

  /* ---------- template helpers ---------- */

  /** A developer's load, worded the way the leader thinks about it. */
  loadLabel(developer: DeveloperLoad): string {
    if (!developer.active) {
      return 'inactive';
    }
    if (developer.openTasks === 0) {
      return 'free';
    }
    return `${developer.openTasks} open`;
  }

  loadClass(developer: DeveloperLoad): string {
    if (!developer.active) {
      return 'is-out';
    }
    if (developer.openTasks === 0) {
      return 'is-free';
    }
    return developer.openTasks <= 2 ? 'is-busy' : 'is-loaded';
  }

  code(item: WorkItem): string {
    return taskCodeOf(item);
  }

  kind(item: WorkItem): string {
    return kindLabel(item.kind);
  }

  kindClass(item: WorkItem): string {
    return kindBadge(item.kind);
  }

  priorityLabel(value?: string): string {
    return this.reference.label('PRIORITY', value || '') || (value || '—');
  }

  /** The severest priority still waiting, so the queue reads at a glance. */
  get topPriority(): string {
    return this.priorityLabel(this.awaiting[0]?.priority);
  }

  isOverdue(item: WorkItem): boolean {
    if (!item.endDate) {
      return false;
    }
    return new Date(item.endDate).getTime() < new Date().setHours(0, 0, 0, 0);
  }

  attachmentUrl(name: string): string {
    return 'http://localhost:9001/attachments/' + name;
  }

  private toIsoDate(value: string | Date | undefined): string {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  }
}
