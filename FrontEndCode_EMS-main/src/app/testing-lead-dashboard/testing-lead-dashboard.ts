import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import {
  kindBadge,
  kindLabel,
  taskCodeOf,
  TesterLoad,
  TestingQueue,
  WorkItem
} from '../models/work-item';
import { ReferenceService } from '../services/reference.service';
import { WorkflowService } from '../services/workflow.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-testing-lead-dashboard',
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
  templateUrl: './testing-lead-dashboard.html',
  styleUrl: './testing-lead-dashboard.css'
})
export class TestingLeadDashboardComponent implements OnInit {
  queue: TestingQueue = {
    items: [],
    testers: [],
    awaiting: 0,
    assigned: 0,
    verified: 0,
    totalReleased: 0
  };

  loading = true;
  errorMessage = '';
  successMessage = '';

  /** Filters */
  filter: 'ALL' | 'AWAITING' | 'ASSIGNED' | 'VERIFIED' = 'AWAITING';
  kindFilter: 'ALL' | 'BUG' | 'TASK' = 'ALL';
  search = '';

  /** View controls */
  detailTab: 'ASSIGN' | 'DETAILS' | 'VERIFY' = 'ASSIGN';
  showTeamRoster = false;

  /** Currently selected item in the review & assignment panel */
  selectedItem: WorkItem | null = null;

  /** Assignment Mode: ORIGINAL (same tester who raised issue) vs ALTERNATIVE (another available tester) */
  assignmentMode: 'ORIGINAL' | 'ALTERNATIVE' = 'ORIGINAL';

  /** Assignment Form State */
  selectedTesterId: number | null = null;
  assignedPriority = 'Medium';
  qaInstructions = '';
  submitting = false;

  /** Verification Form State (if verifying directly) */
  verifying = false;
  verifyResult: 'PASSED' | 'FAILED' = 'PASSED';
  verifyNote = '';

  /** Reference lists */
  priorities: string[] = ['High', 'Medium', 'Low'];

  /** Pagination */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(
    private workflowService: WorkflowService,
    private referenceService: ReferenceService
  ) {}

  ngOnInit(): void {
    const list = this.referenceService.codes('PRIORITY');
    if (list && list.length > 0) {
      this.priorities = list;
    }
    this.loadQueue();
  }

  loadQueue(): void {
    this.loading = true;
    this.errorMessage = '';
    this.workflowService.testingQueue().subscribe({
      next: (q) => {
        this.queue = q;
        this.loading = false;
        // Auto-select first item if none selected or if previous item no longer in list
        if (this.queue.items.length > 0) {
          if (!this.selectedItem) {
            this.selectItem(this.queue.items[0]);
          } else {
            const found = this.queue.items.find((i) => i.id === this.selectedItem?.id);
            if (found) {
              this.selectItem(found);
            } else {
              this.selectItem(this.queue.items[0]);
            }
          }
        } else {
          this.selectedItem = null;
        }
      },
      error: (err) => {
        console.error('Failed to load testing queue:', err);
        this.errorMessage = typeof err.error === 'string' ? err.error : 'Could not load testing queue.';
        this.loading = false;
      }
    });
  }

  get filteredItems(): WorkItem[] {
    const q = this.search.trim().toLowerCase();
    return this.queue.items.filter((item) => {
      // Kind filter
      if (this.kindFilter !== 'ALL' && item.kind !== this.kindFilter) {
        return false;
      }

      // Tab filter
      if (this.filter === 'AWAITING' && item.assignedTesterName) {
        return false;
      }
      if (this.filter === 'ASSIGNED' && (!item.assignedTesterName || item.testingStatus === 'VERIFIED')) {
        return false;
      }
      if (this.filter === 'VERIFIED' && item.testingStatus !== 'VERIFIED') {
        return false;
      }

      // Search
      if (!q) return true;
      const code = taskCodeOf(item).toLowerCase();
      const title = (item.taskTitle || '').toLowerCase();
      const proj = (item.project || '').toLowerCase();
      const dev = (item.assignedToName || '').toLowerCase();
      const tester = (item.assignedTesterName || '').toLowerCase();
      const orig = (item.createdByName || item.createdBy || '').toLowerCase();
      return (
        code.includes(q) ||
        title.includes(q) ||
        proj.includes(q) ||
        dev.includes(q) ||
        tester.includes(q) ||
        orig.includes(q)
      );
    });
  }

  get pagedItems(): WorkItem[] {
    return pageSlice(this.filteredItems, this.pageIndex, this.pageSize);
  }

