import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { applyRoleLookups } from '../models/role';
import { applyStatusMeta } from '../task-status/status-history-dialog';

/** One value of a reference list, exactly as the backend stores it. */
export interface LookupItem {
  id: string;
  category: string;
  code: string;
  label: string;
  icon?: string | null;
  tone?: string | null;
  sortOrder?: number;
  active?: boolean;
  /** false for outcomes such as APPROVED: shown on lists, never offered as a choice. */
  selectable?: boolean | null;
}

export type LookupCategory = 'ROLE' | 'WORK_STATUS' | 'PRIORITY' | 'TIMESHEET_STATUS' | 'PROJECT_STATUS';

type LookupMap = Record<string, LookupItem[]>;

/**
 * The client's vocabulary: roles, work statuses, priorities, timesheet states
 * and project health all come from `/api/reference`, which reads the
 * `app_lookup` collection.
 *
 * <p>Nothing here is hard-coded. Rename "Developer" to "Engineer", add a
 * "Critical" priority or retire a status in the database and every picker,
 * chip and badge follows on the next load.</p>
 *
 * <p>{@link load} is awaited during bootstrap, so the maps are filled before
 * the first screen renders and components can read them synchronously.</p>
 */
@Injectable({ providedIn: 'root' })
export class ReferenceService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:9001/api/reference';

  private lookups: LookupMap = {
    ROLE: [],
    WORK_STATUS: [],
    PRIORITY: [],
    TIMESHEET_STATUS: [],
    PROJECT_STATUS: []
  };

  private request$: Observable<LookupMap> | null = null;

  /** Loads every list once and replays the result to later callers. */
  load(): Observable<LookupMap> {
    if (!this.request$) {
      this.request$ = this.http.get<LookupMap>(this.apiUrl).pipe(
        tap((payload) => this.apply(payload)),
        catchError((error) => {
          // A failed load must not block the app: pickers simply stay empty.
          console.error('Reference data could not be loaded; pickers will be empty.', error);
          return of(this.lookups);
        }),
        shareReplay(1)
      );
    }
    return this.request$;
  }

  /** Discards the cached copy so the next subscriber sees a fresh list. */
  reload(): Observable<LookupMap> {
    this.request$ = null;
    return this.load();
  }

  private apply(payload: LookupMap | null | undefined): void {
    const next: LookupMap = {};
    Object.keys(this.lookups).forEach((category) => {
      next[category] = (payload && payload[category]) || [];
    });
    this.lookups = next;

    // The role words and the status pills are read all over the app through
    // plain functions, so they get their copy of the data here.
    applyRoleLookups(next['ROLE']);
    applyStatusMeta(next['WORK_STATUS']);
  }

  items(category: LookupCategory): LookupItem[] {
    return this.lookups[category] || [];
  }

  codes(category: LookupCategory): string[] {
    return this.items(category).map((item) => item.code);
  }

  /** Only the values a form may offer, i.e. the ones a person can pick. */
  choices(category: LookupCategory): LookupItem[] {
    return this.items(category).filter((item) => item.selectable !== false);
  }

  find(category: LookupCategory, code: string | null | undefined): LookupItem | undefined {
    const key = String(code || '').trim().toUpperCase();
    return this.items(category).find((item) => String(item.code).toUpperCase() === key);
  }

  /** The word on screen. Unknown codes still read sensibly. */
  label(category: LookupCategory, code: string | null | undefined): string {
    return this.find(category, code)?.label || this.titleCase(code);
  }

  tone(category: LookupCategory, code: string | null | undefined): string {
    return this.find(category, code)?.tone || 'neutral';
  }

  icon(category: LookupCategory, code: string | null | undefined): string {
    return this.find(category, code)?.icon || 'radio_button_unchecked';
  }

  /** Ready-made class for the ems-badge component. */
  badge(category: LookupCategory, code: string | null | undefined): string {
    return `ems-badge--${this.tone(category, code)}`;
  }

  private titleCase(code: string | null | undefined): string {
    const value = String(code || '').trim().replace(/_/g, ' ').toLowerCase();
    if (!value) {
      return '';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
