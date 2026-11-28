import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkflowService } from '../../services/workflow.service';
import { isSuperAdminRole, roleFamily } from '../../models/role';
import { catchError, of } from 'rxjs';

export interface PipelineStep {
  id: 'review' | 'assignment' | 'board' | 'completed' | 'onhold' | 'tested';
  label: string;
  shortLabel: string;
  icon: string;
  route: string;
  countKey?: string;
  roles?: string[];
  description: string;
}

@Component({
  selector: 'app-workflow-pipeline',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatTooltipModule],
  templateUrl: './workflow-pipeline.component.html',
  styleUrls: ['./workflow-pipeline.component.css']
})
export class WorkflowPipelineComponent implements OnInit {
  @Input() currentStage: 'review' | 'assignment' | 'board' | 'completed' | 'onhold' | 'tested' = 'review';
  @Input() compact = false;

  private workflow = inject(WorkflowService);

  userRole = (localStorage.getItem('role') || '').toUpperCase();

  counts: Record<string, number> = {
    review: 0,
    assignment: 0,
    board: 0,
    completed: 0,
    onhold: 0,
    tested: 0
  };

  steps: PipelineStep[] = [
    {
      id: 'review',
      label: '1. QA Triage',
      shortLabel: 'Triage',
      icon: 'rate_review',
      route: '/approvals',
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD'],
      description: 'Review incoming tasks & bugs; approve to forward to assignment or reject.'
    },
    {
      id: 'assignment',
      label: '2. Dev Assignment',
      shortLabel: 'Assign',
      icon: 'assignment_ind',
      route: '/triage',
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD'],
      description: 'Approved items waiting for developer assignment and schedule.'
    },
    {
      id: 'board',
      label: '3. In Development',
      shortLabel: 'Dev Board',
      icon: 'view_kanban',
      route: '/tasks',
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'TESTER_LEAD', 'EMPLOYEE', 'TESTER'],
      description: 'Active tickets and bugs being worked on across the workspace.'
    },
    {
      id: 'completed',
      label: '4. Dev Complete / Ready for QA',
      shortLabel: 'Release QA',
      icon: 'inventory_2',
      route: '/developer-completed',
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER_LEAD', 'EMPLOYEE'],
      description: 'Developer completed tickets; reviewed and released to Testing Team.'
    },
    {
      id: 'tested',
      label: '5. QA Verification & Sign-off',
      shortLabel: 'Sign-off',
      icon: 'verified',
      route: '/tested-completed',
      roles: ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD', 'TESTER_LEAD', 'DEVELOPER_LEAD', 'TESTER'],
      description: 'Tasks delivered to testing team for final acceptance or rework.'
    }
  ];

  ngOnInit(): void {
    this.fetchStageCounts();
  }

  get isSuperAdmin(): boolean {
    return isSuperAdminRole(this.userRole);
  }

  fetchStageCounts(): void {
    // 1. Pending Approvals
    this.workflow.approvals().pipe(catchError(() => of([]))).subscribe((items) => {
      this.counts['review'] = (items || []).filter((i: any) => (i.status || '').toUpperCase() === 'PENDING').length;
    });

    // 2. Dev Queue awaiting assignment
    this.workflow.devQueue().pipe(catchError(() => of({ awaiting: 0, assigned: 0, freeDevelopers: 0, items: [] }))).subscribe((res: any) => {
      this.counts['assignment'] = res?.awaiting || 0;
    });

    // 3. Completed dev tasks
    this.workflow.completedTasks().pipe(catchError(() => of({ total: 0, readyToRelease: 0, onHold: 0, items: [] }))).subscribe((res: any) => {
      this.counts['completed'] = res?.readyToRelease ?? res?.total ?? 0;
      this.counts['onhold'] = res?.onHold ?? 0;
    });
  }

  isStepVisible(step: PipelineStep): boolean {
    if (this.isSuperAdmin) return true;
    if (!step.roles || step.roles.length === 0) return true;
    const norm = this.userRole === 'TEAM_LEADER' ? 'TEAM_LEAD' : this.userRole;
    return step.roles.includes(this.userRole) || step.roles.includes(norm);
  }

  getStepRoute(step: PipelineStep): string {
    // Super admin can use the dedicated Hub tabs or standard workflow routes
    return step.route;
  }
}
