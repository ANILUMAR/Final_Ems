import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProjectPriorityAssignment {
  projectName: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  allocation?: number | null;
  notes?: string | null;
  responsibilities?: string | null;
  productionSupport?: boolean;
}

export interface MemberNode {
  memberId: number;
  memberName: string;
  memberEmail: string;
  memberRole: string;
  responsibilities?: string;
  productionSupport?: boolean;
  projectAssignments: ProjectPriorityAssignment[];
}

export interface LeadNode {
  leadId: number;
  leadName: string;
  leadEmail: string;
  leadRole: string;
  leadTitle: string;
  responsibilities?: string;
  productionSupport?: boolean;
  members: MemberNode[];
}

export interface TeamHierarchy {
  id: string;
  projectManagerId: number;
  projectManagerName: string;
  projectManagerEmail: string;
  pmResponsibilities?: string;
  managedProjects: string[];
  teamLeads: LeadNode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectMemberDto {
  memberId: number;
  memberName: string;
  memberEmail: string;
  memberRole: string;
  responsibilities?: string;
  priority: string;
  allocation: number;
  notes?: string;
  productionSupport?: boolean;
  reportingLeadEmail: string;
  reportingLeadName: string;
  reportingLeadTitle: string;
}

export interface ProjectRosterDto {
  projectName: string;
  projectDescription?: string;
  pmId?: number;
  pmName?: string;
  pmEmail?: string;
  pmResponsibilities?: string;
  devLeadId?: number;
  devLeadName?: string;
  devLeadEmail?: string;
  devLeadTitle?: string;
  devLeadResponsibilities?: string;
  devLeadProductionSupport?: boolean;
  testerLeadId?: number;
  testerLeadName?: string;
  testerLeadEmail?: string;
  testerLeadTitle?: string;
  testerLeadResponsibilities?: string;
  testerLeadProductionSupport?: boolean;
  // Approval and Work Authorization fields
  approvalStatus?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  submissionNotes?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionRemarks?: string;
  workAuthorized?: boolean;
  // User-specific assignment context
  myRoleOnProject?: string;
  myResponsibilities?: string;
  myAllocation?: number;
  myPriority?: string;
  members: ProjectMemberDto[];
}

export interface ProjectTeamAssignRequest {
  projectName: string;
  projectDescription?: string;
  pmUserId?: number | null;
  pmEmail?: string;
  pmName?: string;
  pmResponsibilities?: string;
  devLeadId?: number | null;
  devLeadEmail?: string;
  devLeadName?: string;
  devLeadTitle?: string;
  devLeadResponsibilities?: string;
  devLeadProductionSupport?: boolean;
  testerLeadId?: number | null;
  testerLeadEmail?: string;
  testerLeadName?: string;
  testerLeadTitle?: string;
  testerLeadResponsibilities?: string;
  testerLeadProductionSupport?: boolean;
  // Workflow action
  approvalAction?: 'SAVE_DRAFT' | 'SUBMIT' | 'APPROVE' | string;
  notes?: string;
  members: Array<{
    memberId?: number | null;
    memberEmail: string;
    memberName?: string;
    memberRole: string;
    responsibilities?: string;
    priority: string;
    allocation: number;
    notes?: string;
    productionSupport?: boolean;
  }>;
}

export interface EmployeeCandidate {
  id: number;
  name: string;
  email: string;
  role: string;
  roleLabel?: string;
  initials?: string;
  phoneNumber?: string;
}

export interface CandidatesResponse {
  allEmployees?: EmployeeCandidate[];
  pmCandidates: EmployeeCandidate[];
  devLeads: EmployeeCandidate[];
  testerLeads: EmployeeCandidate[];
  developers: EmployeeCandidate[];
  testers: EmployeeCandidate[];
  projects: string[];
}

@Injectable({
  providedIn: 'root'
})
export class HierarchyService {
  private apiUrl = 'http://localhost:9001/api/hierarchy';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
  }

  getHierarchies(): Observable<TeamHierarchy[]> {
    return this.http.get<TeamHierarchy[]>(this.apiUrl, { headers: this.headers() });
  }

  getHierarchyById(id: string): Observable<TeamHierarchy> {
    return this.http.get<TeamHierarchy>(`${this.apiUrl}/${id}`, { headers: this.headers() });
  }

