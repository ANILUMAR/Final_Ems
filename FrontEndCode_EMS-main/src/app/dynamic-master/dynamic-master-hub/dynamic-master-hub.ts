import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DynamicMasterService } from '../../services/dynamic-master.service';
import { DynamicFormSchema } from '../../models/dynamic-master.model';
import { isSuperAdminRole } from '../../models/role';

@Component({
  selector: 'app-dynamic-master-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './dynamic-master-hub.html',
  styleUrl: './dynamic-master-hub.css'
})
export class DynamicMasterHubComponent implements OnInit {
  private dynamicMasterService = inject(DynamicMasterService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  loading = true;
  schemas: DynamicFormSchema[] = [];
  search = '';
  selectedModule = 'ALL';

  role = (localStorage.getItem('role') || '').toUpperCase();

  get canEdit(): boolean {
    return isSuperAdminRole(this.role) || this.role === 'ADMIN';
  }

  get activeSchemasCount(): number {
    return this.schemas.filter((s) => s.active !== false).length;
  }

  ngOnInit(): void {
    this.loadSchemas();
  }

  loadSchemas(): void {
    this.loading = true;
    this.dynamicMasterService.listSchemas().subscribe({
      next: (list) => {
        this.schemas = list || [];
        this.loading = false;
      },
      error: (err) => {
        this.snackBar.open('Failed to load master screens: ' + (err.error || err.message), 'Close', { duration: 4000 });
        this.loading = false;
      }
    });
  }

  get modulesList(): string[] {
    const set = new Set<string>();
    this.schemas.forEach((s) => {
      if (s.module) set.add(s.module);
    });
    return Array.from(set);
  }

  get filteredSchemas(): DynamicFormSchema[] {
    const term = this.search.trim().toLowerCase();
    return this.schemas.filter((s) => {
      if (this.selectedModule !== 'ALL' && s.module !== this.selectedModule) {
        return false;
      }
      if (!term) return true;
      return (
        s.screenName.toLowerCase().includes(term) ||
        s.screenCode.toLowerCase().includes(term) ||
        (s.description || '').toLowerCase().includes(term) ||
        (s.module || '').toLowerCase().includes(term)
      );
    });
  }

  deleteSchema(schema: DynamicFormSchema, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete the "${schema.screenName}" schema?`)) return;

    this.dynamicMasterService.deleteSchema(schema.screenCode, false).subscribe({
      next: () => {
        this.snackBar.open(`Schema "${schema.screenName}" deleted.`, undefined, { duration: 3000 });
        this.loadSchemas();
      },
      error: (err) => {
        this.snackBar.open('Failed to delete schema: ' + (err.error || err.message), 'Close', { duration: 4000 });
      }
    });
  }

  goToBuilder(screenCode?: string): void {
    if (screenCode) {
      this.router.navigate(['/dynamic-masters/builder', screenCode]);
    } else {
      this.router.navigate(['/dynamic-masters/builder']);
    }
  }

  openScreen(screenCode: string): void {
    this.router.navigate(['/dynamic-masters/view', screenCode]);
  }
}
