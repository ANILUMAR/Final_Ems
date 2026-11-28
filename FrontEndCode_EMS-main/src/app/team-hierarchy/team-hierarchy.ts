import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CandidatesResponse,
  EmployeeCandidate,
  HierarchyService,
  LeadNode,
  MemberNode,
  ProjectMemberDto,
  ProjectPriorityAssignment,
  ProjectRosterDto,
  ProjectTeamAssignRequest,
  TeamHierarchy
} from '../services/hierarchy.service';

@Component({
  selector: 'app-team-hierarchy',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterModule
  ],
  templateUrl: './team-hierarchy.html',
  styleUrls: ['./team-hierarchy.css']
})
export class TeamHierarchyComponent implements OnInit {
  hierarchies: TeamHierarchy[] = [];
  projectRosters: ProjectRosterDto[] = [];
  candidates: CandidatesResponse = {
    allEmployees: [],
    pmCandidates: [],
    devLeads: [],
    testerLeads: [],
    developers: [],
    testers: [],
    projects: []
  };

  loading = true;
  errorMessage = '';
  search = '';
  viewMode: 'PROJECTS' | 'TREE' | 'CARDS' = 'PROJECTS';

  allEmployeeCandidates: EmployeeCandidate[] = [];
  otherDevLeadCandidates: EmployeeCandidate[] = [];
  otherTesterLeadCandidates: EmployeeCandidate[] = [];
  otherMemberCandidates: EmployeeCandidate[] = [];

  currentUserRole = (localStorage.getItem('role') || '').toUpperCase();
  canManage = this.currentUserRole === 'SUPER_ADMIN' || this.currentUserRole === 'ADMIN' || this.currentUserRole === 'PROJECT_MANAGER' || this.currentUserRole === 'TEAM_LEAD' || this.currentUserRole === 'TEAM_LEADER' || this.currentUserRole === 'DEVELOPER_LEAD';
  isSuperAdmin = this.currentUserRole === 'SUPER_ADMIN' || this.currentUserRole === 'ADMIN';
  isProjectManager = this.currentUserRole === 'PROJECT_MANAGER';
  isTeamLead = this.currentUserRole === 'TEAM_LEAD' || this.currentUserRole === 'TEAM_LEADER' || this.currentUserRole === 'DEVELOPER_LEAD';

  isDevLead(role?: string): boolean {
    const r = (role || '').toUpperCase();
    return r === 'DEVELOPER_LEAD' || r === 'TEAM_LEAD' || r === 'TEAM_LEADER';
  }

  activeAssignRoster: ProjectRosterDto | null = null;
  submissionNotesText = '';

  // --- Modal 1: Create Project Modal ---
  showCreateProjectModal = false;
  createProjectForm = {
    name: '',
    description: '',
    pmUserId: null as number | null
  };

  // --- Modal 2: Centralized Project Team Assignment Modal ---
  showProjectAssignModal = false;
  projectAssignTitle = 'Configure Project Team Hierarchy';
  projectAssignForm: ProjectTeamAssignRequest = {
    projectName: '',
    projectDescription: '',
    pmUserId: null,
    pmEmail: '',
    pmName: '',
    pmResponsibilities: '',
    devLeadId: null,
    devLeadEmail: '',
    devLeadName: '',
    devLeadTitle: 'Java Team Leader',
    devLeadResponsibilities: '',
    devLeadProductionSupport: false,
    testerLeadId: null,
    testerLeadEmail: '',
    testerLeadName: '',
    testerLeadTitle: 'Testing Team Leader',
    testerLeadResponsibilities: '',
    testerLeadProductionSupport: false,
    members: []
  };

  // --- Modal 3: PM Modal ---
  showPmModal = false;
  pmModalTitle = 'Add Project Manager';
  pmForm = {
    hierarchyId: '',
    userId: null as number | null,
    email: '',
    name: '',
    pmResponsibilities: '',
    managedProjects: [] as string[]
  };

  // --- Modal 4: Lead Modal ---
  showLeadModal = false;
  leadForm = {
    pmId: '',
    leadType: 'DEVELOPER_LEAD',
    leadId: null as number | null,
    leadEmail: '',
    leadName: '',
    leadTitle: 'Java Team Leader',
    responsibilities: ''
  };

  // --- Modal 5: Member Modal ---
  showMemberModal = false;
  memberModalTitle = 'Map Team Member';
  memberForm = {
    pmId: '',
    leadEmail: '',
    leadRole: '',
    memberId: null as number | null,
    memberEmail: '',
    memberName: '',
    memberRole: 'EMPLOYEE',
    responsibilities: '',
    projectAssignments: [] as ProjectPriorityAssignment[]
  };

  submitting = false;

