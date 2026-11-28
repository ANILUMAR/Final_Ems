import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { BulkOnboardResult, BulkOnboardRow, WorkspaceService } from '../services/workspace.service';

interface ParseIssue {
  line: number;
  message: string;
}

/**
 * Onboards a whole team at once. Pasting a spreadsheet export beats filling the
 * registration form 40 times, and the reply lists exactly who was created and
 * who was skipped (and why).
 */
@Component({
  selector: 'app-bulk-onboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './bulk-onboard.html',
  styleUrl: './bulk-onboard.css'
})
export class BulkOnboardDialog {
  text = '';
  saving = false;
  errorMessage = '';
  result: BulkOnboardResult | null = null;

  readonly placeholder =
    'Raju Kumar, raju.kumar@ems.com, Welcome@123, Developer, 9000000001\n' +
    'Priya Sharma, priya.sharma@ems.com, Welcome@123, Tester\n' +
    'Arun Nair, arun.nair@ems.com, Welcome@123';

  constructor(private workspace: WorkspaceService, private dialogRef: MatDialogRef<BulkOnboardDialog>) {}

  get parsedRows(): BulkOnboardRow[] {
    return this.parse().rows;
  }

  get parseIssues(): ParseIssue[] {
    return this.parse().issues;
  }

  get canSubmit(): boolean {
    return !this.saving && !this.result && this.parsedRows.length > 0;
  }

  submit(): void {
    if (!this.canSubmit) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';

    this.workspace.bulkRegister(this.parsedRows).subscribe({
      next: (res) => {
        this.result = res;
        this.saving = false;
      },
      error: (err: any) => {
        this.errorMessage = typeof err?.error === 'string' ? err.error : 'Could not onboard these people right now.';
        this.saving = false;
      }
    });
  }

  done(): void {
    this.dialogRef.close(!!this.result && this.result.createdCount > 0);
  }

  private parse(): { rows: BulkOnboardRow[]; issues: ParseIssue[] } {
    const rows: BulkOnboardRow[] = [];
    const issues: ParseIssue[] = [];
    const lines = (this.text || '').split(/\r?\n/);

    lines.forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) {
        return;
      }

      const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((cell) => cell.trim());

      // Tolerate the spreadsheet header row: "Name, Email, Password, Role…"
      if (index === 0 && cells[0].toLowerCase() === 'name') {
        return;
      }
      if (cells.length < 3 || !cells[0] || !cells[1]) {
        issues.push({ line: index + 1, message: 'needs at least name, email, password' });
        return;
      }

      let rawRole = (cells[3] || 'EMPLOYEE').trim();
      let roleUpper = rawRole.toUpperCase().replace(/\s+/g, '_');
      if (roleUpper === 'TEAM_LEADER' || roleUpper === 'TEAM_LEAD') {
        roleUpper = 'TEAM_LEAD';
      } else if (roleUpper === 'DEVELOPER_TEAM_LEADER' || roleUpper === 'DEVELOPMENT_TEAM_LEAD') {
        roleUpper = 'DEVELOPER_LEAD';
      } else if (roleUpper === 'TESTER_TEAM_LEADER' || roleUpper === 'QA_TEAM_LEAD') {
        roleUpper = 'TESTER_LEAD';
      }

      rows.push({
        name: cells[0],
        email: cells[1],
        password: cells[2],
        role: roleUpper,
        phoneNumber: cells[4] || undefined,
        address: cells[5] || undefined
      });
    });

    return { rows, issues };
  }
}
