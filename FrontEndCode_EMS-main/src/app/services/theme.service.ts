import { Injectable, signal } from '@angular/core';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const DEFAULT_THEME: ThemeName = 'dark';

/** The browser's remembered choice, falling back to the shipped dark theme. */
function storedTheme(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME;
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
  }

  get isDark(): boolean {
    return this.theme() === 'dark';
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
    document.documentElement.setAttribute('data-theme', theme);
  }
}