  constructor(
    private hierarchyService: HierarchyService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      hierarchies: this.hierarchyService.getHierarchies(),
      candidates: this.hierarchyService.getCandidates(),
      rosters: this.hierarchyService.getProjectRosters()
    }).subscribe({
      next: ({ hierarchies, candidates, rosters }) => {
        this.hierarchies = hierarchies || [];
        this.candidates = candidates;
        this.projectRosters = rosters || [];
        this.updateCandidateLists();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load hierarchy data', err);
        this.errorMessage = 'Could not load project assignments and team hierarchy.';
        this.loading = false;
      }
    });
  }

  updateCandidateLists(): void {
    const all = this.candidates.allEmployees && this.candidates.allEmployees.length
      ? this.candidates.allEmployees
      : (this.candidates.pmCandidates || []);
    this.allEmployeeCandidates = all;

    const devLeadSet = new Set((this.candidates.devLeads || []).map((d) => String(d.id)));
    this.otherDevLeadCandidates = all.filter((e) => !devLeadSet.has(String(e.id)));

    const testLeadSet = new Set((this.candidates.testerLeads || []).map((t) => String(t.id)));
    this.otherTesterLeadCandidates = all.filter((e) => !testLeadSet.has(String(e.id)));

    const memberSet = new Set([
      ...(this.candidates.developers || []).map((d) => String(d.id)),
      ...(this.candidates.testers || []).map((t) => String(t.id))
    ]);
    this.otherMemberCandidates = all.filter((e) => !memberSet.has(String(e.id)));
  }

  findCandidate(idOrEmail: any): EmployeeCandidate | undefined {
    if (idOrEmail === null || idOrEmail === undefined || idOrEmail === '') return undefined;
    const str = String(idOrEmail).trim().toLowerCase();
    const all = this.allEmployeeCandidates.length ? this.allEmployeeCandidates : (this.candidates.allEmployees || []);
    return (
      all.find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str)) ||
      (this.candidates.pmCandidates || []).find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str)) ||
      (this.candidates.devLeads || []).find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str)) ||
      (this.candidates.testerLeads || []).find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str)) ||
      (this.candidates.developers || []).find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str)) ||
      (this.candidates.testers || []).find((c) => String(c.id) === String(idOrEmail) || (c.email && c.email.toLowerCase() === str))
    );
  }

  /* ---------- Calculations & Stats ---------- */

  get filteredProjectRosters(): ProjectRosterDto[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.projectRosters;

    return this.projectRosters.filter((r) => {
      const pMatch = r.projectName && r.projectName.toLowerCase().includes(term);
      const descMatch = r.projectDescription && r.projectDescription.toLowerCase().includes(term);
      const pmMatch = (r.pmName && r.pmName.toLowerCase().includes(term)) ||
                      (r.pmEmail && r.pmEmail.toLowerCase().includes(term)) ||
                      (r.pmResponsibilities && r.pmResponsibilities.toLowerCase().includes(term));
      const leadMatch = (r.devLeadName && r.devLeadName.toLowerCase().includes(term)) ||
                        (r.testerLeadName && r.testerLeadName.toLowerCase().includes(term));
      const memberMatch = (r.members || []).some((m) =>
        (m.memberName && m.memberName.toLowerCase().includes(term)) ||
        (m.memberEmail && m.memberEmail.toLowerCase().includes(term)) ||
        (m.responsibilities && m.responsibilities.toLowerCase().includes(term))
      );
      return pMatch || descMatch || pmMatch || leadMatch || memberMatch;
    });
  }

  get filteredHierarchies(): TeamHierarchy[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.hierarchies;

    return this.hierarchies.filter((h) => {
      const pmMatch =
        (h.projectManagerName && h.projectManagerName.toLowerCase().includes(term)) ||
        (h.projectManagerEmail && h.projectManagerEmail.toLowerCase().includes(term)) ||
        (h.pmResponsibilities && h.pmResponsibilities.toLowerCase().includes(term)) ||
        (h.managedProjects || []).some((p) => p.toLowerCase().includes(term));

      const leadMatch = (h.teamLeads || []).some(
        (l) =>
          (l.leadName && l.leadName.toLowerCase().includes(term)) ||
          (l.leadEmail && l.leadEmail.toLowerCase().includes(term)) ||
          (l.leadTitle && l.leadTitle.toLowerCase().includes(term)) ||
          (l.responsibilities && l.responsibilities.toLowerCase().includes(term)) ||
          (l.members || []).some(
            (m) =>
              (m.memberName && m.memberName.toLowerCase().includes(term)) ||
              (m.memberEmail && m.memberEmail.toLowerCase().includes(term)) ||
              (m.responsibilities && m.responsibilities.toLowerCase().includes(term)) ||
              (m.projectAssignments || []).some((pa) => pa.projectName && pa.projectName.toLowerCase().includes(term))
          )
      );

      return pmMatch || leadMatch;
    });
  }

  get totalProjectsCount(): number {
    const fromCandidates = this.candidates && this.candidates.projects ? this.candidates.projects.length : 0;
    const fromRosters = this.projectRosters ? this.projectRosters.length : 0;
    return Math.max(fromCandidates, fromRosters);
  }

  get totalPms(): number {
    return this.hierarchies.length;
  }

  get totalLeads(): number {
    return this.hierarchies.reduce((sum, h) => sum + (h.teamLeads?.length || 0), 0);
  }

  get totalDevelopers(): number {
    let count = 0;
    this.hierarchies.forEach((h) => {
      (h.teamLeads || []).forEach((l) => {
        if (l.leadRole === 'DEVELOPER_LEAD' || l.leadTitle?.toLowerCase().includes('java') || l.leadTitle?.toLowerCase().includes('dev')) {
          count += l.members?.length || 0;
        }
      });
    });
    return count;
  }

  get totalTesters(): number {
    let count = 0;
    this.hierarchies.forEach((h) => {
      (h.teamLeads || []).forEach((l) => {
        if (l.leadRole === 'TESTER_LEAD' || l.leadTitle?.toLowerCase().includes('test')) {
          count += l.members?.length || 0;
        }
      });
    });
    return count;
  }

  get totalProjectAssignments(): number {
    let count = 0;
    this.hierarchies.forEach((h) => {
      (h.teamLeads || []).forEach((l) => {
        (l.members || []).forEach((m) => {
          count += m.projectAssignments?.length || 0;
        });
      });
    });
    return count;
  }

  /* ---------- Modal 1: Create Project ---------- */

  openCreateProjectModal(): void {
    this.createProjectForm = {
      name: '',
      description: '',
      pmUserId: null
    };
    this.showCreateProjectModal = true;
  }

  saveNewProject(): void {
    const name = this.createProjectForm.name?.trim();
    if (!name) {
      this.snackBar.open('Please enter a project name.', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.hierarchyService.createProject({
      name: name,
      description: this.createProjectForm.description?.trim()
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showCreateProjectModal = false;
        this.snackBar.open(`Project "${name}" created successfully! Configure its team hierarchy below.`, 'Close', { duration: 3500 });
        this.loadAll();

        const pmCand = this.createProjectForm.pmUserId ? this.candidates.pmCandidates.find((c) => c.id === this.createProjectForm.pmUserId) : undefined;
        this.openAssignProjectTeamModal({
          projectName: name,
          projectDescription: this.createProjectForm.description?.trim() || '',
          pmId: pmCand ? pmCand.id : undefined,
          pmName: pmCand ? pmCand.name : undefined,
          pmEmail: pmCand ? pmCand.email : undefined,
          members: []
        });
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || err?.error || 'Failed to create project.', 'Close', { duration: 4000 });
      }
    });
  }

  /* ---------- Helpers for candidate categorization and display ---------- */

  otherCandidates(excluded: EmployeeCandidate[] = []): EmployeeCandidate[] {
    const excludedIds = new Set((excluded || []).map((e) => e.id));
    return (this.candidates.allEmployees || []).filter((e) => !excludedIds.has(e.id));
  }

  formatRole(role?: string): string {
    if (!role) return 'Developer';
    const r = role.toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'ADMIN') return 'Super Admin';
    if (r === 'PROJECT_MANAGER') return 'Project Manager';
    if (r === 'TEAM_LEAD' || r === 'TEAM_LEADER') return 'Team Leader';
    if (r === 'DEVELOPER_LEAD') return 'Java Lead';
    if (r === 'TESTER_LEAD') return 'Testing Lead';
    if (r === 'TESTER') return 'Tester';
    return 'Developer';
  }

  rolePillClass(role?: string): string {
    if (!role) return 'th-role-pill--dev';
    const r = role.toUpperCase();
    if (r === 'SUPER_ADMIN' || r === 'ADMIN') return 'th-role-pill--admin';
    if (r === 'PROJECT_MANAGER') return 'th-role-pill--pm';
    if (r === 'TEAM_LEAD' || r === 'TEAM_LEADER' || r === 'DEVELOPER_LEAD') return 'th-role-pill--dev';
    if (r === 'TESTER_LEAD' || r === 'TESTER') return 'th-role-pill--tester';
    return 'th-role-pill--dev';
  }

  onProjectAssignProjectChange(projectName: string): void {
    if (!projectName) return;
    const roster = this.projectRosters.find(r => r.projectName.toLowerCase() === projectName.toLowerCase());
    this.activeAssignRoster = roster || null;
    this.submissionNotesText = roster?.submissionNotes || '';

    if (roster) {
      const pmCand = (roster.pmId || roster.pmEmail) ? this.findCandidate(roster.pmId || roster.pmEmail) : null;
      const devLeadCand = (roster.devLeadId || roster.devLeadEmail) ? this.findCandidate(roster.devLeadId || roster.devLeadEmail) : null;
      const testerLeadCand = (roster.testerLeadId || roster.testerLeadEmail) ? this.findCandidate(roster.testerLeadId || roster.testerLeadEmail) : null;

      this.projectAssignTitle = `Configure Project Team Hierarchy — ${roster.projectName}`;
      this.projectAssignForm = {
        projectName: roster.projectName,
        projectDescription: roster.projectDescription || '',
        pmUserId: pmCand ? Number(pmCand.id) : (roster.pmId ? Number(roster.pmId) : null),
        pmEmail: pmCand ? pmCand.email : (roster.pmEmail || ''),
        pmName: pmCand ? pmCand.name : (roster.pmName || ''),
        pmResponsibilities: roster.pmResponsibilities || '',
        devLeadId: devLeadCand ? Number(devLeadCand.id) : (roster.devLeadId ? Number(roster.devLeadId) : null),
        devLeadEmail: devLeadCand ? devLeadCand.email : (roster.devLeadEmail || ''),
        devLeadName: devLeadCand ? devLeadCand.name : (roster.devLeadName || ''),
        devLeadTitle: roster.devLeadTitle || 'Java Team Leader',
        devLeadResponsibilities: roster.devLeadResponsibilities || '',
        devLeadProductionSupport: !!roster.devLeadProductionSupport,
        testerLeadId: testerLeadCand ? Number(testerLeadCand.id) : (roster.testerLeadId ? Number(roster.testerLeadId) : null),
        testerLeadEmail: testerLeadCand ? testerLeadCand.email : (roster.testerLeadEmail || ''),
        testerLeadName: testerLeadCand ? testerLeadCand.name : (roster.testerLeadName || ''),
        testerLeadTitle: roster.testerLeadTitle || 'Testing Team Leader',
        testerLeadResponsibilities: roster.testerLeadResponsibilities || '',
        testerLeadProductionSupport: !!roster.testerLeadProductionSupport,
        members: (roster.members || []).map((m) => {
          const mCand = this.findCandidate(m.memberId || m.memberEmail);
          return {
            memberId: mCand ? Number(mCand.id) : (m.memberId ? Number(m.memberId) : null),
            memberEmail: mCand ? mCand.email : (m.memberEmail || ''),
            memberName: mCand ? mCand.name : (m.memberName || ''),
            memberRole: m.memberRole || 'EMPLOYEE',
            responsibilities: m.responsibilities || '',
            priority: m.priority || 'HIGH',
            allocation: m.allocation ? Number(m.allocation) : 100,
            notes: m.notes || '',
            productionSupport: !!m.productionSupport
          };
        })
      };
    } else {
      this.projectAssignTitle = `Configure Project Team Hierarchy — ${projectName}`;
      this.projectAssignForm = {
        projectName: projectName,
        projectDescription: '',
        pmUserId: null,
        pmEmail: '',
        pmName: '',
        pmResponsibilities: '',
        devLeadId: null,
        devLeadEmail: '',
        devLeadName: '',
        devLeadTitle: 'Java Team Leader',
        devLeadResponsibilities: '',
        testerLeadId: null,
        testerLeadEmail: '',
        testerLeadName: '',
        testerLeadTitle: 'Testing Team Leader',
        testerLeadResponsibilities: '',
        members: []
      };
    }
  }

  /* ---------- Modal 2: Centralized Project Team Assignment ---------- */

  openAssignProjectTeamModal(roster?: ProjectRosterDto): void {
    this.activeAssignRoster = roster || null;
    this.submissionNotesText = roster?.submissionNotes || '';

    if (roster) {
      const pmCand = (roster.pmId || roster.pmEmail) ? this.findCandidate(roster.pmId || roster.pmEmail) : null;
      const devLeadCand = (roster.devLeadId || roster.devLeadEmail) ? this.findCandidate(roster.devLeadId || roster.devLeadEmail) : null;
      const testerLeadCand = (roster.testerLeadId || roster.testerLeadEmail) ? this.findCandidate(roster.testerLeadId || roster.testerLeadEmail) : null;

      this.projectAssignTitle = `Configure Project Team Hierarchy — ${roster.projectName}`;
      this.projectAssignForm = {
        projectName: roster.projectName,
        projectDescription: roster.projectDescription || '',
        pmUserId: pmCand ? Number(pmCand.id) : (roster.pmId ? Number(roster.pmId) : null),
        pmEmail: pmCand ? pmCand.email : (roster.pmEmail || ''),
        pmName: pmCand ? pmCand.name : (roster.pmName || ''),
        pmResponsibilities: roster.pmResponsibilities || '',
        devLeadId: devLeadCand ? Number(devLeadCand.id) : (roster.devLeadId ? Number(roster.devLeadId) : null),
        devLeadEmail: devLeadCand ? devLeadCand.email : (roster.devLeadEmail || ''),
        devLeadName: devLeadCand ? devLeadCand.name : (roster.devLeadName || ''),
        devLeadTitle: roster.devLeadTitle || 'Java Team Leader',
        devLeadResponsibilities: roster.devLeadResponsibilities || '',
        devLeadProductionSupport: !!roster.devLeadProductionSupport,
        testerLeadId: testerLeadCand ? Number(testerLeadCand.id) : (roster.testerLeadId ? Number(roster.testerLeadId) : null),
        testerLeadEmail: testerLeadCand ? testerLeadCand.email : (roster.testerLeadEmail || ''),
        testerLeadName: testerLeadCand ? testerLeadCand.name : (roster.testerLeadName || ''),
        testerLeadTitle: roster.testerLeadTitle || 'Testing Team Leader',
        testerLeadResponsibilities: roster.testerLeadResponsibilities || '',
        testerLeadProductionSupport: !!roster.testerLeadProductionSupport,
        members: (roster.members || []).map((m) => {
          const mCand = this.findCandidate(m.memberId || m.memberEmail);
          return {
            memberId: mCand ? Number(mCand.id) : (m.memberId ? Number(m.memberId) : null),
            memberEmail: mCand ? mCand.email : (m.memberEmail || ''),
            memberName: mCand ? mCand.name : (m.memberName || ''),
            memberRole: m.memberRole || 'EMPLOYEE',
            responsibilities: m.responsibilities || '',
            priority: m.priority || 'HIGH',
            allocation: m.allocation ? Number(m.allocation) : 100,
            notes: m.notes || '',
            productionSupport: !!m.productionSupport
          };
        })
      };
    } else {
      const defaultProj = (this.candidates.projects && this.candidates.projects.length) ? this.candidates.projects[0] : '';
      const existing = defaultProj ? this.projectRosters.find(r => r.projectName.toLowerCase() === defaultProj.toLowerCase()) : null;
      if (existing) {
        this.openAssignProjectTeamModal(existing);
        return;
      }

      this.projectAssignTitle = defaultProj ? `Configure Project Team Hierarchy — ${defaultProj}` : 'Configure Project Team Hierarchy';
      this.projectAssignForm = {
        projectName: defaultProj,
        projectDescription: '',
        pmUserId: null,
        pmEmail: '',
        pmName: '',
        pmResponsibilities: '',
        devLeadId: null,
        devLeadEmail: '',
        devLeadName: '',
        devLeadTitle: 'Java Team Leader',
        devLeadResponsibilities: '',
        testerLeadId: null,
        testerLeadEmail: '',
        testerLeadName: '',
        testerLeadTitle: 'Testing Team Leader',
        testerLeadResponsibilities: '',
        members: []
      };
    }

    this.showProjectAssignModal = true;
  }

  onProjectAssignPmSelect(userId: any): void {
    if (userId === null || userId === undefined || userId === '') {
      this.projectAssignForm.pmUserId = null;
      this.projectAssignForm.pmEmail = '';
      this.projectAssignForm.pmName = '';
      return;
    }
    const idNum = Number(userId);
    this.projectAssignForm.pmUserId = idNum;
    const cand = this.findCandidate(idNum);
    if (cand) {
      this.projectAssignForm.pmEmail = cand.email;
      this.projectAssignForm.pmName = cand.name;
    }
  }

  onProjectAssignDevLeadSelect(leadId: any): void {
    if (leadId === null || leadId === undefined || leadId === '') {
      this.projectAssignForm.devLeadId = null;
      this.projectAssignForm.devLeadEmail = '';
      this.projectAssignForm.devLeadName = '';
      return;
    }
    const idNum = Number(leadId);
    this.projectAssignForm.devLeadId = idNum;
    const cand = this.findCandidate(idNum);
    if (cand) {
      this.projectAssignForm.devLeadEmail = cand.email;
      this.projectAssignForm.devLeadName = cand.name;
    }
  }

  onProjectAssignTesterLeadSelect(leadId: any): void {
    if (leadId === null || leadId === undefined || leadId === '') {
      this.projectAssignForm.testerLeadId = null;
      this.projectAssignForm.testerLeadEmail = '';
      this.projectAssignForm.testerLeadName = '';
      return;
    }
    const idNum = Number(leadId);
    this.projectAssignForm.testerLeadId = idNum;
    const cand = this.findCandidate(idNum);
    if (cand) {
      this.projectAssignForm.testerLeadEmail = cand.email;
      this.projectAssignForm.testerLeadName = cand.name;
    }
  }

  addMemberToProjectAssign(): void {
    this.projectAssignForm.members.push({
      memberId: null,
      memberEmail: '',
      memberName: '',
      memberRole: 'EMPLOYEE',
      responsibilities: '',
      priority: 'HIGH',
      allocation: 100,
      notes: '',
      productionSupport: false
    });
  }

  removeMemberFromProjectAssign(idx: number): void {
    this.projectAssignForm.members.splice(idx, 1);
  }

  onProjectMemberSelect(idx: number, userId: any): void {
    const row = this.projectAssignForm.members[idx];
    if (!row) return;

    if (userId === null || userId === undefined || userId === '') {
      row.memberId = null;
      row.memberEmail = '';
      row.memberName = '';
      return;
    }

    const idNum = Number(userId);
    row.memberId = idNum;
    const cand = this.findCandidate(idNum);
    if (cand) {
      row.memberEmail = cand.email;
      row.memberName = cand.name;
      const isTester = (cand.role || '').toUpperCase().includes('TEST');
      row.memberRole = isTester ? 'TESTER' : 'EMPLOYEE';
      if (!row.priority) {
        row.priority = 'HIGH';
      }
      if (!row.allocation) {
        row.allocation = 100;
      }
    }
  }

  saveProjectTeamAssignment(action: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE' = 'SAVE_DRAFT'): void {
    const projectName = this.projectAssignForm.projectName?.trim();
    if (!projectName) {
      this.snackBar.open('Please select or specify a target project.', 'Close', { duration: 3000 });
      return;
    }

    // Ensure PM details are synchronized if ID is present
    if (this.projectAssignForm.pmUserId) {
      const pmCand = this.findCandidate(this.projectAssignForm.pmUserId);
      if (pmCand) {
        this.projectAssignForm.pmEmail = pmCand.email;
        this.projectAssignForm.pmName = pmCand.name;
      }
    } else {
      this.projectAssignForm.pmEmail = '';
      this.projectAssignForm.pmName = '';
    }

    // Ensure Dev Lead details are synchronized
    if (this.projectAssignForm.devLeadId) {
      const devCand = this.findCandidate(this.projectAssignForm.devLeadId);
      if (devCand) {
        this.projectAssignForm.devLeadEmail = devCand.email;
        this.projectAssignForm.devLeadName = devCand.name;
      }
    } else {
      this.projectAssignForm.devLeadEmail = '';
      this.projectAssignForm.devLeadName = '';
    }

    // Ensure Tester Lead details are synchronized
    if (this.projectAssignForm.testerLeadId) {
      const testCand = this.findCandidate(this.projectAssignForm.testerLeadId);
      if (testCand) {
        this.projectAssignForm.testerLeadEmail = testCand.email;
        this.projectAssignForm.testerLeadName = testCand.name;
      }
    } else {
      this.projectAssignForm.testerLeadEmail = '';
      this.projectAssignForm.testerLeadName = '';
    }

    // Filter and sanitize member rows
    const cleanMembers = (this.projectAssignForm.members || [])
      .filter((m) => m.memberId || (m.memberEmail && m.memberEmail.trim().length > 0))
      .map((m) => {
        let email = m.memberEmail;
        let name = m.memberName;
        let id = m.memberId ? Number(m.memberId) : null;
        if (m.memberId) {
          const mCand = this.findCandidate(m.memberId);
          if (mCand) {
            email = mCand.email;
            name = mCand.name;
            id = Number(mCand.id);
          }
        }
        return {
          memberId: id,
          memberEmail: email,
          memberName: name,
          memberRole: m.memberRole || 'EMPLOYEE',
          responsibilities: (m.responsibilities || '').trim(),
          priority: m.priority || 'HIGH',
          allocation: m.allocation ? Number(m.allocation) : 100,
          notes: (m.responsibilities || '').trim(),
          productionSupport: !!m.productionSupport
        };
      });

    const payload: ProjectTeamAssignRequest = {
      ...this.projectAssignForm,
      projectName: projectName,
      approvalAction: action,
      notes: (this.submissionNotesText || '').trim(),
      pmUserId: this.projectAssignForm.pmUserId ? Number(this.projectAssignForm.pmUserId) : null,
      pmResponsibilities: (this.projectAssignForm.pmResponsibilities || '').trim(),
      devLeadId: this.projectAssignForm.devLeadId ? Number(this.projectAssignForm.devLeadId) : null,
      devLeadResponsibilities: (this.projectAssignForm.devLeadResponsibilities || '').trim(),
      devLeadProductionSupport: !!this.projectAssignForm.devLeadProductionSupport,
      testerLeadId: this.projectAssignForm.testerLeadId ? Number(this.projectAssignForm.testerLeadId) : null,
      testerLeadResponsibilities: (this.projectAssignForm.testerLeadResponsibilities || '').trim(),
      testerLeadProductionSupport: !!this.projectAssignForm.testerLeadProductionSupport,
      members: cleanMembers
    };

    this.submitting = true;
    this.hierarchyService.assignProjectTeam(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.showProjectAssignModal = false;
        let msg = `Team hierarchy updated for "${projectName}".`;
        if (action === 'SUBMIT') {
          msg = `Team hierarchy submitted to CEO/Director for approval! Work authorization pending.`;
        } else if (action === 'APPROVE') {
          msg = `Team hierarchy APPROVED! Project work is now officially authorized to begin.`;
        } else if (action === 'SAVE_DRAFT') {
          msg = `Team hierarchy saved as Draft for "${projectName}".`;
        }
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || err?.error || 'Failed to assign project team.', 'Close', { duration: 4000 });
      }
    });
  }

  submitProjectForApproval(roster: ProjectRosterDto, notes?: string): void {
    if (!roster?.projectName) return;
    this.submitting = true;
    this.hierarchyService.submitProjectHierarchy(roster.projectName, notes).subscribe({
      next: () => {
        this.submitting = false;
        this.snackBar.open(`Team hierarchy for "${roster.projectName}" submitted to CEO/Director for approval.`, 'Close', { duration: 4000 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to submit hierarchy.', 'Close', { duration: 4000 });
      }
    });
  }

  approveProjectHierarchy(roster: ProjectRosterDto, remarks?: string): void {
    if (!roster?.projectName) return;
    if (!confirm(`Are you sure you want to APPROVE the team hierarchy for "${roster.projectName}"?\n\nThis gives official CEO/Director authorization to begin project work.`)) {
      return;
    }
    this.submitting = true;
    this.hierarchyService.approveProjectHierarchy(roster.projectName, remarks).subscribe({
      next: () => {
        this.submitting = false;
        this.snackBar.open(`Team hierarchy APPROVED for "${roster.projectName}"! Project work is now officially authorized.`, 'Close', { duration: 4500 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to approve hierarchy.', 'Close', { duration: 4000 });
      }
    });
  }

  rejectProjectHierarchy(roster: ProjectRosterDto): void {
    if (!roster?.projectName) return;
    const remarks = prompt(`Enter reason / feedback for requesting revisions on "${roster.projectName}" team hierarchy:`, 'Please review lead and member allocation and resubmit.');
    if (remarks === null) return;
    this.submitting = true;
    this.hierarchyService.rejectProjectHierarchy(roster.projectName, remarks).subscribe({
      next: () => {
        this.submitting = false;
        this.snackBar.open(`Team hierarchy for "${roster.projectName}" returned to Project Manager for revision.`, 'Close', { duration: 4500 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to reject hierarchy.', 'Close', { duration: 4000 });
      }
    });
  }

  unassignMemberFromProject(roster: ProjectRosterDto, member: ProjectMemberDto): void {
    if (!confirm(`Are you sure you want to remove ${member.memberName} from ${roster.projectName}?`)) {
      return;
    }
    this.hierarchyService.unassignProjectMember(roster.projectName, member.memberEmail).subscribe({
      next: () => {
        this.snackBar.open(`Removed ${member.memberName} from ${roster.projectName}.`, 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || `Failed to remove ${member.memberName}.`, 'Close', { duration: 4000 });
      }
    });
  }

  unassignLeadFromProject(roster: ProjectRosterDto, leadRole: string): void {
    const roleName = leadRole === 'DEVELOPER_LEAD' ? 'Java Team Leader' : 'Testing Team Leader';
    if (!confirm(`Are you sure you want to unassign the ${roleName} from ${roster.projectName}?`)) {
      return;
    }
    this.hierarchyService.unassignProjectLead(roster.projectName, leadRole).subscribe({
      next: () => {
        this.snackBar.open(`${roleName} unassigned from ${roster.projectName}.`, 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || `Failed to unassign ${roleName}.`, 'Close', { duration: 4000 });
      }
    });
  }

  unassignPmFromProject(roster: ProjectRosterDto): void {
    if (!confirm(`Are you sure you want to unassign Project Manager ${roster.pmName || ''} from ${roster.projectName}?`)) {
      return;
    }
    this.hierarchyService.unassignProjectLead(roster.projectName, 'PROJECT_MANAGER').subscribe({
      next: () => {
        this.snackBar.open(`Project Manager unassigned from ${roster.projectName}.`, 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to unassign Project Manager.', 'Close', { duration: 4000 });
      }
    });
  }

  clearProjectHierarchy(roster: ProjectRosterDto): void {
    if (!confirm(`Are you sure you want to clear ALL team hierarchy assignments (Manager, Leads, Developers, Testers) for project "${roster.projectName}"? The project itself will remain registered.`)) {
      return;
    }
    this.hierarchyService.clearProjectHierarchy(roster.projectName).subscribe({
      next: () => {
        this.snackBar.open(`All team hierarchy assignments cleared for "${roster.projectName}".`, 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to clear project hierarchy.', 'Close', { duration: 4000 });
      }
    });
  }

  clearProjectHierarchyFromModal(): void {
    const projectName = this.projectAssignForm.projectName;
    if (!projectName) return;
    if (!confirm(`Are you sure you want to reset all team assignments for "${projectName}"?`)) {
      return;
    }
    this.hierarchyService.clearProjectHierarchy(projectName).subscribe({
      next: () => {
        this.showProjectAssignModal = false;
        this.snackBar.open(`Assignments reset for "${projectName}".`, 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || 'Failed to reset assignments.', 'Close', { duration: 4000 });
      }
    });
  }

  deleteProject(roster: ProjectRosterDto): void {
    if (!confirm(`Are you sure you want to completely DELETE project "${roster.projectName}" and all its hierarchy assignments? This action cannot be undone.`)) {
      return;
    }
    this.hierarchyService.deleteProject(roster.projectName).subscribe({
      next: () => {
        this.snackBar.open(`Project "${roster.projectName}" and all hierarchy assignments deleted.`, 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || `Failed to delete project "${roster.projectName}".`, 'Close', { duration: 4000 });
      }
    });
  }

  openEditProjectMember(roster: ProjectRosterDto, member: ProjectMemberDto): void {
    this.openAssignProjectTeamModal(roster);
  }

  /* ---------- Modals: Project Manager ---------- */

  openAddPmModal(): void {
    this.pmModalTitle = 'Designate Project Manager';
    this.pmForm = {
      hierarchyId: '',
      userId: null,
      email: '',
      name: '',
      pmResponsibilities: '',
      managedProjects: []
    };
    this.showPmModal = true;
  }

  openEditPmProjects(h: TeamHierarchy): void {
    this.pmModalTitle = `Edit Projects for ${h.projectManagerName}`;
    this.pmForm = {
      hierarchyId: h.id,
      userId: h.projectManagerId,
      email: h.projectManagerEmail,
      name: h.projectManagerName,
      pmResponsibilities: h.pmResponsibilities || '',
      managedProjects: [...(h.managedProjects || [])]
    };
    this.showPmModal = true;
  }

  onPmSelect(userId: any): void {
    if (userId === null || userId === undefined || userId === '') {
      this.pmForm.userId = null;
      this.pmForm.email = '';
      this.pmForm.name = '';
      return;
    }
    const cand = this.findCandidate(userId);
    if (cand) {
      this.pmForm.userId = cand.id;
      this.pmForm.email = cand.email;
      this.pmForm.name = cand.name;
    }
  }

  saveProjectManager(): void {
    if (this.pmForm.userId && !this.pmForm.email) {
      const cand = this.findCandidate(this.pmForm.userId);
      if (cand) {
        this.pmForm.email = cand.email;
        this.pmForm.name = cand.name;
      }
    }
    if (!this.pmForm.email) {
      this.snackBar.open('Please select an employee for the Project Manager role.', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.hierarchyService.saveProjectManager({
      userId: this.pmForm.userId || undefined,
      email: this.pmForm.email,
      name: this.pmForm.name,
      pmResponsibilities: this.pmForm.pmResponsibilities,
      managedProjects: this.pmForm.managedProjects
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showPmModal = false;
        this.snackBar.open('Project Manager saved successfully.', 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to save Project Manager.', 'Close', { duration: 4000 });
      }
    });
  }

  deleteProjectManager(h: TeamHierarchy): void {
    if (!confirm(`Are you sure you want to remove Project Manager ${h.projectManagerName} and this hierarchy mapping?`)) {
      return;
    }

    this.hierarchyService.deleteProjectManager(h.id).subscribe({
      next: () => {
        this.snackBar.open('Project Manager hierarchy removed.', 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: () => {
        this.snackBar.open('Failed to remove Project Manager.', 'Close', { duration: 3000 });
      }
    });
  }

  /* ---------- Modals: Team Leader ---------- */

  openAssignLeadModal(h: TeamHierarchy): void {
    this.leadForm = {
      pmId: h.id,
      leadType: 'DEVELOPER_LEAD',
      leadId: null,
      leadEmail: '',
      leadName: '',
      leadTitle: 'Java Team Leader',
      responsibilities: ''
    };
    this.showLeadModal = true;
  }

  onLeadTypeChange(): void {
    this.leadForm.leadId = null;
    this.leadForm.leadEmail = '';
    this.leadForm.leadName = '';
    if (this.leadForm.leadType === 'TESTER_LEAD') {
      this.leadForm.leadTitle = 'Testing Team Leader';
    } else if (this.leadForm.leadType === 'TEAM_LEAD') {
      this.leadForm.leadTitle = 'Team Leader';
    } else {
      this.leadForm.leadTitle = 'Java Team Leader';
    }
  }

  get availableLeadsForType(): EmployeeCandidate[] {
    if (this.leadForm.leadType === 'TESTER_LEAD') {
      return this.candidates.testerLeads && this.candidates.testerLeads.length ? this.candidates.testerLeads : [];
    }
    if (this.leadForm.leadType === 'TEAM_LEAD') {
      const candidates = this.allEmployeeCandidates.filter(e => {
        const r = (e.role || '').toUpperCase();
        return r === 'TEAM_LEAD' || r === 'TEAM_LEADER' || r === 'DEVELOPER_LEAD' || r === 'TESTER_LEAD';
      });
      return candidates.length ? candidates : this.allEmployeeCandidates;
    }
    return this.candidates.devLeads && this.candidates.devLeads.length ? this.candidates.devLeads : [];
  }

  get otherLeadsForType(): EmployeeCandidate[] {
    const leadSet = new Set(this.availableLeadsForType.map(l => String(l.id)));
    return this.allEmployeeCandidates.filter(e => !leadSet.has(String(e.id)));
  }

  onLeadSelect(leadId: any): void {
    if (leadId === null || leadId === undefined || leadId === '') {
      this.leadForm.leadId = null;
      this.leadForm.leadEmail = '';
      this.leadForm.leadName = '';
      return;
    }
    const cand = this.findCandidate(leadId);
    if (cand) {
      this.leadForm.leadId = cand.id;
      this.leadForm.leadEmail = cand.email;
      this.leadForm.leadName = cand.name;
    }
  }

  saveLead(): void {
    if (this.leadForm.leadId && !this.leadForm.leadEmail) {
      const cand = this.findCandidate(this.leadForm.leadId);
      if (cand) {
        this.leadForm.leadEmail = cand.email;
        this.leadForm.leadName = cand.name;
      }
    }
    if (!this.leadForm.leadEmail) {
      this.snackBar.open('Please select a Team Leader.', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    this.hierarchyService.assignLead(this.leadForm.pmId, {
      leadId: this.leadForm.leadId || undefined,
      leadEmail: this.leadForm.leadEmail,
      leadName: this.leadForm.leadName,
      leadRole: this.leadForm.leadType,
      leadTitle: this.leadForm.leadTitle,
      responsibilities: this.leadForm.responsibilities
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showLeadModal = false;
        this.snackBar.open('Team Leader assigned under Project Manager.', 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to assign Team Leader.', 'Close', { duration: 4000 });
      }
    });
  }

  removeLead(pmId: string, lead: LeadNode): void {
    if (!confirm(`Remove ${lead.leadTitle} (${lead.leadName}) and all mapped members from this Project Manager?`)) {
      return;
    }

    this.hierarchyService.removeLead(pmId, lead.leadEmail).subscribe({
      next: () => {
        this.snackBar.open('Team Leader removed.', 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: () => {
        this.snackBar.open('Failed to remove Team Leader.', 'Close', { duration: 3000 });
      }
    });
  }

  /* ---------- Modals: Team Member & Cross-Project Priorities ---------- */

  openMapMemberModal(h: TeamHierarchy, lead: LeadNode): void {
    const isTest = lead.leadRole === 'TESTER_LEAD' || lead.leadTitle?.toLowerCase().includes('test');
    this.memberModalTitle = `Map ${isTest ? 'Tester' : 'Developer'} to ${lead.leadTitle} (${lead.leadName})`;

    this.memberForm = {
      pmId: h.id,
      leadEmail: lead.leadEmail,
      leadRole: lead.leadRole,
      memberId: null,
      memberEmail: '',
      memberName: '',
      memberRole: isTest ? 'TESTER' : 'EMPLOYEE',
      responsibilities: '',
      projectAssignments: [
        { projectName: (h.managedProjects && h.managedProjects[0]) || (this.candidates.projects[0] || ''), priority: 'HIGH', allocation: 100, notes: '', responsibilities: '' }
      ]
    };
    this.showMemberModal = true;
  }

  openEditMember(h: TeamHierarchy, lead: LeadNode, member: MemberNode): void {
    const isTest = lead.leadRole === 'TESTER_LEAD' || lead.leadTitle?.toLowerCase().includes('test');
    this.memberModalTitle = `Edit Priorities & Responsibilities for ${member.memberName}`;

    this.memberForm = {
      pmId: h.id,
      leadEmail: lead.leadEmail,
      leadRole: lead.leadRole,
      memberId: member.memberId,
      memberEmail: member.memberEmail,
      memberName: member.memberName,
      memberRole: member.memberRole || (isTest ? 'TESTER' : 'EMPLOYEE'),
      responsibilities: member.responsibilities || '',
      projectAssignments: member.projectAssignments && member.projectAssignments.length > 0
        ? member.projectAssignments.map((pa) => ({ ...pa }))
        : [{ projectName: (h.managedProjects && h.managedProjects[0]) || '', priority: 'HIGH', allocation: 100, notes: '', responsibilities: '' }]
    };
    this.showMemberModal = true;
  }

  get availableMembersForLead(): EmployeeCandidate[] {
    const isTest = this.memberForm.leadRole === 'TESTER_LEAD';
    return isTest
      ? (this.candidates.testers && this.candidates.testers.length ? this.candidates.testers : [])
      : (this.candidates.developers && this.candidates.developers.length ? this.candidates.developers : []);
  }

  get otherMembersForLead(): EmployeeCandidate[] {
    const memberSet = new Set(this.availableMembersForLead.map(m => String(m.id)));
    return this.allEmployeeCandidates.filter(e => !memberSet.has(String(e.id)));
  }

  onMemberSelect(memberId: any): void {
    if (memberId === null || memberId === undefined || memberId === '') {
      this.memberForm.memberId = null;
      this.memberForm.memberEmail = '';
      this.memberForm.memberName = '';
      return;
    }
    const cand = this.findCandidate(memberId);
    if (cand) {
      this.memberForm.memberId = cand.id;
      this.memberForm.memberEmail = cand.email;
      this.memberForm.memberName = cand.name;
    }
  }

  addProjectAssignmentRow(): void {
    const defProj = this.candidates.projects[0] || '';
    this.memberForm.projectAssignments.push({
      projectName: defProj,
      priority: 'MEDIUM',
      allocation: 50,
      notes: '',
      responsibilities: ''
    });
  }

  removeProjectAssignmentRow(idx: number): void {
    if (this.memberForm.projectAssignments.length > 1) {
      this.memberForm.projectAssignments.splice(idx, 1);
    }
  }

  saveMember(): void {
    if (this.memberForm.memberId && !this.memberForm.memberEmail) {
      const cand = this.findCandidate(this.memberForm.memberId);
      if (cand) {
        this.memberForm.memberEmail = cand.email;
        this.memberForm.memberName = cand.name;
      }
    }
    if (!this.memberForm.memberEmail) {
      this.snackBar.open('Please select a team member.', 'Close', { duration: 3000 });
      return;
    }

    for (let i = 0; i < this.memberForm.projectAssignments.length; i++) {
      const pa = this.memberForm.projectAssignments[i];
      if (!pa.projectName || !pa.projectName.trim()) {
        this.snackBar.open(`Project assignment #${i + 1}: Please pick a project.`, 'Close', { duration: 3000 });
        return;
      }
    }

    this.submitting = true;
    this.hierarchyService.mapMember(this.memberForm.pmId, this.memberForm.leadEmail, {
      memberId: this.memberForm.memberId || undefined,
      memberEmail: this.memberForm.memberEmail,
      memberName: this.memberForm.memberName,
      memberRole: this.memberForm.memberRole,
      responsibilities: this.memberForm.responsibilities,
      projectAssignments: this.memberForm.projectAssignments
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.showMemberModal = false;
        this.snackBar.open('Team member and cross-project priorities mapped successfully.', 'Close', { duration: 3500 });
        this.loadAll();
      },
      error: (err) => {
        this.submitting = false;
        this.snackBar.open(err?.error?.message || 'Failed to map team member.', 'Close', { duration: 4000 });
      }
    });
  }

  removeMember(pmId: string, leadEmail: string, member: MemberNode): void {
    if (!confirm(`Remove ${member.memberName} from this team leader?`)) {
      return;
    }

    this.hierarchyService.removeMember(pmId, leadEmail, member.memberEmail).subscribe({
      next: () => {
        this.snackBar.open('Member unmapped.', 'Close', { duration: 3000 });
        this.loadAll();
      },
      error: () => {
        this.snackBar.open('Failed to unmap member.', 'Close', { duration: 3000 });
      }
    });
  }

  /* ---------- Helpers ---------- */

  initials(name?: string): string {
    const parts = (name || '?').split(/[\s.@]+/).filter((p) => !!p);
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
  }

  priorityClass(priority?: string): string {
    switch ((priority || '').toUpperCase()) {
      case 'HIGH': return 'th-prio--high';
      case 'MEDIUM': return 'th-prio--medium';
      case 'LOW': return 'th-prio--low';
      default: return 'th-prio--default';
    }
  }
}
