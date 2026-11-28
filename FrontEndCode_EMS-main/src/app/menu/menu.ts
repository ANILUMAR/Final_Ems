import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { roleLabel as formatRole } from '../models/role';
import { ThemeName, ThemeService } from '../services/theme.service';
import { RolePermissionService } from '../services/role-permission.service';
import {
  NavigationPreferenceService,
  NavType,
  SidebarLayoutStyle,
  NavDisplayMode,
  SidebarPosition,
  ThemePreference,
  SidebarPreferences
} from '../services/navigation-preference.service';

type PrefKey = 'dailyDigest' | 'desktopAlerts' | 'weeklySummary' | 'autoDraft';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, RouterModule],
  templateUrl: './menu.html',
  styleUrl: './menu.css'
})
export class Menu implements OnInit {
  name = localStorage.getItem('name') || localStorage.getItem('email') || 'User';
  email = localStorage.getItem('email') || '';
  role = (localStorage.getItem('role') || 'EMPLOYEE').toUpperCase();

  defaultHours = Number(localStorage.getItem('pref.defaultHours') || 8);
  weekStart = localStorage.getItem('pref.weekStart') || 'Monday';
  hourOptions = [6, 7, 8, 9];

  prefs: Record<PrefKey, boolean> = {
    dailyDigest: this.read('pref.dailyDigest', true),
    desktopAlerts: this.read('pref.desktopAlerts', true),
    weeklySummary: this.read('pref.weeklySummary', false),
    autoDraft: this.read('pref.autoDraft', false)
  };

  preferenceRows: { key: PrefKey; title: string; hint: string; icon: string }[] = [
    { key: 'dailyDigest', title: 'Daily digest', hint: 'A morning summary of your assigned tasks.', icon: 'inbox' },
    { key: 'desktopAlerts', title: 'Due date alerts', hint: 'Warn me when a task is one day from its due date.', icon: 'notifications_active' },
    { key: 'weeklySummary', title: 'Weekly summary', hint: 'Email a recap of hours logged every Friday.', icon: 'summarize' },
    { key: 'autoDraft', title: 'Keep timesheet drafts', hint: 'Save an unfinished timesheet instead of discarding it.', icon: 'save' }
  ];

  /* ---------- Sidebar & Navigation Customization ---------- */
  draftNavType: NavType = 'sidebar';
  draftLayout: SidebarLayoutStyle = 'collapsed';
  draftDisplayMode: NavDisplayMode = 'multi';
  draftPosition: SidebarPosition = 'left';
  draftTheme: ThemePreference = 'dark';

  previewGroupsExpanded: Record<string, boolean> = {
    overview: false,
    work: true,
    delivery: false,
    account: false
  };

  readonly navTypeOptions: { key: NavType; title: string; hint: string; icon: string; badge: string }[] = [
    {
      key: 'sidebar',
      title: 'Sidebar Navigation (Default)',
      hint: 'Vertical navigation with module trees and custom sidebar styles. Clean, structured workspace navigation.',
      icon: 'dock_to_left',
      badge: 'Standard'
    },
    {
      key: 'top',
      title: 'Top Navigation Bar',
      hint: 'Horizontal module navigation in the top header with dropdown menus. Completely hides the sidebar for a 100% full-width workspace.',
      icon: 'table_rows',
      badge: 'Full Width'
    }
  ];

  readonly layoutOptions: { key: SidebarLayoutStyle; title: string; hint: string; icon: string; badge: string }[] = [
    {
      key: 'collapsed',
      title: 'Collapsed (Accordion)',
      hint: 'Module headings with collapsible screen groups. Clean, focused overview.',
      icon: 'format_list_bulleted',
      badge: 'Standard'
    },
    {
      key: 'expanded',
      title: 'Expanded (Full View)',
      hint: 'All authorized modules and child screens permanently visible for quick access.',
      icon: 'view_agenda',
      badge: 'All Screens'
    },
    {
      key: 'compact',
      title: 'Compact (High Density)',
      hint: 'Slimmer 200px footprint with streamlined padding and typography.',
      icon: 'density_small',
      badge: 'Productivity'
    },
    {
      key: 'icon-only',
      title: 'Icon-Only (Mini Rail)',
      hint: 'Minimal 72px icon rail with instant hover tooltips. Maximizes screen space.',
      icon: 'dock',
      badge: 'Minimal'
    }
  ];