  setFilter(f: 'ALL' | 'AWAITING' | 'ASSIGNED' | 'VERIFIED'): void {
    this.filter = f;
    this.pageIndex = 0;
  }

  setKindFilter(k: 'ALL' | 'BUG' | 'TASK'): void {
    this.kindFilter = k;
    this.pageIndex = 0;
  }

  clearSearch(): void {
    this.search = '';
    this.pageIndex = 0;
  }

  toggleTeamRoster(): void {
    this.showTeamRoster = !this.showTeamRoster;
  }

  get bugCount(): number {
    return this.queue.items.filter((i) => i.kind === 'BUG').length;
  }

  get taskCount(): number {
    return this.queue.items.filter((i) => i.kind === 'TASK').length;
  }

  get activeTestersCount(): number {
    return this.queue.testers.filter((t) => t.active).length;
  }

  testerWorkloadClass(tester: TesterLoad): string {
    if (!tester.active) return 'is-inactive';
    if (tester.openTestingTasks === 0) return 'is-free';
    if (tester.openTestingTasks <= 2) return 'is-normal';
    return 'is-loaded';
  }

  testerWorkloadLabel(tester: TesterLoad): string {
    if (!tester.active) return 'Inactive';
    if (tester.openTestingTasks === 0) return 'Free';
    return `${tester.openTestingTasks} active`;
  }

  assignDirectlyTo(tester: TesterLoad): void {
    if (!tester.active) return;
    const orig = this.getOriginalTester(this.selectedItem);
    if (orig && tester.id === orig.id) {
      this.chooseOriginalTester();
    } else {
      this.assignmentMode = 'ALTERNATIVE';
      this.selectedTesterId = tester.id;
    }
    this.detailTab = 'ASSIGN';
  }

  /**
   * Looks up the original tester who raised this bug or task.
   */
  getOriginalTester(item?: WorkItem | null): TesterLoad | null {
    if (!item) return null;
    if (item.createdById) {
      const byId = this.queue.testers.find((t) => t.id === item.createdById);
      if (byId) return byId;
    }
    if (item.createdBy) {
      const email = item.createdBy.trim().toLowerCase();
      const byEmail = this.queue.testers.find((t) => (t.email || '').trim().toLowerCase() === email);
      if (byEmail) return byEmail;
    }
    if (item.createdByName) {
      const name = item.createdByName.trim().toLowerCase();
      const byName = this.queue.testers.find((t) => (t.name || '').trim().toLowerCase() === name);
      if (byName) return byName;
    }
    return null;
  }

  /**
   * Checks whether the original tester is available (active member of testing team configured for this project).
   */
  isOriginalTesterAvailable(item?: WorkItem | null): boolean {
    const orig = this.getOriginalTester(item);
    if (!orig || !orig.active) return false;
    if (item?.project && orig.assignedProjects && orig.assignedProjects.length > 0) {
      return orig.assignedProjects.some((p) => this.projectMatches(p, item.project));
    }
    return true;
  }

  projectMatches(p1?: string | null, p2?: string | null): boolean {
    if (!p1 || !p2) return false;
    const s1 = p1.trim().toLowerCase();
    const s2 = p2.trim().toLowerCase();
    if (s1 === s2) return true;
    const n1 = s1.replace(/[\s_\-]+/g, '');
    const n2 = s2.replace(/[\s_\-]+/g, '');
    if (n1 === n2) return true;
    return n1.length >= 5 && n2.length >= 5 && (n1.includes(n2) || n2.includes(n1));
  }

  get projectTesters(): TesterLoad[] {
    const targetProject = this.selectedItem?.project || '';
    if (!targetProject || !targetProject.trim()) {
      return this.queue.testers;
    }
    return this.queue.testers.filter((t) => {
      if (!t.assignedProjects || t.assignedProjects.length === 0) return false;
      return t.assignedProjects.some((p) => this.projectMatches(p, targetProject));
    });
  }

  /**
   * Returns all available alternative testers (excluding original tester), filtered by project hierarchy.
   */
  get alternativeTesters(): TesterLoad[] {
    const orig = this.getOriginalTester(this.selectedItem);
    const pool = this.projectTesters.length ? this.projectTesters : this.queue.testers;
    return pool.filter((t) => (!orig || t.id !== orig.id) && t.active);
  }

  /**
   * Returns whether currently selected tester is the original reporter.
   */
  get isOriginalTesterSelected(): boolean {
    const orig = this.getOriginalTester(this.selectedItem);
    return !!(orig && this.selectedTesterId === orig.id);
  }

