import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface TicketCommentItem {
  id: string;
  ticketCode: string;
  ticketId?: number;
  authorEmail: string;
  authorName: string;
  authorRole: string;
  content: string;
  resolutionReason?: string;
  createdAt: string;
}

export interface SlaStatus {
  state: 'RESOLVED' | 'BREACHED' | 'DUE_SOON' | 'ON_TRACK' | 'UNSCHEDULED';
  label: string;
  badgeClass: string;
  daysRemaining?: number;
  daysOverdue?: number;
}

export const RESOLUTION_REASONS = [
  'Fixed / Implemented',
  'Cannot Reproduce',
  'Duplicate',
  'Won\'t Fix / As Designed',
  'Workaround Provided'
];

@Injectable({ providedIn: 'root' })
export class TicketService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:9001/api/tickets';

  private headers(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
  }

  getComments(ticketCode: string): Observable<TicketCommentItem[]> {
    if (!ticketCode) return of([]);
    return this.http
      .get<TicketCommentItem[]>(`${this.apiUrl}/${encodeURIComponent(ticketCode)}/comments`, {
        headers: this.headers()
      })
      .pipe(catchError(() => of([])));
  }

  addComment(ticketCode: string, content: string, ticketId?: number): Observable<TicketCommentItem> {
    return this.http.post<TicketCommentItem>(
      `${this.apiUrl}/${encodeURIComponent(ticketCode)}/comments`,
      { content, ticketId },
      { headers: this.headers() }
    );
  }

  recordResolution(ticketCode: string, resolutionReason: string, note?: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/${encodeURIComponent(ticketCode)}/resolution`,
      { resolutionReason, note },
      { headers: this.headers() }
    );
  }

  deleteComment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/comments/${id}`, { headers: this.headers() });
  }

  /** Computes SLA and delivery health for any task/bug item */
  computeSlaStatus(item: any): SlaStatus {
    const status = (item?.status || '').toUpperCase();
    if (status === 'DONE' || status === 'VERIFIED') {
      return {
        state: 'RESOLVED',
        label: 'Resolved',
        badgeClass: 'ems-sla--resolved'
      };
    }

    const endDate = item?.endDate || item?.dueDate;
    if (!endDate) {
      return {
        state: 'UNSCHEDULED',
        label: 'No Due Date',
        badgeClass: 'ems-sla--neutral'
      };
    }

    const dueTime = new Date(endDate).getTime();
    const now = Date.now();
    const diffMs = dueTime - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      const daysOverdue = Math.max(1, Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24)));
      return {
        state: 'BREACHED',
        label: `SLA Breached (${daysOverdue}d overdue)`,
        badgeClass: 'ems-sla--breached',
        daysOverdue
      };
    }

    if (diffHours <= 24) {
      return {
        state: 'DUE_SOON',
        label: 'Due Soon (<24h)',
        badgeClass: 'ems-sla--duesoon',
        daysRemaining: 1
      };
    }

    const daysRemaining = Math.ceil(diffHours / 24);
    return {
      state: 'ON_TRACK',
      label: `On Track (${daysRemaining}d left)`,
      badgeClass: 'ems-sla--ontrack',
      daysRemaining
    };
  }

  /** Severity & Priority matrix code (P1 - Blocker, P2 - Major, P3 - Normal, P4 - Minor) */
  priorityPill(priority: string): { code: string; label: string; badgeClass: string } {
    const p = (priority || '').toUpperCase();
    switch (p) {
      case 'HIGH':
      case 'CRITICAL':
      case 'BLOCKER':
        return { code: 'P1', label: 'P1 · Blocker', badgeClass: 'ems-pri--p1' };
      case 'MEDIUM':
      case 'MAJOR':
        return { code: 'P2', label: 'P2 · Major', badgeClass: 'ems-pri--p2' };
      case 'LOW':
      case 'NORMAL':
        return { code: 'P3', label: 'P3 · Normal', badgeClass: 'ems-pri--p3' };
      default:
        return { code: 'P4', label: 'P4 · Minor', badgeClass: 'ems-pri--p4' };
    }
  }
}