  readonly displayModeOptions: { key: NavDisplayMode; title: string; hint: string; icon: string }[] = [
    {
      key: 'multi',
      title: 'Multi-Section Expand',
      hint: 'Keep multiple module sections open simultaneously.',
      icon: 'unfold_more'
    },
    {
      key: 'accordion',
      title: 'Single Accordion',
      hint: 'Auto-collapse other sections whenever a module is opened.',
      icon: 'unfold_less'
    },
    {
      key: 'always-expanded',
      title: 'Always Expanded',
      hint: 'Lock all navigation sections open without click toggling.',
      icon: 'lock_open'
    }
  ];

  readonly positionOptions: { key: SidebarPosition; title: string; hint: string; icon: string; detail: string }[] = [
    {
      key: 'left',
      title: 'Left Docked',
      hint: 'Standard enterprise left-hand navigation layout.',
      icon: 'vertical_split',
      detail: 'Left margin'
    },
    {
      key: 'right',
      title: 'Right Docked',
      hint: 'Right-hand navigation rail for dual displays or accessibility.',
      icon: 'align_horizontal_right',
      detail: 'Right margin'
    }
  ];

  readonly themePreferenceOptions: { key: ThemePreference; title: string; hint: string; icon: string; previewColor: string }[] = [
    {
      key: 'dark',
      title: 'Dark Workspace',
      hint: 'Low-glare palette tuned for extended focus and low-light environments.',
      icon: 'dark_mode',
      previewColor: '#0b1120'
    },
    {
      key: 'light',
      title: 'Light Workspace',
      hint: 'Crisp, high-contrast palette optimized for well-lit rooms and daytime work.',
      icon: 'light_mode',
      previewColor: '#f8fafc'
    },
    {
      key: 'system',
      title: 'System Default',
      hint: 'Automatically synchronizes with your device / OS dark or light appearance.',
      icon: 'settings_brightness',
      previewColor: 'linear-gradient(135deg, #0b1120 50%, #f8fafc 50%)'
    }
  ];

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private themeService: ThemeService,
    private rolePermissionService: RolePermissionService,
    public navPref: NavigationPreferenceService
  ) {}

  ngOnInit(): void {
    this.initNavigationDraft();
  }

  initNavigationDraft(): void {
    const cur = this.navPref.getCurrentPreferences();
    this.draftNavType = cur.navType || 'sidebar';
    this.draftLayout = cur.layoutStyle;
    this.draftDisplayMode = cur.navDisplayMode;
    this.draftPosition = cur.sidebarPosition;
    this.draftTheme = cur.themePreference;
  }

  get isNavDirty(): boolean {
    const cur = this.navPref.getCurrentPreferences();
    return (
      this.draftNavType !== cur.navType ||
      this.draftLayout !== cur.layoutStyle ||
      this.draftDisplayMode !== cur.navDisplayMode ||
      this.draftPosition !== cur.sidebarPosition ||
      this.draftTheme !== cur.themePreference
    );
  }

  setDraftNavType(type: NavType): void {
    this.draftNavType = type;
  }

  setDraftLayout(style: SidebarLayoutStyle): void {
    this.draftLayout = style;
  }

  setDraftDisplayMode(mode: NavDisplayMode): void {
    this.draftDisplayMode = mode;
  }

  setDraftPosition(pos: SidebarPosition): void {
    this.draftPosition = pos;
  }

  setDraftTheme(theme: ThemePreference): void {
    this.draftTheme = theme;
  }

  togglePreviewGroup(groupKey: string): void {
    if (this.draftLayout === 'expanded' || this.draftDisplayMode === 'always-expanded') {
      return;
    }
    if (this.draftDisplayMode === 'accordion') {
      const isCurrentlyOpen = !!this.previewGroupsExpanded[groupKey];
      Object.keys(this.previewGroupsExpanded).forEach((k) => (this.previewGroupsExpanded[k] = false));
      this.previewGroupsExpanded[groupKey] = !isCurrentlyOpen;
    } else {
      this.previewGroupsExpanded[groupKey] = !this.previewGroupsExpanded[groupKey];
    }
  }

  isPreviewGroupExpanded(groupKey: string): boolean {
    if (this.draftLayout === 'expanded' || this.draftDisplayMode === 'always-expanded') {
      return true;
    }
    return !!this.previewGroupsExpanded[groupKey];
  }

  saveNavigationPreferences(): void {
    const prefs: SidebarPreferences = {
      navType: this.draftNavType,
      layoutStyle: this.draftLayout,
      navDisplayMode: this.draftDisplayMode,
      sidebarPosition: this.draftPosition,
      themePreference: this.draftTheme
    };
    this.navPref.savePreferences(prefs);
    this.snackBar.open(
      `Navigation preferences saved. Displaying ${prefs.navType === 'top' ? 'Top Navigation (Sidebar hidden)' : 'Sidebar Navigation'}.`,
      'Close',
      { duration: 2800 }
    );
  }

  resetNavigationDefaults(): void {
    const defaults = this.navPref.resetToDefaults();
    this.draftNavType = defaults.navType || 'sidebar';
    this.draftLayout = defaults.layoutStyle;
    this.draftDisplayMode = defaults.navDisplayMode;
    this.draftPosition = defaults.sidebarPosition;
    this.draftTheme = defaults.themePreference;
    this.previewGroupsExpanded = {
      overview: false,
      work: true,
      delivery: false,
      account: false
    };
    this.snackBar.open('Navigation layout restored to default Sidebar Navigation.', 'Close', {
      duration: 2500
    });
  }

  /* ---------- appearance ---------- */

  themeOptions: { key: ThemeName; title: string; hint: string }[] = [
    { key: 'dark', title: 'Dark workspace', hint: 'Low-glare palette tuned for long sessions.' },
    { key: 'light', title: 'Light workspace', hint: 'Bright palette for well-lit rooms and printouts.' }
  ];

  get activeTheme(): ThemeName {
    return this.themeService.theme();
  }

  setTheme(theme: ThemeName): void {
    if (theme === this.themeService.theme()) {
      return;
    }
    this.themeService.set(theme);
    this.draftTheme = theme;
    this.navPref.savePreferences({
      ...this.navPref.getCurrentPreferences(),
      themePreference: theme
    });
    this.snackBar.open(`${theme === 'light' ? 'Light' : 'Dark'} theme applied.`, 'Close', { duration: 2000 });
  }

  /* ---------- preferences ---------- */

  private read(key: string, fallback: boolean): boolean {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  }

  toggle(key: PrefKey): void {
    this.prefs[key] = !this.prefs[key];
    localStorage.setItem(`pref.${key}`, String(this.prefs[key]));
    this.confirm();
  }

  setHours(hours: number): void {
    this.defaultHours = hours;
    localStorage.setItem('pref.defaultHours', String(hours));
    this.confirm();
  }

  setWeekStart(day: string): void {
    this.weekStart = day;
    localStorage.setItem('pref.weekStart', day);
    this.confirm();
  }

  private confirm(): void {
    this.snackBar.open('Preferences saved.', 'Close', { duration: 2000 });
  }

  /* ---------- session ---------- */

  get initials(): string {
    const parts = (this.name || 'U').split(/[\s.@]+/).filter((part) => !!part);
    return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  }

  get roleLabel(): string {
    return formatRole(this.role);
  }

  signOut(): void {
    this.rolePermissionService.clearPermissions();
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
