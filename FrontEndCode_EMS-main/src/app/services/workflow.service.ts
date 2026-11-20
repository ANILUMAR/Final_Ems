import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompletedWorkResponse, DevQueue, TestingQueue, WorkItem } from '../models/work-item';

/**
 * The approval chain in one place, so the four screens that take part in it do
 * not each describe the endpoints:
 *
 * <pre>
 * tester        submit()        raise a task or a bug (PENDING)
 * tester        mySubmissions() follow what they raised, in every state
 * tester        correct()       fix a rejected item and send it again
 * testing lead  approvals()     the queue: waiting, approved, sent back
 * testing lead  review()        approve or send back with a comment
 * developer lead devQueue()     approved work plus each developer's open load
 * developer lead assign()       hand it to a developer
 * </pre>
 *
 * The backend pins every call to the caller's own team, so a screen never has
 * to pass "who am I": the token answers it.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private base = 'http://localhost:9001/api/workflow';

  constructor(private http: HttpClient) { }

  private headers(): HttpHeaders {
    return new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token') || ''}`);
  }

  /** Raises a task or a bug; the form carries an optional attachment. */
  submit(form: FormData): Observable<WorkItem> {
    return this.http.post<WorkItem>(`${this.base}/submissions`, form, { headers: this.headers() });
  }

  mySubmissions(): Observable<WorkItem[]> {
    return this.http.get<WorkItem[]>(`${this.base}/my-submissions`, { headers: this.headers() });
  }

  /** Only the author, only while the item is sent back. */
  correct(id: number, changes: Partial<WorkItem>): Observable<WorkItem> {
    return this.http.put<WorkItem>(`${this.base}/submissions/${id}`, changes, { headers: this.headers() });
  }

  approvals(): Observable<WorkItem[]> {
    return this.http.get<WorkItem[]>(`${this.base}/approvals`, { headers: this.headers() });
  }

  review(id: number, decision: 'APPROVE' | 'REJECT', note?: string, kind?: string): Observable<WorkItem> {
    return this.http.patch<WorkItem>(
      `${this.base}/submissions/${id}/review`,
      { decision, note, kind },
      { headers: this.headers() }
    );
  }

  devQueue(): Observable<DevQueue> {
    return this.http.get<DevQueue>(`${this.base}/dev-queue`, { headers: this.headers() });
  }

  assign(
    id: number,
    payload: { developerId: number; priority?: string; startDate?: string; endDate?: string; note?: string; kind?: string }
  ): Observable<WorkItem> {
    return this.http.patch<WorkItem>(`${this.base}/submissions/${id}/assign`, payload, {
      headers: this.headers()
    });
  }

  /** All completed developer tasks (status == DONE). */
  completedTasks(): Observable<CompletedWorkResponse> {
    return this.http.get<CompletedWorkResponse>(`${this.base}/completed-tasks`, { headers: this.headers() });
  }

  /** Developer Team Leader reviews a completed task/bug and releases it for testing. */
  releaseForTesting(id: number, kind: string | undefined, note: string): Observable<WorkItem> {
    return this.http.patch<WorkItem>(
      `${this.base}/tasks/${id}/release-for-testing`,
      { note, kind },
      { headers: this.headers() }
    );
  }

  /** Team Leader reviews completed task: Approve for testing or Put on Hold. */
  leadReview(
    id: number,
    kind: string | undefined,
    action: 'APPROVE' | 'HOLD' | 'RESET',
    reason?: string
  ): Observable<WorkItem> {
    return this.http.patch<WorkItem>(
      `${this.base}/tasks/${id}/lead-review`,
      { kind, action, reason },
      { headers: this.headers() }
    );
  }

  /** Team Leader batch releases all reviewed and approved tasks to testing team at once. */
  batchReleaseForTesting(
    taskIds?: number[],
    note?: string
  ): Observable<{ releasedCount: number; releasedCodes: string[]; message: string }> {
    return this.http.post<{ releasedCount: number; releasedCodes: string[]; message: string }>(
      `${this.base}/tasks/batch-release-for-testing`,
      { taskIds, note },
      { headers: this.headers() }
    );
  }

  /** Dedicated queue of tasks held by Team Leader before QA release. */
  onHoldTasks(): Observable<{ items: WorkItem[]; totalOnHold: number }> {
    return this.http.get<{ items: WorkItem[]; totalOnHold: number }>(
      `${this.base}/on-hold-tasks`,
      { headers: this.headers() }
    );
  }

  /** Team Leader unhold action: Approve for testing or Reopen back to developer. */
  unhold(
    id: number,
    kind: string | undefined,
    action: 'APPROVE_FOR_TESTING' | 'REOPEN_TO_DEVELOPER',
    note?: string
  ): Observable<WorkItem> {
    return this.http.patch<WorkItem>(
      `${this.base}/tasks/${id}/unhold`,
      { kind, action, note },
      { headers: this.headers() }
    );
  }

  /** Testing Team Leader queue: work released by dev team waiting for test assignment. */
  testingQueue(): Observable<TestingQueue> {
    return this.http.get<TestingQueue>(`${this.base}/testing-queue`, { headers: this.headers() });
  }

  /** Testing Team Leader assigns a released item to a tester for verification. */
  assignTester(
    id: number,
    payload: { testerId: number; priority?: string; note?: string; kind?: string }
  ): Observable<WorkItem> {
    return this.http.patch<WorkItem>(`${this.base}/tasks/${id}/assign-tester`, payload, {
      headers: this.headers()
    });
  }

  /** Tester or Testing Lead verifies outcome (PASSED / FAILED). */
  verifyTest(
    id: number,
    payload: { result: 'PASSED' | 'FAILED'; note: string; kind?: string }
  ): Observable<WorkItem> {
    return this.http.patch<WorkItem>(`${this.base}/tasks/${id}/verify-test`, payload, {
      headers: this.headers()
    });
  }

  /** Tested Completed Tasks review screen for both Testing Team Leader and Developer Team Leader. */
  testedCompletedTasks(): Observable<{ items: WorkItem[]; total: number; bugsCount: number; tasksCount: number }> {
    return this.http.get<{ items: WorkItem[]; total: number; bugsCount: number; tasksCount: number }>(
      `${this.base}/tested-completed`,
      { headers: this.headers() }
    );
  }

  /** Completed Tasks list for each tester displaying only the tasks they personally completed. */
  testerCompletedTasks(email?: string): Observable<{
    items: WorkItem[];
    total: number;
    bugsCount: number;
    tasksCount: number;
    testerName: string;
    testerEmail: string;
  }> {
    const q = email ? `?email=${encodeURIComponent(email)}` : '';
    return this.http.get<{
      items: WorkItem[];
      total: number;
      bugsCount: number;
      tasksCount: number;
      testerName: string;
      testerEmail: string;
    }>(`${this.base}/tester-completed${q}`, { headers: this.headers() });
  }
}
