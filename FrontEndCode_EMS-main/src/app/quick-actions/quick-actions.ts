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
    { icon: 'verified', label: 'Tested Completed Review', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'assignment_ind', label: 'Java Team Assignment', hint: 'Hand approved work to a Java developer', link: '/triage' },
    { icon: 'check_circle', label: 'Completed work (Java Dev)', hint: 'Review completed tasks and release for testing', link: '/developer-completed' },
    { icon: 'pause_circle', label: 'On Hold Tasks', hint: 'Tasks held by Team Leader before testing release', link: '/on-hold-tasks' },
    { icon: 'rule', label: 'Testing Lead Dashboard', hint: 'Assign released work to testers for verification', link: '/testing-lead-dashboard' },
    { icon: 'approval', label: 'Testing review', hint: 'Approve or send back what the team raises', link: '/approvals' },
    { icon: 'table_view', label: 'Review timesheets', hint: 'Approve hours logged this week', link: '/timesheets' },
    { icon: 'groups', label: 'Registered employees', hint: 'Add people, change roles, switch accounts off', link: '/people/accounts' },
    { icon: 'list_alt', label: 'All tasks', hint: 'The register: edit, hand over or remove work', link: '/tasks/all' }
  ],
  DEVELOPER_LEAD: [
    { icon: 'verified', label: 'Tested Completed Review', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'check_circle', label: 'Completed work (Java Dev)', hint: 'Review completed tasks and release for testing', link: '/developer-completed' },
    { icon: 'pause_circle', label: 'On Hold Tasks', hint: 'Tasks held by Team Leader before testing release', link: '/on-hold-tasks' },
    { icon: 'assignment_ind', label: 'Java Team Assignment', hint: 'Hand approved work to a Java developer', link: '/triage' },
    { icon: 'task_alt', label: 'Task board', hint: 'Everything the team has in flight', link: '/tasks' },
    { icon: 'list_alt', label: 'All tasks', hint: 'The register: edit, hand over or remove work', link: '/tasks/all' },
    { icon: 'folder_open', label: 'My projects', hint: 'Work grouped by project', link: '/my-projects' },
    { icon: 'edit_calendar', label: 'Log hours', hint: 'Book time against a project', link: '/timesheets/new' }
  ],
  TESTER_LEAD: [
    { icon: 'verified', label: 'Tested Completed Review', hint: 'Review tasks and bugs verified by testing team', link: '/tested-completed' },
    { icon: 'rule', label: 'Testing Lead Dashboard', hint: 'Assign released work to testers for verification', link: '/testing-lead-dashboard' },
    { icon: 'approval', label: 'Testing review', hint: 'Approve or send back what your team raises', link: '/approvals' },
    { icon: 'add', label: 'Raise task / bug', hint: 'Report a defect or a new piece of work', link: '/issues/new' },
    { icon: 'inbox', label: 'My submissions', hint: 'Follow what you raised through the chain', link: '/my-submissions' },
    { icon: 'list_alt', label: 'All tasks', hint: 'The register: edit, hand over or remove work', link: '/tasks/all' },
    { icon: 'edit_calendar', label: 'Log hours', hint: 'Book time against a project', link: '/timesheets/new' }
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
    const role = (localStorage.getItem('role') || '').trim().toUpperCase();
    // The CEO's old ADMIN code reads the same list.
    if (isSuperAdminRole(role)) {
      return BY_ROLE['SUPER_ADMIN'];
    }
    return BY_ROLE[role] || [];
  }
}
