import { Injectable, signal } from '@angular/core';

export type ThemeName = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemeName = 'dark';

/** The browser's remembered choice, falling back to the shipped dark theme. */
function storedTheme(): ThemeName {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'system') {
      return val;
    }
    return DEFAULT_THEME;
  } catch {
    // Storage can be blocked; the default theme still works.
    return DEFAULT_THEME;
  }
}

/**
 * One switch for the whole app: the stylesheet keys every colour token off
 * `data-theme` on <html>, so flipping it restyles the shell, the boards, the
 * Material widgets and the auth screens together.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** Read by any component that renders theme-aware text or icons. */
  readonly theme = signal<ThemeName>(storedTheme());

  constructor() {
    this.apply(this.theme());
    this.listenToSystemChanges();
  }

  get isDark(): boolean {
    const current = this.theme();
    if (current === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return current === 'dark';
  }

  set(theme: ThemeName): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // A blocked store only costs the preference on the next visit.
    }
    this.apply(theme);
  }

  toggle(): void {
    this.set(this.isDark ? 'light' : 'dark');
  }

  private apply(theme: ThemeName): void {
    let effective = theme;
    if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-preference', theme);
  }

  private listenToSystemChanges(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.theme() === 'system') {
          this.apply('system');
        }
      });
    }
  }
}
