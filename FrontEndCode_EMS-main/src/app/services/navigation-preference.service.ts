import { Injectable, inject, signal } from '@angular/core';
import { ThemeName, ThemeService } from './theme.service';

export type NavType = 'sidebar' | 'top';
export type SidebarLayoutStyle = 'collapsed' | 'expanded' | 'compact' | 'icon-only';
export type NavDisplayMode = 'accordion' | 'multi' | 'always-expanded';
export type SidebarPosition = 'left' | 'right';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface SidebarPreferences {
  navType: NavType;
  layoutStyle: SidebarLayoutStyle;
  navDisplayMode: NavDisplayMode;
  sidebarPosition: SidebarPosition;
  themePreference: ThemePreference;
}

export const DEFAULT_PREFERENCES: SidebarPreferences = {
  navType: 'sidebar',
  layoutStyle: 'collapsed',
  navDisplayMode: 'multi',
  sidebarPosition: 'left',
  themePreference: 'dark'
};

@Injectable({
  providedIn: 'root'
})
export class NavigationPreferenceService {
  private themeService = inject(ThemeService);

  readonly navType = signal<NavType>('sidebar');
  readonly layoutStyle = signal<SidebarLayoutStyle>('collapsed');
  readonly navDisplayMode = signal<NavDisplayMode>('multi');
  readonly sidebarPosition = signal<SidebarPosition>('left');
  readonly themePreference = signal<ThemePreference>('dark');

  constructor() {
    this.loadUserPreferences();
  }

  private getUserKey(): string {
    const email = (localStorage.getItem('email') || 'default').trim().toLowerCase();
    return `ems_sidebar_pref_${email}`;
  }

  loadUserPreferences(): void {
    const key = this.getUserKey();
    let prefs: SidebarPreferences = { ...DEFAULT_PREFERENCES };
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        prefs = { ...DEFAULT_PREFERENCES, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to read sidebar preferences:', e);
    }

    this.navType.set(prefs.navType || 'sidebar');
    this.layoutStyle.set(prefs.layoutStyle);
    this.navDisplayMode.set(prefs.navDisplayMode);
    this.sidebarPosition.set(prefs.sidebarPosition);
    this.themePreference.set(prefs.themePreference);

    this.applyToDom(prefs);
  }

  savePreferences(prefs: SidebarPreferences): void {
    this.navType.set(prefs.navType || 'sidebar');
    this.layoutStyle.set(prefs.layoutStyle);
    this.navDisplayMode.set(prefs.navDisplayMode);
    this.sidebarPosition.set(prefs.sidebarPosition);
    this.themePreference.set(prefs.themePreference);

    try {
      localStorage.setItem(this.getUserKey(), JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save sidebar preferences:', e);
    }

    this.applyToDom(prefs);
  }

  resetToDefaults(): SidebarPreferences {
    const defaults = { ...DEFAULT_PREFERENCES };
    this.savePreferences(defaults);
    return defaults;
  }

  getCurrentPreferences(): SidebarPreferences {
    return {
      navType: this.navType(),
      layoutStyle: this.layoutStyle(),
      navDisplayMode: this.navDisplayMode(),
      sidebarPosition: this.sidebarPosition(),
      themePreference: this.themePreference()
    };
  }

  private applyToDom(prefs: SidebarPreferences): void {
    const doc = document.documentElement;
    doc.setAttribute('data-nav-type', prefs.navType || 'sidebar');
    doc.setAttribute('data-sidebar-style', prefs.layoutStyle);
    doc.setAttribute('data-sidebar-position', prefs.sidebarPosition);

    // Synchronize theme with ThemeService
    if (prefs.themePreference === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.themeService.set(prefersDark ? 'dark' : 'light');
    } else {
      this.themeService.set(prefs.themePreference as ThemeName);
    }
  }
}
