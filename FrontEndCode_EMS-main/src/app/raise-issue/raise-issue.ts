import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MasterDataService, MasterEntry } from '../services/master-data.service';
import { roleFamily } from '../models/role';
import { ReferenceService } from '../services/reference.service';
import { WorkspaceService } from '../services/workspace.service';
import { WorkflowService } from '../services/workflow.service';
import { FlowDesigner, FlowDiagramResult } from '../flow-designer/flow-designer';

/**
 * Where a task or a bug enters the queue: a tester reports what the product is
 * missing, or what it does wrong, and the CEO may file work of their own. This
 * is the only create screen in the app, so every item is numbered here.
 *
 * <p>A tester's report is stored as PENDING and goes to the testing team
 * leader's review queue first; only once it is approved does it reach the
 * developer team leader's assignment screen. The testing leader and the CEO
 * approve their own side, so what they raise skips review and lands in the
 * assignment list. The development team neither raises nor corrects work here:
 * it receives what testing approved. The task code the server stamps is shown
 * straight back, so the number is known from that moment on.</p>
 */
@Component({
  selector: 'app-raise-issue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatDialogModule
  ],
  templateUrl: './raise-issue.html',
  styleUrl: './raise-issue.css'
})
export class RaiseIssue implements OnInit {
  kind = 'BUG';
  project = '';
  title = '';
  priority = '';
  module = '';
  subModule = '';
  screen = '';
  description = '';
  selectedFile: File | null = null;

  // Bug reproduction flow and steps
  reproductionSteps = '';
  flowJson = '';
  flowImageBlob: Blob | null = null;
  flowImageDataUrl = '';
  flowStepCount = 0;

  projects: { id: number; name: string }[] = [];
  saving = false;
  errorMessage = '';
  successMessage = '';
  /** The code of the item just raised, so the tester can quote it at once. */
  lastCode = '';

