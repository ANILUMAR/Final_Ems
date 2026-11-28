import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { Pager } from '../shared/pager';
import { DEFAULT_PAGE_SIZE, lastPageOf, pageSlice } from '../shared/pagination';

export interface AuditLogItem {
  id: string;
  category: 'STATUS_CHANGE' | 'TICKET_DELETION' | 'TIMESHEET' | 'SECURITY_RBAC' | 'SYSTEM' | string;
  action: string;
  entityType?: string;
  entityId?: string;
  entityCode?: string;
  entityTitle?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  fromValue?: string;
  toValue?: string;
  details?: string;
  remarks?: string;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER' | string;
  timestamp: string | Date;
}

export interface AuditStats {
  totalActivities: number;
  statusTransitions: number;
  deletions: number;
  timesheetEvents: number;
  activeUsers: number;
}

@Component({
  selector: 'app-audit-logs',
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
    Pager
  ],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css'
})
export class AuditLogs implements OnInit {
  logs: AuditLogItem[] = [];
  stats: AuditStats = {
    totalActivities: 0,
    statusTransitions: 0,
    deletions: 0,
    timesheetEvents: 0,
    activeUsers: 0
  };

  loading = true;
  errorMessage = '';
  search = '';
  selectedCategory = 'ALL';
  fromDate = '';
  toDate = '';
  activePreset: 'all' | 'today' | 'week' | 'month' = 'all';

  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;

  // Selected entry for detailed side inspection
  selectedLog: AuditLogItem | null = null;

  private apiUrl = 'http://localhost:9001/api/audit-logs';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadLogs();
    this.loadStats();
  }

  loadLogs(): void {
    this.loading = true;
    this.errorMessage = '';
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<AuditLogItem[]>(this.apiUrl, { headers }).subscribe({
      next: (data) => {
        this.logs = data || [];
        this.loading = false;
        this.pageIndex = Math.min(this.pageIndex, lastPageOf(this.filteredLogs.length, this.pageSize));
      },
      error: (err) => {
        console.error('Failed to load audit logs', err);
        this.errorMessage = 'Could not load audit logs. Please ensure you have permission and backend is active.';
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    this.http.get<AuditStats>(`${this.apiUrl}/stats`, { headers }).subscribe({
      next: (data) => {
        if (data) {
          this.stats = data;
        }
      },
      error: () => {}
    });
  }

  get filteredLogs(): AuditLogItem[] {
    const term = this.search.trim().toLowerCase();
    return this.logs.filter((item) => {
      // 1. Category Filter
      if (this.selectedCategory !== 'ALL' && item.category !== this.selectedCategory) {
        return false;
      }

      // 2. Date Filter
      if (this.fromDate) {
        const fromT = new Date(this.fromDate + 'T00:00:00').getTime();
        const itemT = new Date(item.timestamp).getTime();
        if (itemT < fromT) return false;
      }
      if (this.toDate) {
        const toT = new Date(this.toDate + 'T23:59:59').getTime();
        const itemT = new Date(item.timestamp).getTime();
        if (itemT > toT) return false;
      }

      // 3. Search query
      if (term) {
        const match =
          (item.action || '').toLowerCase().includes(term) ||
          (item.actorName || '').toLowerCase().includes(term) ||
          (item.actorEmail || '').toLowerCase().includes(term) ||
          (item.entityTitle || '').toLowerCase().includes(term) ||
          (item.entityCode || '').toLowerCase().includes(term) ||
          (item.details || '').toLowerCase().includes(term) ||
          (item.remarks || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }

  get pagedLogs(): AuditLogItem[] {
    return pageSlice(this.filteredLogs, this.pageIndex, this.pageSize);
  }

  setCategory(category: string): void {
    this.selectedCategory = category;
    this.pageIndex = 0;
  }

  setDatePreset(preset: 'all' | 'today' | 'week' | 'month'): void {
    this.activePreset = preset;
    const now = new Date();
    if (preset === 'all') {
      this.fromDate = '';
      this.toDate = '';
    } else if (preset === 'today') {
      this.fromDate = this.toYmd(now);
      this.toDate = this.toYmd(now);
    } else if (preset === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      this.fromDate = this.toYmd(monday);
      this.toDate = this.toYmd(sunday);
    } else if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      this.fromDate = this.toYmd(first);
      this.toDate = this.toYmd(last);
    }
    this.pageIndex = 0;
  }

  private toYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clearFilters(): void {
    this.search = '';
    this.selectedCategory = 'ALL';
    this.fromDate = '';
    this.toDate = '';
    this.activePreset = 'all';
    this.pageIndex = 0;
  }

  get hasActiveFilters(): boolean {
    return this.selectedCategory !== 'ALL' || !!this.search || !!this.fromDate || !!this.toDate;
  }

  countByCategory(category: string): number {
    if (category === 'ALL') return this.logs.length;
    return this.logs.filter((i) => i.category === category).length;
  }

  categoryMeta(cat: string): { label: string; icon: string; css: string } {
    switch ((cat || '').toUpperCase()) {
      case 'STATUS_CHANGE':
        return { label: 'Status Update', icon: 'sync_alt', css: 'al-cat--status' };
      case 'TICKET_DELETION':
        return { label: 'Ticket Deletion', icon: 'delete_sweep', css: 'al-cat--delete' };
      case 'TIMESHEET':
        return { label: 'Timesheet', icon: 'schedule', css: 'al-cat--timesheet' };
      case 'SECURITY_RBAC':
        return { label: 'Security & Access', icon: 'admin_panel_settings', css: 'al-cat--rbac' };
      default:
        return { label: 'General Activity', icon: 'history', css: 'al-cat--general' };
    }
  }

  severityBadge(severity?: string): string {
    switch ((severity || '').toUpperCase()) {
      case 'SUCCESS':
        return 'ems-badge--success';
      case 'DANGER':
        return 'ems-badge--danger';
      case 'WARNING':
        return 'ems-badge--warning';
      default:
        return 'ems-badge--info';
    }
  }

  initials(name?: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  viewDetails(item: AuditLogItem): void {
    this.selectedLog = item;
  }

  closeDetails(): void {
    this.selectedLog = null;
  }

  exportCsv(): void {
    const list = this.filteredLogs;
    if (!list.length) return;

    const headers = ['Timestamp', 'Category', 'Action', 'Target Entity', 'Performed By', 'Role', 'Details', 'Remarks'];
    const rows = list.map((item) => [
      `"${new Date(item.timestamp).toLocaleString()}"`,
      `"${item.category || ''}"`,
      `"${(item.action || '').replace(/"/g, '""')}"`,
      `"${(item.entityCode ? item.entityCode + ' - ' : '') + (item.entityTitle || '').replace(/"/g, '""')}"`,
      `"${(item.actorName || item.actorEmail || 'Unknown').replace(/"/g, '""')}"`,
      `"${item.actorRole || ''}"`,
      `"${(item.details || '').replace(/"/g, '""')}"`,
      `"${(item.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
