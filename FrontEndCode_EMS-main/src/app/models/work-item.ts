/**
 * The row shape the approval chain and the boards share.
 *
 * <p>One document walks the whole path - raised by a tester, reviewed by the
 * testing team leader, assigned by the developer team leader, worked to
 * completion - so the code on it never changes. Tasks and bugs are numbered
 * apart - "TASK-00042" and "BUG-00007" - so the kind is readable from the code
 * alone, and everything that shows a work item shows that code, which is what
 * lets two people talk about the same item without opening the same screen.</p>
 */

export type ApprovalStateName = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';

export interface WorkItem {
  id: number;
  /** "TASK-00042" / "BUG-00007": assigned once, never renumbered. */
  taskCode?: string;
  /** TASK or BUG. */
  kind?: string;
  approvalState?: ApprovalStateName | string;
  taskTitle: string;
  project?: string;
  description?: string;
  priority?: string;
  module?: string;
  subModule?: string;
  screen?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  status?: string;
  attachmentPath?: string | null;
  /** Who raised it (intake only). */
  createdById?: number | null;
  createdBy?: string;
  createdByName?: string;
  /** The day it was raised. */
  createdAt?: string | Date;
  /** The testing team leader's decision. */
  reviewedBy?: string;
  reviewedAt?: string | Date;
  reviewNote?: string;
  /** Set once the developer team leader has handed it out. */
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedBy?: string | null;
  assignedAt?: string | Date;
  reopenCount?: number | null;
  lastReopenNote?: string | null;
  /** Developer Team Leader release for testing */
  releasedForTesting?: boolean;
  releasedBy?: string;
  releasedByName?: string;
  releasedAt?: string | Date;
  releaseNote?: string;
  /** Testing Team Leader assignment to tester */
  assignedTesterId?: number | null;
  assignedTesterName?: string | null;
  assignedTesterEmail?: string | null;
  assignedTesterAt?: string | Date | null;
  assignedTesterBy?: string | null;
  testingInstructions?: string | null;
  testingStatus?: 'AWAITING_TESTER' | 'IN_TESTING' | 'VERIFIED' | 'FAILED' | string;
  /** Tester verification */
  verifiedAt?: string | Date | null;
  verifiedBy?: string | null;
  verificationNote?: string | null;
  /** Bug reproduction flow and steps */
  reproductionSteps?: string;
  reproductionStepsImage?: string;
  reproductionFlow?: string;
  /** Team Leader review & hold before QA release */
  leadReviewStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'ON_HOLD' | string;
  leadReviewedBy?: string;
  leadReviewedByName?: string;
  leadReviewedAt?: string | Date;
  holdReason?: string;
  heldAt?: string | Date;
  heldBy?: string;
  heldByName?: string;
}

/** A tester and their current verification load. */
export interface TesterLoad {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  openTestingTasks: number;
}

export interface TestingQueue {
  items: WorkItem[];
  testers: TesterLoad[];
  awaiting: number;
  assigned: number;
  verified: number;
  totalReleased: number;
}

export interface CompletedWorkResponse {
  items: WorkItem[];
  totalCompleted: number;
  awaitingRelease: number;
  awaitingReview?: number;
  approvedForRelease?: number;
  onHoldCount?: number;
  releasedForTesting: number;
  inTesting: number;
  verified: number;
}

/** A developer and the work already in their hands, for the assignment picker. */
export interface DeveloperLoad {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  openTasks: number;
}

export interface DevQueue {
  items: WorkItem[];
  developers: DeveloperLoad[];
  awaiting: number;
  assigned: number;
}

/**
 * The identifier a row of this kind and id carries - the mirror of the server's
 * `AssignTask.codeFor`, so a row that arrived without a code still reads right.
 */
export function codeFor(kind: string | null | undefined, id: number | null | undefined): string {
  if (typeof id !== 'number' || isNaN(id)) {
    return '';
  }
  return `${isBug(kind) ? 'BUG' : 'TASK'}-${String(id).padStart(5, '0')}`;
}

/** The code on screen, with a fallback for a row that arrived without one. */
export function taskCodeOf(
  row: { taskCode?: string; kind?: string; id?: number } | null | undefined
): string {
  if (!row) {
    return '';
  }
  const stored = (row.taskCode || '').trim();
  return stored || codeFor(row.kind, row.id);
}

export function isBug(kind?: string | null): boolean {
  return (kind || '').trim().toUpperCase() === 'BUG';
}

export function kindLabel(kind?: string | null): string {
  return isBug(kind) ? 'Bug' : 'Task';
}

export function kindBadge(kind?: string | null): string {
  return isBug(kind) ? 'ems-badge--danger' : 'ems-badge--info';
}

/** `PENDING` -> "Waiting for review". */
export function approvalLabel(state?: string | null): string {
  switch ((state || '').trim().toUpperCase()) {
    case 'PENDING':
      return 'Waiting for review';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Sent back';
    case 'NOT_REQUIRED':
      return 'Assigned directly';
    default:
      return 'Unknown';
  }
}

export function approvalBadge(state?: string | null): string {
  switch ((state || '').trim().toUpperCase()) {
    case 'PENDING':
      return 'ems-badge--warning';
    case 'APPROVED':
      return 'ems-badge--success';
    case 'REJECTED':
      return 'ems-badge--danger';
    default:
      return 'ems-badge--neutral';
  }
}

/** True while the item is still inside the testing team. */
export function isInIntake(state?: string | null): boolean {
  const value = (state || '').trim().toUpperCase();
  return value === 'PENDING' || value === 'REJECTED';
}
