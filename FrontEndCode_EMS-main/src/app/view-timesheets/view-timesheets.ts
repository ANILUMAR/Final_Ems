import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { TimesheetEntry } from '../models/employee';
import { Timesheet } from '../services/timesheet';
import { ReferenceService } from '../services/reference.service';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

@Component({
  selector: 'app-view-timesheets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RouterModule,
    Pager
  ],
  templateUrl: './view-timesheets.html',
  styleUrl: './view-timesheets.css'
})
export class ViewTimesheets implements OnInit {
  entries: TimesheetEntry[] = [];
  loading = true;
  errorMessage = '';

  search = '';
  status = 'ALL';
  mineOnly = false;

  /** The table pages in the browser: the stats and the chips span every entry. */
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  constructor(private timesheetService: Timesheet, private reference: ReferenceService) {}

  ngOnInit(): void {
    this.loadTimesheets();
  }

  /* ---------- derived data ---------- */

  get filtered(): TimesheetEntry[] {
    const term = this.search.trim().toLowerCase();
    const email = (localStorage.getItem('email') || '').toLowerCase();
    const name = (localStorage.getItem('name') || '').toLowerCase();

    return this.entries
      .filter((entry) => {
        const owner = (entry.employeeName || '').toLowerCase();
        const matchesMine = !this.mineOnly || owner === email || (!!name && owner === name);
        const matchesStatus = this.status === 'ALL' || (entry.status || '').toUpperCase() === this.status;
        const matchesSearch =
          !term ||
          [entry.employeeName, entry.project, entry.date, entry.status]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term));
        return matchesMine && matchesStatus && matchesSearch;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  /** The rows actually rendered for the current page. */
  get pagedEntries(): TimesheetEntry[] {
    return pageSlice(this.filtered, this.pageIndex, this.pageSize);
  }

  get totalHours(): number {
    return this.filtered.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  }

  get pendingCount(): number {
    return this.entries.filter((entry) => (entry.status || '').toUpperCase() === 'PENDING').length;
  }

  get approvedCount(): number {
    return this.entries.filter((entry) => (entry.status || '').toUpperCase() === 'APPROVED').length;
  }

  /** The chips are the TIMESHEET_STATUS rows in app_lookup, with their counts. */
  get statusChips(): { key: string; label: string; count: number }[] {
    return [
      { key: 'ALL', label: 'All', count: this.entries.length },
      ...this.reference.items('TIMESHEET_STATUS').map((item) => ({
        key: item.code.toUpperCase(),
        label: item.label,
        count: this.entries.filter((entry) => (entry.status || '').toUpperCase() === item.code.toUpperCase()).length
      }))
    ];
  }

  /* ---------- filtering ---------- */

  setStatus(key: string): void {
    this.status = key;
    this.pageIndex = 0;
  }

  toggleMine(): void {
    this.mineOnly = !this.mineOnly;
    this.pageIndex = 0;
  }

  /** A new search term always starts again at the first page. */
  onSearchChange(): void {
    this.pageIndex = 0;
  }

  /* ---------- data ---------- */

  loadTimesheets(): void {
    this.loading = true;
    this.errorMessage = '';

    this.timesheetService.getTimesheets().subscribe({
      next: (data: TimesheetEntry[]) => {
        this.entries = data || [];
        // A reload can empty a week, so never leave the pager past the last page.
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filtered.length, this.pageSize));
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to load timesheets', err);
        this.errorMessage = 'Could not load timesheets right now.';
        this.loading = false;
      }
    });
  }

  /* ---------- presentation helpers ---------- */

  initials(name: string): string {
    const parts = (name || '?').split(/[\s.@]+/).filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  statusBadge(status: string): string {
    return this.reference.badge('TIMESHEET_STATUS', status);
  }

  statusLabel(status: string): string {
    return this.reference.label('TIMESHEET_STATUS', status) || 'Unknown';
  }

  formatDate(date: string): string {
    if (!date) {
      return '—';
    }
    const parsed = new Date(date);
    return isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  weekDay(date: string): string {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { weekday: 'short' });
  }
}
