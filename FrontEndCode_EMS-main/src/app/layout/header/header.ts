import { Component, OnInit } from '@angular/core';
import { MatToolbarModule } from "@angular/material/toolbar";
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from "@angular/material/divider";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { roleLabel } from '../../models/role';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    CommonModule,
    RouterModule
  ],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header implements OnInit {
  user: any;

  constructor(
    private http: HttpClient,
    private Router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    if (localStorage.getItem('email')) {
      this.loadUserProfile();
    }
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  get displayName(): string {
    return this.user?.username || localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  }

  get displayRole(): string {
    // EMPLOYEE reads as "Developer" in the identity chip.
    return roleLabel(this.user?.role || localStorage.getItem('role') || 'Member');
  }

  get userInitials(): string {
    return (this.displayName || 'U')
      .split(' ')
      .filter((part: string) => !!part)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('');
  }

  get avatarUrl(): string {
    return this.user?.registerImage
      ? `http://localhost:9001/attachments/${this.user.registerImage}`
      : '';
  }

  pageTitle(): string {
    const url = this.Router.url.split('?')[0];
    const titles: { [key: string]: string } = {
      '/dashboard': 'Admin Dashboard',
      '/developer-board': 'Developer Board',
      '/developer-completed': 'Developer Completed Tasks',
      '/on-hold-tasks': 'On Hold Tasks',
      '/tester-board': 'Tester Board',
      '/testing-lead-dashboard': 'Testing Team Lead Dashboard',
      '/my-tasks': 'My Tasks',
      '/tasks': 'Task Board',
      '/tasks/all': 'All Tasks',
      '/issues/new': 'Raise task / bug',
      '/my-submissions': 'My submissions',
      '/approvals': 'Testing review & approvals',
      '/triage': 'Developer task assignment',
      '/projects': 'Project Overview',
      '/projects/new': 'Create Project',
      '/my-projects': 'My Projects',
      '/people/accounts': 'Registered Employees',
      '/timesheets/new': 'Submit Timesheet',
      '/timesheets': 'Timesheets',
      '/profile': 'Update Profile',
      '/settings': 'Settings',
    };
    return titles[url] || 'Workspace';
  }

  loadUserProfile(): void {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('email');

    if (!username) {
      return;
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const url = `http://localhost:9001/api/UserProfile/userdetails?username=${encodeURIComponent(username)}`;

    this.http.get(url, { headers }).subscribe({
      next: (data: any) => {
        this.user = data;
        // keep the shell in sync so the sidebar shows the real name/role
        if (data?.username) { localStorage.setItem('name', data.username); }
        if (data?.role) { localStorage.setItem('role', data.role); }
      },
      error: (err: any) => {
        console.error('Failed to load profile:', err);
      }
    });
  }

  onLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('email');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    this.Router.navigate(['/login']);
  }
}