  getCandidates(): Observable<CandidatesResponse> {
    return this.http.get<CandidatesResponse>(`${this.apiUrl}/candidates`, { headers: this.headers() });
  }

  getProjectRosters(): Observable<ProjectRosterDto[]> {
    return this.http.get<ProjectRosterDto[]>(`${this.apiUrl}/projects`, { headers: this.headers() });
  }

  getMyProjects(): Observable<ProjectRosterDto[]> {
    return this.http.get<ProjectRosterDto[]>(`${this.apiUrl}/my-projects`, { headers: this.headers() });
  }

  createProject(data: { name: string; description?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/projects/create`, data, { headers: this.headers() });
  }

  assignProjectTeam(data: ProjectTeamAssignRequest): Observable<ProjectRosterDto> {
    return this.http.post<ProjectRosterDto>(`${this.apiUrl}/projects/assign`, data, { headers: this.headers() });
  }

  submitProjectHierarchy(projectName: string, notes?: string): Observable<ProjectRosterDto> {
    return this.http.post<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/submit`, { notes: notes || '' }, { headers: this.headers() });
  }

  approveProjectHierarchy(projectName: string, remarks?: string): Observable<ProjectRosterDto> {
    return this.http.post<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/approve`, { remarks: remarks || '' }, { headers: this.headers() });
  }

  rejectProjectHierarchy(projectName: string, remarks: string): Observable<ProjectRosterDto> {
    return this.http.post<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/reject`, { remarks: remarks || '' }, { headers: this.headers() });
  }

  getProjectApproval(projectName: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/approval`, { headers: this.headers() });
  }

  unassignProjectMember(projectName: string, memberEmail: string): Observable<ProjectRosterDto> {
    return this.http.delete<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/members/${encodeURIComponent(memberEmail)}`, { headers: this.headers() });
  }

  clearProjectHierarchy(projectName: string): Observable<ProjectRosterDto> {
    return this.http.delete<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/assignment`, { headers: this.headers() });
  }

  deleteProject(projectName: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}`, { headers: this.headers() });
  }

  unassignProjectLead(projectName: string, leadRole: string): Observable<ProjectRosterDto> {
    return this.http.delete<ProjectRosterDto>(`${this.apiUrl}/projects/${encodeURIComponent(projectName)}/leads/${encodeURIComponent(leadRole)}`, { headers: this.headers() });
  }

  saveProjectManager(data: { userId?: number; email?: string; name?: string; managedProjects: string[]; pmResponsibilities?: string }): Observable<TeamHierarchy> {
    return this.http.post<TeamHierarchy>(`${this.apiUrl}/pm`, data, { headers: this.headers() });
  }

  deleteProjectManager(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/pm/${id}`, { headers: this.headers() });
  }

  assignLead(pmId: string, leadData: {
    leadId?: number;
    leadEmail: string;
    leadName?: string;
    leadRole: string;
    leadTitle?: string;
    responsibilities?: string;
  }): Observable<TeamHierarchy> {
    return this.http.post<TeamHierarchy>(`${this.apiUrl}/${pmId}/leads`, leadData, { headers: this.headers() });
  }

  removeLead(pmId: string, leadEmail: string): Observable<TeamHierarchy> {
    return this.http.delete<TeamHierarchy>(`${this.apiUrl}/${pmId}/leads/${encodeURIComponent(leadEmail)}`, { headers: this.headers() });
  }

  mapMember(pmId: string, leadEmail: string, memberData: {
    memberId?: number;
    memberEmail: string;
    memberName?: string;
    memberRole: string;
    responsibilities?: string;
    projectAssignments: ProjectPriorityAssignment[];
  }): Observable<TeamHierarchy> {
    return this.http.post<TeamHierarchy>(`${this.apiUrl}/${pmId}/leads/${encodeURIComponent(leadEmail)}/members`, memberData, { headers: this.headers() });
  }

  removeMember(pmId: string, leadEmail: string, memberEmail: string): Observable<TeamHierarchy> {
    return this.http.delete<TeamHierarchy>(`${this.apiUrl}/${pmId}/leads/${encodeURIComponent(leadEmail)}/members/${encodeURIComponent(memberEmail)}`, { headers: this.headers() });
  }
}
