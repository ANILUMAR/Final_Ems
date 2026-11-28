import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map, startWith } from 'rxjs';
import { RolePermissionService } from '../../services/role-permission.service';
import { NavigationPreferenceService } from '../../services/navigation-preference.service';
import { LocalAvatarService } from '../../services/local-avatar.service';
import {
  NAV_GROUPS,
  NavGroup,
  NavItem,
  isNavItemVisible,
  groupHasVisibleItems
} from '../../models/navigation';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar {
  private router = inject(Router);
  private rolePermissionService = inject(RolePermissionService);
  readonly navPref = inject(NavigationPreferenceService);
  private avatarService = inject(LocalAvatarService);

  get avatarUrl(): string {
    return this.avatarService.getDefaultAvatarForRole(this.role);
  }

  onImgError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.style.display = 'none';
      const fallback = img.parentElement?.querySelector('.ems-sidebar__avatar--fallback') as HTMLElement;
      if (fallback) {
        fallback.style.display = 'inline-flex';
      }
    }
  }

  /** Shared navigation group catalog */
  groups: NavGroup[] = NAV_GROUPS;

  /** Set of expanded module titles. Initially empty so only main module headings display. */
  expandedGroups = new Set<string>();

  get isIconOnly(): boolean {
    return this.navPref.layoutStyle() === 'icon-only';
  }

  get tooltipPosition(): 'left' | 'right' {
    return this.navPref.sidebarPosition() === 'right' ? 'left' : 'right';
  }

  get role(): string {
    return this.rolePermissionService.normalizeRole(localStorage.getItem('role'));
  }

  get name(): string {
    return localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  }

  /** The address on screen, kept in step with every navigation. */
  private url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  isGroupExpanded(group: NavGroup): boolean {
    if (this.navPref.layoutStyle() === 'expanded' || this.navPref.navDisplayMode() === 'always-expanded') {
      return true;
    }
    return this.expandedGroups.has(group.title);
  }

  toggleGroup(group: NavGroup): void {
    if (this.navPref.layoutStyle() === 'expanded' || this.navPref.navDisplayMode() === 'always-expanded') {
      return;
    }
    const isCurrentlyExpanded = this.expandedGroups.has(group.title);
    if (this.navPref.navDisplayMode() === 'accordion') {
      this.expandedGroups.clear();
      if (!isCurrentlyExpanded) {
        this.expandedGroups.add(group.title);
      }
    } else {
      if (isCurrentlyExpanded) {
        this.expandedGroups.delete(group.title);
      } else {
        this.expandedGroups.add(group.title);
      }
    }
  }

  get allExpanded(): boolean {
    const visibleGroups = this.groups.filter((g) => this.groupHasItems(g));
    return visibleGroups.length > 0 && visibleGroups.every((g) => this.expandedGroups.has(g.title));
  }

  toggleAllGroups(): void {
    if (this.allExpanded) {
      this.expandedGroups.clear();
    } else {
      this.groups.forEach((g) => {
        if (this.groupHasItems(g)) {
          this.expandedGroups.add(g.title);
        }
      });
    }
  }

  groupHasActiveRoute(group: NavGroup): boolean {
    return group.items.some((item) => this.isVisible(item) && this.isActive(item));
  }

  visibleCount(group: NavGroup): number {
    return group.items.filter((item) => this.isVisible(item)).length;
  }

  get initials(): string {
    return (this.name || 'U')
      .split(' ')
      .filter((part) => !!part)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  isVisible(item: NavItem): boolean {
    // Dynamic signal dependency: triggers re-render when permissions change
    this.rolePermissionService.currentRolePermissions();
    return isNavItemVisible(item, this.role, this.rolePermissionService);
  }

  groupHasItems(group: NavGroup): boolean {
    return groupHasVisibleItems(group, this.role, this.rolePermissionService);
  }

  /**
   * The single entry that owns the current screen.
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
}
