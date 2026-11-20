import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ReferenceService } from '../services/reference.service';
import { TaskItem } from '../services/workspace.service';
import { taskCodeOf } from '../models/work-item';
import { TaskStatus } from '../task-status/task-status';

/** The project row hands the popup its name and the work behind it. */
export interface ProjectTasksData {
  project: string;
  tasks: TaskItem[];
  /** How a DONE row is spoken about: "done" on the developer board, "verified" on the tester board. */
  doneLabel?: string;
}

/**
 * What one project on a board actually holds.
 *
 * The Projects card only has room for a name and a "2/3 done" pill, so a click
 * opens this: every task in full - what it asks for, who raised it and when,
 * where in the product it lives, and the read-only status control the board
 * already uses.
 */
@Component({
  selector: 'app-project-tasks-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, TaskStatus],
  templateUrl: './project-tasks-dialog.html',
  styleUrl: './project-tasks-dialog.css'
})
export class ProjectTasksDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ProjectTasksData,
    private reference: ReferenceService
  ) {}

  get tasks(): TaskItem[] {
    return this.data?.tasks || [];
  }

  get doneCount(): number {
    return this.tasks.filter((task) => task.status === 'DONE').length;
  }

  get subtitle(): string {
    const total = this.tasks.length;
    return `${total} task${total === 1 ? '' : 's'} on this board · ${this.doneCount} ${this.data?.doneLabel || 'done'}`;
  }

  /** "TASK-00042" or "BUG-00007": the same code every other screen shows. */
  code(task: TaskItem): string {
    return taskCodeOf(task);
  }

  /** "Bug" or "Task", the same two words the register uses. */
  kindLabel(task: TaskItem): string {
    return (task.kind || 'TASK').toUpperCase() === 'BUG' ? 'Bug' : 'Task';
  }

  /**
   * The intake trail. Attachments written before the workflow existed carry no
   * author, and the popup says so instead of leaving the row blank.
   */
  raisedBy(task: TaskItem): string {
    return (task.raisedBy || '').trim() || 'not recorded';
  }

  /** Module · sub module · screen, whichever of the three were picked. */
  chain(task: TaskItem): string {
    return [task.module, task.subModule, task.screen].filter(Boolean).join(' · ');
  }

  timeline(task: TaskItem): string {
    const start = task.startDate ? new Date(task.startDate) : null;
    const due = task.endDate ? new Date(task.endDate) : null;
    if (!start && !due) {
      return 'No dates set';
    }
    const day = (value: Date) =>
      value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    if (start && due) {
      return `${day(start)} → ${day(due)}`;
    }
    return day((start || due) as Date);
  }

  priorityLabel(task: TaskItem): string {
    return this.reference.label('PRIORITY', task.priority) || task.priority || '—';
  }

  priorityBadge(task: TaskItem): string {
    return this.reference.badge('PRIORITY', task.priority);
  }

  attachmentUrl(task: TaskItem): string {
    return task.attachmentPath ? `http://localhost:9001/attachments/${task.attachmentPath}` : '';
  }
}
