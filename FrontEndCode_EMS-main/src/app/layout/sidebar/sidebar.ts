import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { filter, map, startWith } from 'rxjs';
import { RoleGuard } from '../../role-guard';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  /** Extra right inside the role: a plain tester needs the admin's provision
   *  to manage tasks. */
  access?: 'taskManager';
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar {
  role = (localStorage.getItem('role') || '').toUpperCase();
  name = localStorage.getItem('name') || localStorage.getItem('email') || 'User';

  private router = inject(Router);

  /** The address on screen, kept in step with every navigation. */
  private url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  groups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        { label: 'Admin Dashboard', icon: 'space_dashboard', route: '/dashboard', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Java Developer Board', icon: 'code', route: '/developer-board', roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'EMPLOYEE'] },
        { label: 'Tester Board', icon: 'bug_report', route: '/tester-board', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'TESTER'] },
        { label: 'Testing Lead Dashboard', icon: 'rule', route: '/testing-lead-dashboard', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD'] },
      ],
    },
    {
      title: 'Work',
      items: [
        // The approval chain, top to bottom: a tester raises, their team leader
        // decides, and the developer team leader hands the approved work out.
        // Each role sees only the step it performs, which is what keeps a
        // tester's report from reaching a developer unreviewed. Raising belongs
        // to the testing team alone - the CEO reads both decisions but files no
        // work - and the developer side only receives, so neither raise row is
        // offered to a developer or to the CEO.
        { label: 'Raise task / bug', icon: 'add_circle', route: '/issues/new', roles: ['TESTER_LEAD', 'TESTER'] },
        { label: 'My submissions', icon: 'fact_check', route: '/my-submissions', roles: ['TESTER_LEAD', 'TESTER'] },
        // Screen 1 - what the testers raised, waiting for a decision.
        { label: 'Testing review', icon: 'approval', route: '/approvals', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD'] },
        // Screen 2 - approved work waiting for an owner.
        { label: 'Java Team Assignment', icon: 'assignment_ind', route: '/triage', roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD'] },
        { label: 'Developer Completed Tasks', icon: 'inventory_2', route: '/developer-completed', roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD'] },
        { label: 'On Hold Tasks', icon: 'pause_circle_outline', route: '/on-hold-tasks', roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'EMPLOYEE'] },
        // Tested Completed Review for both Testing Team Leader and Developer Team Leader
        { label: 'Tested Completed Review', icon: 'verified', route: '/tested-completed', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER_LEAD', 'DEVELOPER_LEAD'] },
        // Personal tasks and personal completed tasks
        { label: 'My Tasks', icon: 'task_alt', route: '/my-tasks', roles: ['DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] },
        { label: 'My Completed Tasks', icon: 'check_circle', route: '/developer-completed', roles: ['EMPLOYEE'] },
        { label: 'My Completed Tasks', icon: 'fact_check', route: '/tester-completed', roles: ['TESTER', 'TESTER_LEAD'] },
        { label: 'Task Board', icon: 'view_kanban', route: '/tasks', roles: ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER_LEAD', 'TESTER_LEAD'] },
        { label: 'All Tasks', icon: 'list_alt', route: '/tasks/all', roles: ['SUPER_ADMIN', 'ADMIN', 'TESTER', 'TESTER_LEAD', 'DEVELOPER_LEAD'], access: 'taskManager' },
        // The vocabulary the task forms pick from (module / sub module / screen).
        // Curating it is administrative work, so only the CEO changes it; every
        // other role still reads it from the task forms.
        { label: 'Master data', icon: 'account_tree', route: '/masters', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Deleted tasks', icon: 'delete_sweep', route: '/tasks/deleted', roles: ['SUPER_ADMIN', 'ADMIN'] },
      ],
    },
    {
      title: 'Delivery',
      items: [
        { label: 'Project Overview', icon: 'insights', route: '/projects', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'Create Project', icon: 'create_new_folder', route: '/projects/new', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { label: 'My Projects', icon: 'folder_open', route: '/my-projects' },
        { label: 'Registered Employees', icon: 'badge', route: '/people/accounts', roles: ['SUPER_ADMIN', 'ADMIN'] },
      ],
    },
    {
      title: 'Time',
      items: [
        // Time is logged by the people who deliver, team leaders included; the
        // CEO reviews and approves it.
        { label: 'Submit Timesheet', icon: 'edit_calendar', route: '/timesheets/new', roles: ['DEVELOPER_LEAD', 'EMPLOYEE', 'TESTER_LEAD', 'TESTER'] },
        { label: 'View Timesheets', icon: 'table_view', route: '/timesheets', roles: ['SUPER_ADMIN', 'ADMIN'] },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Update Profile', icon: 'manage_accounts', route: '/profile' },
        { label: 'Settings', icon: 'tune', route: '/settings' },
      ],
    },
  ];

  get initials(): string {
    return (this.name || 'U')
      .split(' ')
      .filter((part) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  isVisible(item: NavItem): boolean {
    if (item.roles && item.roles.length > 0 && (this.role === '' || !item.roles.includes(this.role))) {
      return false;
    }
    if (item.access === 'taskManager') {
      return RoleGuard.managesTasks(this.role);
    }
    return true;
  }

  /**
   * The single entry that owns the current screen.
   *
   * <p>Routes nest - /tasks, /tasks/all, /tasks/deleted - so a plain "starts
   * with" test lights several rows at once. The longest match wins, which
   * leaves exactly one entry selected whatever the depth.</p>
   */
  private activeRoute = computed(() => {
    const path = (this.url() || '').split(/[?#]/)[0];
    let best = '';
    for (const group of this.groups) {
      for (const item of group.items) {
        if (!this.isVisible(item)) {
          continue;
        }
        const route = item.route;
        const matches = path === route || path.startsWith(route + '/');
        if (matches && route.length > best.length) {
          best = route;
        }
      }
    }
    return best;
  });

  isActive(item: NavItem): boolean {
    return this.activeRoute() === item.route;
  }

  groupHasItems(group: NavGroup): boolean {
    return group.items.some((item) => this.isVisible(item));
  }
}
