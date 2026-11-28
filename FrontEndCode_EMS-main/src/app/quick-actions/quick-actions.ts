import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { isSuperAdminRole } from '../models/role';

/** One shortcut: where it goes and why this person would use it. */
interface QuickAction {
  icon: string;
  label: string;
  hint: string;
  link: string;
}

/**
 * The shortcuts each role actually has, in the order that role needs them.
 * Every route here is also listed for the same roles in `app.routes.ts`, so a
 * shortcut can never lead a person into a guard's refusal.
 *
 *   SUPER_ADMIN / ADMIN  the CEO runs the whole chain: hand work out, approve
 *                        it, read hours and accounts
 *   DEVELOPER_LEAD       receives approved work and owns the register
 *   TESTER_LEAD          raises, follows its own submissions and approves
 *   EMPLOYEE / TESTER    no card: their board header already carries the two
 *                        or three actions they own, so a list would repeat it
 */
const BY_ROLE: Record<string, QuickAction[]> = {
  SUPER_ADMIN: [
    { icon: 'view_quilt', label: 'Ticket Hub', hint: 'Unified review, assignment, completion & on-hold workspace', link: '/tasks/all' },
    { icon: 'task_alt', label: 'Kanban Board', hint: 'Everything the team has in flight', link: '/tasks' },
    { icon: 'table_view', label: 'Timesheet Reports', hint: 'Approve hours logged this week', link: '/timesheets' },
    { icon: 'groups', label: 'Employee Directory', hint: 'Add people, change roles, switch accounts off', link: '/people/accounts' },
    { icon: 'account_tree', label: 'Module & Screen Master', hint: 'Modules, submodules and screen vocabulary', link: '/masters' }
  ],
  PROJECT_MANAGER: [
    { icon: 'insights', label: 'Projects Overview', hint: 'Portfolio health and milestone tracking', link: '/projects' },
    { icon: 'account_tree', label: 'Teams & Hierarchy', hint: 'Structure project teams and allocations', link: '/hierarchy' },
    { icon: 'approval', label: 'Timesheet Approvals', hint: 'Review and approve/reject team timesheets', link: '/timesheets/approvals' },
    { icon: 'table_view', label: 'Timesheet Reports', hint: 'Project budget and time distribution', link: '/timesheets' },
    { icon: 'manage_history', label: 'Audit Logs', hint: 'Review transaction and deletion history', link: '/audit-logs' },
    { icon: 'folder_open', label: 'My Projects', hint: 'Work grouped by project', link: '/my-projects' }
  ],
  TEAM_LEAD: [
    { icon: 'assignment_ind', label: 'Work Allocation', hint: 'Hand approved work to developers', link: '/triage' },
    { icon: 'approval', label: 'QA Bug Triage', hint: 'Approve or send back what your team raises', link: '/approvals' },
    { icon: 'check_circle', label: 'Pending QA Release', hint: 'Review completed tickets and release for testing', link: '/developer-completed' },
    { icon: 'verified', label: 'QA Verification Sign-off', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'pause_circle', label: 'On-Hold Tickets', hint: 'Tickets held before testing release', link: '/on-hold-tasks' },
    { icon: 'task_alt', label: 'Kanban Board', hint: 'Everything the team has in flight', link: '/tasks' },
    { icon: 'account_tree', label: 'Project Teams & Hierarchy', hint: 'Structure team leads and member assignments', link: '/hierarchy' },
    { icon: 'approval', label: 'Timesheet Approvals', hint: 'Review and approve/reject team timesheets', link: '/timesheets/approvals' },
    { icon: 'folder_open', label: 'My Projects', hint: 'Work grouped by project', link: '/my-projects' },
    { icon: 'edit_calendar', label: 'Log Time', hint: 'Book time against a project', link: '/timesheets/new' }
  ],
  DEVELOPER_LEAD: [
    { icon: 'verified', label: 'QA Verification Sign-off', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'check_circle', label: 'Pending QA Release', hint: 'Review completed tickets and release for testing', link: '/developer-completed' },
    { icon: 'pause_circle', label: 'On-Hold Tickets', hint: 'Tickets held by Team Leader before testing release', link: '/on-hold-tasks' },
    { icon: 'assignment_ind', label: 'Work Allocation', hint: 'Hand approved work to developers', link: '/triage' },
    { icon: 'task_alt', label: 'Kanban Board', hint: 'Everything the team has in flight', link: '/tasks' },
    { icon: 'list_alt', label: 'All Tickets Registry', hint: 'The register: edit, hand over or remove work', link: '/tasks/all' },
    { icon: 'folder_open', label: 'My Projects', hint: 'Work grouped by project', link: '/my-projects' },
    { icon: 'edit_calendar', label: 'Log Time', hint: 'Book time against a project', link: '/timesheets/new' }
  ],
  TESTER_LEAD: [
    { icon: 'verified', label: 'QA Verification Sign-off', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'rule', label: 'QA Lead Dashboard', hint: 'Assign released work to testers for verification', link: '/testing-lead-dashboard' },
    { icon: 'approval', label: 'QA Bug Triage', hint: 'Approve or send back what your team raises', link: '/approvals' },
    { icon: 'add', label: 'Create Issue', hint: 'Report a defect or a new piece of work', link: '/issues/new' },
    { icon: 'inbox', label: 'My Reported Issues', hint: 'Follow what you raised through the chain', link: '/my-submissions' },
    { icon: 'list_alt', label: 'All Tickets Registry', hint: 'The register: edit, hand over or remove work', link: '/tasks/all' },
    { icon: 'edit_calendar', label: 'Log Time', hint: 'Book time against a project', link: '/timesheets/new' }
  ]
};

/**
 * "Quick actions" — the same card on the CEO dashboard and on both boards, with
 * the list picked from the signed-in role. Nothing is hidden behind a
 * permission the person does not hold: the role is the whole filter.
 */
@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './quick-actions.html',
  styleUrl: './quick-actions.css'
})
export class QuickActions {
  /**
   * Lay the items out as tiles across the row. Used where the card stands on
   * its own, under the stat cards of a board rather than inside a column.
   */
  @Input() wide = false;

  get actions(): QuickAction[] {
    const rawRole = (localStorage.getItem('role') || '').trim().toUpperCase();
    let role = rawRole;
    if (role === 'ADMIN') role = 'SUPER_ADMIN';
    if (role === 'TEAM_LEADER') role = 'TEAM_LEAD';

    // The CEO's old ADMIN code reads the same list.
    if (isSuperAdminRole(role)) {
      return BY_ROLE['SUPER_ADMIN'];
    }
    return BY_ROLE[role] || [];
  }
}
