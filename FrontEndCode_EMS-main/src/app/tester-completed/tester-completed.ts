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
import { kindBadge, kindLabel, taskCodeOf, WorkItem } from '../models/work-item';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';
import { BugDetailDialog } from '../bug-detail-dialog/bug-detail-dialog';

@Component({
  selector: 'app-tester-completed',
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
    Pager
  ],
  templateUrl: './tester-completed.html',
  styleUrl: './tester-completed.css'
})
export class TesterCompletedComponent implements OnInit {
  items: WorkItem[] = [];
  loading = true;
  errorMessage = '';

  total = 0;
  bugsCount = 0;
  tasksCount = 0;

  filter: 'ALL' | 'BUG' | 'TASK' = 'ALL';
  search = '';

  testerName = '';
  testerEmail = '';

  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    private workflowService: WorkflowService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.errorMessage = '';
    this.workflowService.testerCompletedTasks().subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.total = res.total || this.items.length;
        this.bugsCount = res.bugsCount || this.items.filter(i => (i.kind || '').toUpperCase() === 'BUG').length;
        this.tasksCount = res.tasksCount || this.items.filter(i => (i.kind || '').toUpperCase() !== 'BUG').length;
        this.testerName = res.testerName || localStorage.getItem('name') || '';
        this.testerEmail = res.testerEmail || localStorage.getItem('email') || '';
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredItems.length, this.pageSize));
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load tester completed tasks:', err);
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'Failed to load completed testing tasks.';
        this.loading = false;
      }
    });
  }

  get filteredItems(): WorkItem[] {
    const term = this.search.trim().toLowerCase();
    return this.items.filter((item) => {
      const isBug = (item.kind || '').toUpperCase() === 'BUG';
      if (this.filter === 'BUG' && !isBug) return false;
      if (this.filter === 'TASK' && isBug) return false;

      if (!term) return true;

      const code = taskCodeOf(item).toLowerCase();
      const title = (item.taskTitle || '').toLowerCase();
      const proj = (item.project || '').toLowerCase();
      const dev = (item.assignedToName || '').toLowerCase();
      const note = (item.verificationNote || '').toLowerCase();

      return code.includes(term) || title.includes(term) || proj.includes(term) || dev.includes(term) || note.includes(term);
    });
  }

  get pagedItems(): WorkItem[] {
    return pageSlice(this.filteredItems, this.pageIndex, this.pageSize);
  }

  setFilter(filter: 'ALL' | 'BUG' | 'TASK'): void {
    this.filter = filter;
    this.pageIndex = 0;
  }

  onSearchChange(): void {
    this.pageIndex = 0;
  }

  code(item: WorkItem): string {
    return taskCodeOf(item);
  }

  kindBadge(kind?: string): string {
    return kindBadge(kind);
  }

  kindLabel(kind?: string): string {
    return kindLabel(kind);
  }

  priorityBadge(priority?: string): string {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH': return 'ems-badge--danger';
      case 'MEDIUM': return 'ems-badge--warning';
      case 'LOW': return 'ems-badge--neutral';
      default: return 'ems-badge--neutral';
    }
  }

  isBug(item: WorkItem): boolean {
    return (item.kind || '').toUpperCase() === 'BUG';
  }

  openBugDetails(item: WorkItem): void {
    this.dialog.open(BugDetailDialog, {
      data: { item },
      width: '92vw',
      maxWidth: '1100px',
      maxHeight: '92vh'
    });
  }
}
