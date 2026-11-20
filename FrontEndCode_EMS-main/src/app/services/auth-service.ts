import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:9001/api/auth/users';
  private rolesUrl = 'http://localhost:9001/api/auth/roles';

  isauthenticated()
  {
     return !!localStorage.getItem('token');
  }

  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token')}` });
  }

  /** Roles the backend accepts; the edit dialog builds its dropdown from this. */
  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(this.rolesUrl, { headers: this.authHeaders() });
  }

  /** Activates or deactivates one account without touching anything else. */
  setUserStatus(id: number, active: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, { active }, { headers: this.authHeaders() });
  }

  /**
   * Grants or revokes the tester task-management provision: once on, that tester
   * may create, edit and delete tasks the same way an administrator does.
   */
  setTaskAccess(id: number, enabled: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/task-access`, { enabled }, { headers: this.authHeaders() });
  }

  /**
   * The password saved for one account, decrypted for the admin edit dialog.
   * Empty string when the row carries no readable copy yet.
   */
  getUserPassword(id: number): Observable<{ password: string }> {
    return this.http.get<{ password: string }>(`${this.apiUrl}/${id}/password`, {
      headers: this.authHeaders()
    });
  }

  updateUser(id: number, userData: any, file?: File, password?: string): Observable<any> {
    const headers = this.authHeaders();

    const userPayload: any = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'EMPLOYEE',
      address: userData.address,
      phoneNumber: userData.phoneNumber,
      lowerName: userData.lowerName || '',
      registerImage: userData.registerImage || '',
      // No `active` on purpose: status changes go through
      // PATCH /api/auth/users/{id}/status only, so a profile/role edit can never
      // silently re-enable a switched-off account.
    };

    // Same rule for the password: only present when the admin typed a new one,
    // so an untouched dialog leaves the stored hash alone.
    const newPassword = String(password ?? '').trim();
    if (newPassword) {
      userPayload.password = newPassword;
    }

    const formData = new FormData();
    formData.append('user', new Blob([JSON.stringify(userPayload)], { type: 'application/json' }));

    if (file) {
      formData.append('file', file);
    }

    return this.http.put(`${this.apiUrl}/${id}`, formData, { headers });
  }


   constructor(private http: HttpClient) { }
}