  /**
   * Checks whether a given work item is assigned to its original reporter.
   */
  isAssignedToOriginal(item?: WorkItem | null): boolean {
    if (!item || !item.assignedTesterName) return false;
    const orig = this.getOriginalTester(item);
    if (!orig) return false;
    return item.assignedTesterId === orig.id ||
      (item.assignedTesterEmail || '').toLowerCase() === (orig.email || '').toLowerCase() ||
      (item.assignedTesterName || '').toLowerCase() === (orig.name || '').toLowerCase();
  }

  /**
   * Selects the original tester who raised the issue (Requirement 5).
   */
  chooseOriginalTester(): void {
    const orig = this.getOriginalTester(this.selectedItem);
    if (orig && orig.active) {
      this.assignmentMode = 'ORIGINAL';
      this.selectedTesterId = orig.id;
    }
  }

  /**
   * Switches to alternative tester mode (Requirement 6).
   */
  chooseAlternativeMode(): void {
    this.assignmentMode = 'ALTERNATIVE';
    const orig = this.getOriginalTester(this.selectedItem);
    if (orig && this.selectedTesterId === orig.id) {
      const firstAlt = this.alternativeTesters[0];
      this.selectedTesterId = firstAlt ? firstAlt.id : null;
    }
  }

  selectItem(item: WorkItem): void {
    this.selectedItem = item;
    this.assignedPriority = item.priority || 'Medium';
    this.qaInstructions = item.testingInstructions || '';
    this.verifying = false;
    this.verifyNote = '';
    this.errorMessage = '';
    this.successMessage = '';

    const orig = this.getOriginalTester(item);
    const origAvailable = this.isOriginalTesterAvailable(item);

    if (item.assignedTesterId) {
      this.selectedTesterId = item.assignedTesterId;
      if (orig && item.assignedTesterId === orig.id) {
        this.assignmentMode = 'ORIGINAL';
      } else {
        this.assignmentMode = 'ALTERNATIVE';
      }
    } else {
      // Step 5: By default, assign to the same tester who originally raised the issue
      if (origAvailable && orig) {
        this.assignmentMode = 'ORIGINAL';
        this.selectedTesterId = orig.id;
      } else {
        // Step 6: If original tester is unavailable, default to alternative tester mode
        this.assignmentMode = 'ALTERNATIVE';
        const firstAlt = this.alternativeTesters[0];
        this.selectedTesterId = firstAlt ? firstAlt.id : null;
      }
    }
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

  submitAssignment(): void {
    if (!this.selectedItem) return;
    if (!this.selectedTesterId) {
      this.errorMessage = 'Please select a tester from the team.';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const isOriginal = this.isOriginalTesterSelected;

    this.workflowService
      .assignTester(this.selectedItem.id, {
        testerId: this.selectedTesterId,
        priority: this.assignedPriority,
        note: this.qaInstructions,
        kind: this.selectedItem.kind
      })
      .subscribe({
        next: (updated) => {
          const roleBadge = isOriginal ? 'original reporter' : 'alternative tester';
          this.successMessage = `${taskCodeOf(updated)} successfully assigned to ${roleBadge} ${updated.assignedTesterName}!`;
          this.submitting = false;
          this.loadQueue();
        },
        error: (err) => {
          console.error('Failed to assign tester:', err);
          this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to assign tester.';
          this.submitting = false;
        }
      });
  }

  submitVerification(): void {
    if (!this.selectedItem) return;
    if (this.verifyResult === 'FAILED' && !this.verifyNote.trim()) {
      this.errorMessage = 'Please provide a note explaining what failed.';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';

    this.workflowService
      .verifyTest(this.selectedItem.id, {
        result: this.verifyResult,
        note: this.verifyNote,
        kind: this.selectedItem.kind
      })
      .subscribe({
        next: (updated) => {
          this.successMessage =
            this.verifyResult === 'PASSED'
              ? `${taskCodeOf(updated)} marked as VERIFIED!`
              : `${taskCodeOf(updated)} returned to development for rework.`;
          this.submitting = false;
          this.verifying = false;
          this.loadQueue();
        },
        error: (err) => {
          console.error('Failed to verify:', err);
          this.errorMessage = typeof err.error === 'string' ? err.error : 'Failed to verify task.';
          this.submitting = false;
        }
      });
  }

  codeOf(item?: WorkItem | null): string {
    return taskCodeOf(item);
  }

  badgeOf(kind?: string): string {
    return kindBadge(kind);
  }

  labelOf(kind?: string): string {
    return kindLabel(kind);
  }

  formatDate(date?: string | Date | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(date);
    }
  }

  attachmentUrl(filename?: string | null): string {
    if (!filename) return '';
    return `http://localhost:9001/attachments/${encodeURIComponent(filename)}`;
  }
}

