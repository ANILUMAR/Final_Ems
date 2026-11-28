import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TicketService, TicketCommentItem, SlaStatus, RESOLUTION_REASONS } from '../services/ticket.service';
import { taskCodeOf } from '../models/work-item';
import { TaskStatus } from '../task-status/task-status';
import { isManagerRole, isSuperAdminRole } from '../models/role';

@Component({
  selector: 'app-ticket-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TaskStatus
  ],
  templateUrl: './ticket-detail-dialog.html',
  styleUrls: ['./ticket-detail-dialog.css']
})
export class TicketDetailDialog implements OnInit {
  private ticketService = inject(TicketService);
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  ticket: any;
  ticketCode = '';
  isBug = false;
  isProd = false;

  activeTab: 'details' | 'discussion' | 'history' | 'resolution' = 'discussion';

  comments: TicketCommentItem[] = [];
  loadingComments = true;
  newCommentText = '';
  submittingComment = false;

  history: any[] = [];
  loadingHistory = false;

  resolutionReasons = RESOLUTION_REASONS;
  selectedResolution = 'Fixed / Implemented';
  resolutionNote = '';
  savingResolution = false;

  sla: SlaStatus = { state: 'ON_TRACK', label: 'On Track', badgeClass: 'ems-sla--ontrack' };
  priorityMeta: { code: string; label: string; badgeClass: string } = { code: 'P3', label: 'P3 · Normal', badgeClass: 'ems-pri--p3' };

  currentUserEmail = (localStorage.getItem('email') || '').toLowerCase();
  currentUserName = localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  currentUserRole = (localStorage.getItem('role') || '').toUpperCase();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { item: any },
    private dialogRef: MatDialogRef<TicketDetailDialog>
  ) {
    this.ticket = data?.item || {};
  }

  ngOnInit(): void {
    this.ticketCode = this.ticket.taskCode || taskCodeOf(this.ticket) || (this.ticket.id ? `TASK-${String(this.ticket.id).padStart(3, '0')}` : 'TICKET');
    const k = (this.ticket.kind || '').toUpperCase();
    this.isProd = k === 'PRODUCTION_ISSUE' || k === 'PROD_ISSUE' || k === 'PROD' || this.ticketCode.startsWith('PROD');
    this.isBug = !this.isProd && (k === 'BUG' || this.ticketCode.startsWith('BUG'));

    this.sla = this.ticketService.computeSlaStatus(this.ticket);
    this.priorityMeta = this.ticketService.priorityPill(this.ticket.priority);

    this.loadComments();
    this.loadHistory();
  }

  get isSuperAdmin(): boolean {
    return isSuperAdminRole(this.currentUserRole);
  }

  get isManager(): boolean {
    return isManagerRole(this.currentUserRole);
  }

  get canEditStatus(): boolean {
    if (this.isSuperAdmin || this.isManager) {
      return true;
    }
    const dev = (this.ticket.assignedToName || this.ticket.assignedTo || '').trim().toLowerCase();
    const isDev = !!dev && (
      (!!this.currentUserEmail && (dev === this.currentUserEmail || dev.includes(this.currentUserEmail))) ||
      (!!this.currentUserName && (dev === this.currentUserName.toLowerCase() || dev.includes(this.currentUserName.toLowerCase())))
    );
    const tester = (this.ticket.assignedTesterEmail || this.ticket.assignedTesterName || '').trim().toLowerCase();
    const isTester = !!tester && (
      (!!this.currentUserEmail && (tester === this.currentUserEmail || tester.includes(this.currentUserEmail))) ||
      (!!this.currentUserName && (tester === this.currentUserName.toLowerCase() || tester.includes(this.currentUserName.toLowerCase())))
    );
    return isDev || isTester;
  }

  get statusTooltip(): string {
    if (this.canEditStatus) {
      return 'Click to change status';
    }
    const owner = this.ticket.assignedToName || this.ticket.assignedTo || this.ticket.assignedTesterName || 'another user';
    return `Assigned to ${owner}. Only the assigned owner can change status.`;
  }

  loadComments(): void {
    this.loadingComments = true;
    this.ticketService.getComments(this.ticketCode).subscribe({
      next: (list) => {
        this.comments = list || [];
        this.loadingComments = false;
      },
      error: () => {
        this.loadingComments = false;
      }
    });
  }

  postComment(): void {
    const text = this.newCommentText.trim();
    if (!text || this.submittingComment) return;

    this.submittingComment = true;
    this.ticketService.addComment(this.ticketCode, text, this.ticket.id).subscribe({
      next: (comment) => {
        this.comments.push(comment);
        this.newCommentText = '';
        this.submittingComment = false;
        this.snackBar.open('Comment added to ticket.', 'Close', { duration: 2500 });
      },
      error: () => {
        this.submittingComment = false;
        this.snackBar.open('Could not post comment.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  deleteComment(comment: TicketCommentItem): void {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    this.ticketService.deleteComment(comment.id).subscribe({
      next: () => {
        this.comments = this.comments.filter((c) => c.id !== comment.id);
        this.snackBar.open('Comment removed.', 'Close', { duration: 2500 });
      },
      error: () => {
        this.snackBar.open('Could not delete comment.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  loadHistory(): void {
    if (!this.ticket.id) return;
    this.loadingHistory = true;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token || ''}`);
    const url = `http://localhost:9001/api/assigntasks/history/${this.ticket.id}`;

    this.http.get<any[]>(url, { headers }).subscribe({
      next: (hist) => {
        this.history = hist || [];
        this.loadingHistory = false;
      },
      error: () => {
        this.loadingHistory = false;
      }
    });
  }

  saveResolution(): void {
    this.savingResolution = true;
    this.ticketService.recordResolution(this.ticketCode, this.selectedResolution, this.resolutionNote).subscribe({
      next: (res) => {
        this.savingResolution = false;
        this.ticket.resolutionReason = this.selectedResolution;
        this.loadComments();
        this.snackBar.open(`Ticket resolved as [${this.selectedResolution}].`, 'Close', { duration: 3000 });
      },
      error: () => {
        this.savingResolution = false;
        this.snackBar.open('Could not save resolution.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  onStatusChanged(newStatus: string): void {
    this.ticket.status = newStatus;
    this.sla = this.ticketService.computeSlaStatus(this.ticket);
    this.loadHistory();
  }

  openFlowDesigner(): void {
    // Open flow designer dynamically if available
    try {
      import('../flow-designer/flow-designer').then(({ FlowDesigner }) => {
        this.dialog.open(FlowDesigner, {
          data: {
            existingFlowJson: this.ticket.reproductionFlow,
            title: `Reproduction Flow — ${this.ticketCode}`
          },
          width: '92vw',
          maxWidth: '1200px',
          maxHeight: '92vh'
        });
      });
    } catch (e) {
      console.warn('Flow designer modal error:', e);
    }
  }

  attachmentUrl(filename: string): string {
    if (!filename) return '';
    if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
    const clean = filename.replace(/\\/g, '/').split('/').pop() || filename;
    return `http://localhost:9001/uploads/${clean}`;
  }

  openAttachment(filename: string): void {
    window.open(this.attachmentUrl(filename), '_blank');
  }

  printTicket(): void {
    window.print();
  }

  initials(name: string): string {
    return (name || '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('');
  }

  close(): void {
    this.dialogRef.close();
  }
}