  constructor(
    private workflow: WorkflowService,
    private workspace: WorkspaceService,
    private reference: ReferenceService,
    private master: MasterDataService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['project']) {
        this.project = params['project'];
      }
    });

    this.workspace.getProjects().subscribe({
      next: (rows) => {
        this.projects = (rows || []).map((project) => ({ id: project.id, name: project.name }));
        if (this.project && !this.projects.some((p) => p.name.toLowerCase() === this.project.toLowerCase())) {
          this.projects.unshift({ id: -1, name: this.project });
        }
      },
      error: () => {
        this.errorMessage = 'Could not load the project list. Reload the page to try again.';
      }
    });
    // The module / sub module / screen pickers read the same master data the
    // task form does, so a value added on Master data is offered here too.
    this.master.load().subscribe();
  }

  get priorities() {
    return this.reference.items('PRIORITY');
  }

  get canSubmit(): boolean {
    return !!this.project && !!this.title.trim() && !!this.priority && !this.saving;
  }

  /**
   * True for the CEO and the testing team leader: the server approves what they
   * raise, so the screen must not promise a review that will not happen. A
   * tester's report is the only one that waits for a decision.
   */
  get skipsReview(): boolean {
    return roleFamily(localStorage.getItem('role')) !== 'TESTER';
  }

  /* ---------- the narrowing module pickers ---------- */

  get moduleOptions(): string[] {
    return this.withCurrent(this.master.modules.map((entry) => entry.name), this.module);
  }

  get subModuleOptions(): string[] {
    const parent = this.selectedModule;
    return this.withCurrent(parent ? this.master.subModules(parent.id).map((entry) => entry.name) : [], this.subModule);
  }

  get screenOptions(): string[] {
    const parent = this.selectedSubModule;
    return this.withCurrent(parent ? this.master.screens(parent.id).map((entry) => entry.name) : [], this.screen);
  }

  get selectedModule(): MasterEntry | undefined {
    return this.master.modules.find((entry) => entry.name.toLowerCase() === this.module.trim().toLowerCase());
  }

  get selectedSubModule(): MasterEntry | undefined {
    const parent = this.selectedModule;
    if (!parent) {
      return undefined;
    }
    return this.master
      .subModules(parent.id)
      .find((entry) => entry.name.toLowerCase() === this.subModule.trim().toLowerCase());
  }

  /** A module belongs to one chain, so the narrower picks start again. */
  onModuleChange(): void {
    this.subModule = '';
    this.screen = '';
  }

  onSubModuleChange(): void {
    this.screen = '';
  }

  private withCurrent(names: string[], current: string): string[] {
    const value = (current || '').trim();
    if (!value || names.some((name) => name.toLowerCase() === value.toLowerCase())) {
      return names;
    }
    return [value, ...names];
  }

  /* ---------- the attachment ---------- */

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorMessage = '';
    if (!file) {
      return;
    }
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ];
    if (!allowed.includes(file.type)) {
      this.errorMessage = 'That file type is not accepted. Use a PDF, DOC, DOCX, PNG or JPG.';
      this.clearFile();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'The attachment is larger than 5 MB. Choose a smaller file.';
      this.clearFile();
      return;
    }
    this.selectedFile = file;
  }

  clearFile(): void {
    this.selectedFile = null;
    const input = document.getElementById('issueFile') as HTMLInputElement | null;
    if (input) {
      input.value = '';
    }
  }

  /* ---------- Flow Designer Dialog ---------- */

  openFlowDesigner(): void {
    const ref = this.dialog.open<FlowDesigner, any, FlowDiagramResult>(FlowDesigner, {
      data: {
        existingFlowJson: this.flowJson,
        title: this.title || 'Bug Reproduction Flow'
      },
      width: '95vw',
      maxWidth: '1320px',
      height: '90vh',
      maxHeight: '880px',
      panelClass: 'flow-designer-dialog-panel'
    });

    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.flowImageBlob = res.imageBlob;
        this.flowImageDataUrl = res.imageDataUrl;
        this.flowJson = res.flowJson;
        this.flowStepCount = res.nodeCount;
        if (!this.reproductionSteps.trim() && res.stepsText) {
          this.reproductionSteps = res.stepsText;
        }
      }
    });
  }

  clearFlowDiagram(): void {
    this.flowImageBlob = null;
    this.flowImageDataUrl = '';
    this.flowJson = '';
    this.flowStepCount = 0;
  }

  /* ---------- submit ---------- */

  submit(): void {
    if (!this.canSubmit) {
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.lastCode = '';

    const body = new FormData();
    body.append('kind', this.kind);
    body.append('project', this.project);
    body.append('taskTitle', this.title.trim());
    body.append('priority', this.priority);
    body.append('module', this.module || '');
    body.append('subModule', this.subModule || '');
    body.append('screen', this.screen || '');
    body.append('description', this.description || '');
    if (this.selectedFile) {
      body.append('attachment', this.selectedFile);
    }

    if (this.kind === 'BUG' || this.kind === 'PRODUCTION_ISSUE') {
      if (this.reproductionSteps.trim()) {
        body.append('reproductionSteps', this.reproductionSteps.trim());
      }
      if (this.flowJson) {
        body.append('reproductionFlow', this.flowJson);
      }
      if (this.flowImageBlob) {
        body.append('reproductionFlowImage', this.flowImageBlob, 'reproduction_flow.png');
      }
      if (this.flowImageDataUrl) {
        body.append('reproductionFlowImageBase64', this.flowImageDataUrl);
      }
    }

    this.workflow.submit(body).subscribe({
      next: (saved) => {
        this.saving = false;
        this.lastCode = saved.taskCode || '';
        const label = this.kind === 'PRODUCTION_ISSUE' ? 'Production Issue' : (this.kind === 'BUG' ? 'Bug' : 'Task');
        if (this.kind === 'PRODUCTION_ISSUE') {
          this.successMessage = saved.assignedToName
            ? `${label} ${this.lastCode} raised and automatically assigned to Production Support (${saved.assignedToName}).`
            : `${label} ${this.lastCode} raised and routed to Production Support queue.`;
        } else {
          this.successMessage = this.skipsReview
            ? `${label} ${this.lastCode} raised and waiting for a developer to be assigned.`
            : `${label} ${this.lastCode} sent to your team leader for review.`;
        }
        this.resetForm();
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage =
          typeof err?.error === 'string' ? err.error : 'The report could not be sent. Please try again.';
      }
    });
  }

  /** Keeps the outcome on screen while the fields start again. */
  private resetForm(): void {
    this.title = '';
    this.priority = '';
    this.module = '';
    this.subModule = '';
    this.screen = '';
    this.description = '';
    this.clearFile();
    this.clearFlowDiagram();
    this.reproductionSteps = '';
  }

  goToMySubmissions(): void {
    this.router.navigate(['/my-submissions']);
  }
}
