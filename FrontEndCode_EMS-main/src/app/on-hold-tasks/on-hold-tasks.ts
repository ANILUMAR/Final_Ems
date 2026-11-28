import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { isManagerRole, isSuperAdminRole } from '../models/role';
import { kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';
import { TicketDetailDialog } from '../ticket-detail-dialog/ticket-detail-dialog';
import { WorkflowPipelineComponent } from '../shared/workflow-pipeline/workflow-pipeline.component';

@Component({
  selector: 'app-on-hold-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    MatDialogModule,
    Pager,
    WorkflowPipelineComponent
  ],
  templateUrl: './on-hold-tasks.html',
  styleUrl: './on-hold-tasks.css'
})
export class OnHoldTasksComponent implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';
  successMessage = '';

  totalOnHold = 0;
  totalHeldTasks = 0;
  totalHeldBugs = 0;

  filter: 'ALL' | 'TASK' | 'BUG' = 'ALL';
  search = '';

  /** Leader rights */
  isLeader = false;
  isSuperAdmin = false;
  currentRole = '';
  currentEmail = '';

  /** Rework Dialog */
  reopeningItem: WorkItem | null = null;
  reworkInstructions = '';
  submittingRework = false;

  /** Pagination */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    private workflowService: WorkflowService,
    private dialog: MatDialog
  ) {
    this.currentRole = (localStorage.getItem('role') || '').trim().toUpperCase();
    this.currentEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
    this.isSuperAdmin = isSuperAdminRole(this.currentRole);
    this.isLeader = isManagerRole(this.currentRole) || this.currentRole === 'DEVELOPER_LEAD' || this.currentRole === 'TEAM_LEAD' || this.currentRole === 'TEAM_LEADER';
  }

  ngOnInit(): void {
    this.loadData();
  }

  openTicketDetails(item: WorkItem): void {
    const ref = this.dialog.open(TicketDetailDialog, {
      data: { item },
      width: '92vw',
      maxWidth: '1150px',
      maxHeight: '92vh'
    });
    ref.afterClosed().subscribe(() => {
      this.loadData();
    });
  }

  openBugDetails(item: WorkItem): void {
    this.openTicketDetails(item);
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    this.workflowService.onHoldTasks().subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.totalOnHold = res.totalOnHold || this.items.length;
        this.totalHeldTasks = this.items.filter(i => (i.kind || '').toUpperCase() !== 'BUG').length;
        this.totalHeldBugs = this.items.filter(i => (i.kind || '').toUpperCase() === 'BUG').length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load on-hold tasks:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Could not load on-hold tasks.';
        this.loading = false;
      }
    });
  }

  get filteredItems(): WorkItem[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter((item) => {
      const isBug = (item.kind || '').toUpperCase() === 'BUG';
      if (this.filter === 'TASK' && isBug) {
        return false;
      }
      if (this.filter === 'BUG' && !isBug) {
        return false;
      }

      if (!q) {
        return true;
      }
      const code = taskCodeOf(item).toLowerCase();
      const title = (item.taskTitle || '').toLowerCase();
      const project = (item.project || '').toLowerCase();
      const owner = (item.assignedToName || '').toLowerCase();
      const reason = (item.holdReason || '').toLowerCase();
      return code.includes(q) || title.includes(q) || project.includes(q) || owner.includes(q) || reason.includes(q);
    });
  }

  get pagedItems(): WorkItem[] {
    return pageSlice(this.filteredItems, this.pageIndex, this.pageSize);
  }

  get lastPageIndex(): number {
    return lastPageOf(this.filteredItems.length, this.pageSize);
  }

  setFilter(filter: 'ALL' | 'TASK' | 'BUG'): void {
    this.filter = filter;
    this.pageIndex = 0;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  onPageChange(index: number): void {
    this.pageIndex = index;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageIndex = 0;
  }

  /* Unhold Action: Approve for testing (ready for batch release) */
  approveForTesting(item: WorkItem): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.workflowService.unhold(item.id, item.kind, 'APPROVE_FOR_TESTING').subscribe({
      next: () => {
        this.successMessage = `${taskCodeOf(item)} unheld and approved! You can now batch-release it from Developer Completed screen.`;
        this.loadData();
      },
      error: (err) => {
        console.error('Failed to approve held task:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to approve task.';
      }
    });
  }

  /* Unhold Action: Open Rework Modal */
  openReworkModal(item: WorkItem): void {
    this.reopeningItem = item;
    this.reworkInstructions = '';
  }

  closeReworkModal(): void {
    this.reopeningItem = null;
    this.reworkInstructions = '';
  }

  submitRework(): void {
    if (!this.reopeningItem) return;
    const note = this.reworkInstructions.trim();
    if (!note) {
      alert('Please enter rework instructions for the developer.');
      return;
    }
    this.submittingRework = true;
    this.errorMessage = '';
    this.successMessage = '';

    const item = this.reopeningItem;
    this.workflowService.unhold(item.id, item.kind, 'REOPEN_TO_DEVELOPER', note).subscribe({
      next: () => {
        this.submittingRework = false;
        this.closeReworkModal();
        this.successMessage = `${taskCodeOf(item)} sent back to ${item.assignedToName || 'developer'} for rework!`;
        this.loadData();
      },
      error: (err) => {
        this.submittingRework = false;
        console.error('Failed to return task for rework:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to reopen task.';
      }
    });
  }

  taskCode(item: WorkItem): string {
    return taskCodeOf(item);
  }

  kindBadge(item: WorkItem): string {
    return kindBadge(item?.kind);
  }

  kindLabel(item: WorkItem): string {
    return kindLabel(item?.kind);
  }
}
