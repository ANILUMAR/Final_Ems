import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, rangeEndOf, rangeStartOf } from './pagination';

/**
 * The pager strip every record list shares: "Showing 1–5 of 24 tasks" on the
 * left, the page controls and the page-size dropdown on the right.
 *
 * <p>The screen owns the page state through two-way bindings, so its slice
 * getter re-runs the moment the size or the page changes, and the strip follows
 * whatever list length it is handed - filters, searches and reloads included.
 * Nothing renders while the list is empty, so an empty screen keeps its own
 * "nothing matches" note instead of a dead pager.</p>
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  imports: [CommonModule, MatPaginatorModule],
  template: `
    <div class="ems-pager" [class.ems-pager--compact]="compact" *ngIf="length > 0">
      <span class="ems-pager__info">
        Showing {{ rangeStart }}–{{ rangeEnd }} of {{ length }} {{ length === 1 ? noun : plural || noun + 's' }}
      </span>
      <mat-paginator
        [length]="length"
        [pageIndex]="pageIndex"
        [pageSize]="pageSize"
        [pageSizeOptions]="options"
        (page)="onPage($event)"
        showFirstLastButtons>
      </mat-paginator>
    </div>
  `
})
export class Pager {
  /** How many records the current view holds; the strip hides itself at zero. */
  @Input() length = 0;
  /** Zero-based page the list is showing. */
  @Input() pageIndex = 0;
  /** Records per page; the dropdown changes it and reports it back. */
  @Input() pageSize = DEFAULT_PAGE_SIZE;
  /** The word after the count, singular; the plural is derived or given. */
  @Input() noun = 'record';
  /** For nouns that do not just take an "s", such as entry → entries. */
  @Input() plural = '';
  /** Narrow columns stack the strip and drop the sentence. */
  @Input() compact = false;

  readonly options = PAGE_SIZE_OPTIONS;

  @Output() pageIndexChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get rangeStart(): number {
    return rangeStartOf(this.length, this.pageIndex, this.pageSize);
  }

  get rangeEnd(): number {
    return rangeEndOf(this.length, this.pageIndex, this.pageSize);
  }

  onPage(event: PageEvent): void {
    // The size goes first: choosing a bigger size pulls the page index back, and
    // the screen must slice with the size the paginator has just moved to.
    if (event.pageSize !== this.pageSize) {
      this.pageSizeChange.emit(event.pageSize);
    }
    if (event.pageIndex !== this.pageIndex) {
      this.pageIndexChange.emit(event.pageIndex);
    }
  }
}
