import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DailyTimesheet, TimesheetEntry } from '../models/employee';

@Injectable({
  providedIn: 'root'
})
export class Timesheet {
  private apiUrl = 'http://localhost:9001/api/timesheets';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
  }

  /* ---------- Legacy methods ---------- */

  getTimesheets(): Observable<TimesheetEntry[]> {
    return this.http.get<TimesheetEntry[]>(this.apiUrl, { headers: this.headers() });
  }

  saveTimesheet(entry: TimesheetEntry): Observable<TimesheetEntry> {
    return this.http.post<TimesheetEntry>(this.apiUrl, entry, { headers: this.headers() });
  }

  /* ---------- Daily Task-Wise Timesheet APIs ---------- */

  saveDaily(sheet: Partial<DailyTimesheet>, submit: boolean = false): Observable<DailyTimesheet> {
    const params = new HttpParams().set('submit', String(submit));
    return this.http.post<DailyTimesheet>(`${this.apiUrl}/daily`, sheet, {
      headers: this.headers(),
      params
    });
  }

  getMyDailyTimesheets(filters?: { fromDate?: string; toDate?: string; project?: string; status?: string }): Observable<DailyTimesheet[]> {
    let params = new HttpParams();
    if (filters?.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters?.toDate) params = params.set('toDate', filters.toDate);
    if (filters?.project && filters.project !== 'ALL') params = params.set('project', filters.project);
    if (filters?.status && filters.status !== 'ALL') params = params.set('status', filters.status);

    return this.http.get<DailyTimesheet[]>(`${this.apiUrl}/daily/my`, {
      headers: this.headers(),
      params
    });
  }

  getDailyById(id: string): Observable<DailyTimesheet> {
    return this.http.get<DailyTimesheet>(`${this.apiUrl}/daily/${id}`, {
      headers: this.headers()
    });
  }

  getApprovalsQueue(filters?: { status?: string; employee?: string; fromDate?: string; toDate?: string }): Observable<DailyTimesheet[]> {
    let params = new HttpParams();
    if (filters?.status && filters.status !== 'ALL') params = params.set('status', filters.status);
    if (filters?.employee && filters.employee !== 'ALL') params = params.set('employee', filters.employee);
    if (filters?.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters?.toDate) params = params.set('toDate', filters.toDate);

    return this.http.get<DailyTimesheet[]>(`${this.apiUrl}/daily/approvals`, {
      headers: this.headers(),
      params
    });
  }

  approveDaily(id: string): Observable<DailyTimesheet> {
    return this.http.post<DailyTimesheet>(`${this.apiUrl}/daily/${id}/approve`, {}, {
      headers: this.headers()
    });
  }

  rejectDaily(id: string, rejectionReason: string): Observable<DailyTimesheet> {
    return this.http.post<DailyTimesheet>(`${this.apiUrl}/daily/${id}/reject`, { rejectionReason }, {
      headers: this.headers()
    });
  }

  markUnderReview(id: string): Observable<DailyTimesheet> {
    return this.http.post<DailyTimesheet>(`${this.apiUrl}/daily/${id}/under-review`, {}, {
      headers: this.headers()
    });
  }

  getMyTasksForProject(project: string): Observable<any[]> {
    const params = new HttpParams().set('project', project);
    return this.http.get<any[]>(`${this.apiUrl}/daily/my-tasks-for-project`, {
      headers: this.headers(),
      params
    });
  }

  getReportingPerson(): Observable<{
    reportingPersonEmail: string;
    reportingPersonName: string;
    employeeRole: string;
    employeeName: string;
    employeeEmail: string;
  }> {
    return this.http.get<any>(`${this.apiUrl}/daily/reporting-person`, {
      headers: this.headers()
    });
  }

  getSummary(): Observable<{
    todayHours: number;
    weekHours: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    draftCount: number;
    totalSheets: number;
  }> {
    return this.http.get<any>(`${this.apiUrl}/daily/summary`, {
      headers: this.headers()
    });
  }

  getReports(filters?: { employee?: string; project?: string; fromDate?: string; toDate?: string; status?: string }): Observable<any> {
    let params = new HttpParams();
    if (filters?.employee && filters.employee !== 'ALL') params = params.set('employee', filters.employee);
    if (filters?.project && filters.project !== 'ALL') params = params.set('project', filters.project);
    if (filters?.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters?.toDate) params = params.set('toDate', filters.toDate);
    if (filters?.status && filters.status !== 'ALL') params = params.set('status', filters.status);

    return this.http.get<any>(`${this.apiUrl}/daily/reports`, {
      headers: this.headers(),
      params
    });
  }
}
