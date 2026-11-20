// src/app/models/employee.model.ts

// The Employee interface was only used by the retired Employee Directory; the
// account screens describe their own row shape from the API response.
export interface TaskModel {
  id: number;
  /** "TASK-00042" / "BUG-00007": stamped once at creation and kept for the whole lifecycle. */
  taskCode?: string;
  /** TASK or BUG, as raised by the testing team. */
  kind?: string;
  project: string;
  taskTitle: string;
  assignedTo: string;
  assignedToName?: string;
  status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | string;
  /** Who raised the item, kept so every screen can name the reporter. */
  createdByName?: string;
  createdAt?: string;
  approvalState?: string;
  startDate: string;      
  endDate: string;
  priority: string;
  module: string;
  subModule: string;
  screen: string;
  description: string;
  attachmentPath: string;
   DeleteAttchment: string;
  /** Rework trail stamped by the backend when the item leaves Done. */
  reopenCount?: number | null;
  lastReopenNote?: string | null;
  /** Bug reproduction flow & steps */
  reproductionSteps?: string | null;
  reproductionStepsImage?: string | null;
  reproductionFlow?: string | null;
  // QA Testing assignment fields
  assignedTesterId?: number | null;
  assignedTesterName?: string | null;
  assignedTesterEmail?: string | null;
  assignedTesterAt?: string | Date | null;
  assignedTesterBy?: string | null;
  testingInstructions?: string | null;
  testingStatus?: 'AWAITING_TESTER' | 'IN_TESTING' | 'VERIFIED' | 'FAILED' | string | null;
  releasedForTesting?: boolean | null;
  releasedBy?: string | null;
  releasedByName?: string | null;
  releasedAt?: string | Date | null;
  releaseNote?: string | null;
  verifiedAt?: string | Date | null;
  verifiedBy?: string | null;
  verificationNote?: string | null;
}

export interface TimesheetEntry {
  id?: number;
  employeeName: string;
  date: string;
  hours: number;
  project: string;
  status: string;
}

