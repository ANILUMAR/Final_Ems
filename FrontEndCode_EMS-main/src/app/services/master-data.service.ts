import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

/** The three lists, in the order they are filled in. */
export type MasterType = 'MODULE' | 'SUB_MODULE' | 'SCREEN';

/** One value of the module / sub module / screen master data. */
export interface MasterEntry {
  id: number;
  type: MasterType;
  name: string;
  /** null for a module, the module for a sub module, the sub module for a screen. */
  parentId: number | null;
  active?: boolean | null;
  sortOrder?: number | null;
}

type MasterMap = Partial<Record<MasterType, MasterEntry[]>>;

/**
 * The module / sub module / screen master data, read from `/api/masters`.
 *
 * <p>It is one flat list per type; the tree is built here from {@code parentId},
 * so a screen is only ever offered under the sub module it belongs to. The
 * create and edit task screens read their pickers from this service, which
 * means a value added on the Master data screen shows up without a reload.</p>
 */
@Injectable({ providedIn: 'root' })
export class MasterDataService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:9001/api/masters';

  /** Everything fetched so far; templates read through the getters below. */
  private readonly entries = signal<MasterEntry[]>([]);
  private readonly ready = signal(false);
  private request$: Observable<MasterEntry[]> | null = null;

  /** Loads the lists once and replays the result to later callers. */
  load(): Observable<MasterEntry[]> {
    if (!this.request$) {
      this.request$ = this.http.get<MasterMap>(this.apiUrl, { headers: this.headers() }).pipe(
        // A failed load must not block the task forms: an empty map leaves the
        // pickers empty, and the hint on screen tells the user why.
        catchError((error) => {
          console.error('Master data could not be loaded; the pickers will be empty.', error);
          return of<MasterMap>({});
        }),
        tap((payload) => this.apply(payload)),
        map(() => this.entries()),
        shareReplay(1)
      );
    }
    return this.request$;
  }

  /** Discards the cached copy so the next subscriber sees fresh lists. */
  reload(): Observable<MasterEntry[]> {
    this.request$ = null;
    return this.load();
  }

  /** True once a request has come back, so "empty" can be told from "not yet". */
  get loaded(): boolean {
    return this.ready();
  }

  get modules(): MasterEntry[] {
    return this.ofType('MODULE');
  }

  /** The sub modules of one module. */
  subModules(moduleId: number | null | undefined): MasterEntry[] {
    if (moduleId == null) {
      return [];
    }
    return this.ofType('SUB_MODULE').filter((entry) => entry.parentId === moduleId);
  }

  /** The screens of one sub module. */
  screens(subModuleId: number | null | undefined): MasterEntry[] {
    if (subModuleId == null) {
      return [];
    }
    return this.ofType('SCREEN').filter((entry) => entry.parentId === subModuleId);
  }

  /** The stored value behind a name, or undefined for a value that was retired. */
  find(type: MasterType, name: string | null | undefined): MasterEntry | undefined {
    const wanted = String(name || '').trim().toLowerCase();
    return this.ofType(type).find((entry) => String(entry.name).trim().toLowerCase() === wanted);
  }

  /** Adds a value; the backend rejects a duplicate name under the same parent. */
  create(type: MasterType, name: string, parentId: number | null = null): Observable<MasterEntry> {
    return this.http
      .post<MasterEntry>(this.apiUrl, { type, name, parentId }, { headers: this.headers() })
      .pipe(tap(() => this.request$ = null));
  }

  /** Retires a value (and everything under it). Recorded work keeps its name. */
  retire(entry: MasterEntry): Observable<MasterEntry> {
    return this.http
      .delete<MasterEntry>(`${this.apiUrl}/${entry.id}`, { headers: this.headers() })
      .pipe(tap(() => this.request$ = null));
  }

  /* ---------- internals ---------- */

  private ofType(type: MasterType): MasterEntry[] {
    return this.entries()
      .filter((entry) => entry.type === type)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  }

  private apply(payload: MasterMap | null | undefined): void {
    const flat: MasterEntry[] = [];
    (['MODULE', 'SUB_MODULE', 'SCREEN'] as MasterType[]).forEach((type) => {
      (payload?.[type] || []).forEach((entry) =>
        flat.push({ ...entry, type, parentId: entry.parentId ?? null })
      );
    });
    this.entries.set(flat);
    this.ready.set(true);
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }
}
