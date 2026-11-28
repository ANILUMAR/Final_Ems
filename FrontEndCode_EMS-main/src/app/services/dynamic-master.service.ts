import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DynamicFormSchema,
  DynamicMasterPageResult,
  DynamicMasterRecord,
  LookupOption
} from '../models/dynamic-master.model';

@Injectable({
  providedIn: 'root'
})
export class DynamicMasterService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:9001/api/dynamic-masters';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  /* =========================================================================
   * SCHEMA OPERATIONS
   * ========================================================================= */

  listSchemas(module?: string): Observable<DynamicFormSchema[]> {
    let params = new HttpParams();
    if (module) {
      params = params.set('module', module);
    }
    return this.http.get<DynamicFormSchema[]>(`${this.baseUrl}/schemas`, {
      headers: this.getHeaders(),
      params
    });
  }

  getSchema(screenCode: string): Observable<DynamicFormSchema> {
    return this.http.get<DynamicFormSchema>(`${this.baseUrl}/schemas/${screenCode}`, {
      headers: this.getHeaders()
    });
  }

  saveSchema(schema: DynamicFormSchema): Observable<DynamicFormSchema> {
    return this.http.post<DynamicFormSchema>(`${this.baseUrl}/schemas`, schema, {
      headers: this.getHeaders()
    });
  }

  deleteSchema(screenCode: string, deleteRecords = false): Observable<any> {
    let params = new HttpParams();
    if (deleteRecords) {
      params = params.set('deleteRecords', 'true');
    }
    return this.http.delete(`${this.baseUrl}/schemas/${screenCode}`, {
      headers: this.getHeaders(),
      params
    });
  }

  /* =========================================================================
   * RECORD OPERATIONS
   * ========================================================================= */

  listRecords(
    screenCode: string,
    options?: {
      search?: string;
      page?: number;
      size?: number;
      sortField?: string;
      sortDir?: string;
    }
  ): Observable<DynamicMasterPageResult<DynamicMasterRecord>> {
    let params = new HttpParams();
    if (options?.search) params = params.set('search', options.search);
    if (options?.page !== undefined) params = params.set('page', options.page.toString());
    if (options?.size !== undefined) params = params.set('size', options.size.toString());
    if (options?.sortField) params = params.set('sortField', options.sortField);
    if (options?.sortDir) params = params.set('sortDir', options.sortDir);

    return this.http.get<DynamicMasterPageResult<DynamicMasterRecord>>(
      `${this.baseUrl}/records/${screenCode}`,
      { headers: this.getHeaders(), params }
    );
  }

  getRecord(screenCode: string, id: number): Observable<DynamicMasterRecord> {
    return this.http.get<DynamicMasterRecord>(`${this.baseUrl}/records/${screenCode}/${id}`, {
      headers: this.getHeaders()
    });
  }

  saveRecord(screenCode: string, data: Record<string, any>): Observable<DynamicMasterRecord> {
    return this.http.post<DynamicMasterRecord>(
      `${this.baseUrl}/records/${screenCode}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  updateRecord(screenCode: string, id: number, data: Record<string, any>): Observable<DynamicMasterRecord> {
    return this.http.put<DynamicMasterRecord>(
      `${this.baseUrl}/records/${screenCode}/${id}`,
      data,
      { headers: this.getHeaders() }
    );
  }

  deleteRecord(screenCode: string, id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/records/${screenCode}/${id}`, {
      headers: this.getHeaders()
    });
  }

  getLookupOptions(screenCode: string): Observable<LookupOption[]> {
    return this.http.get<LookupOption[]>(`${this.baseUrl}/records/${screenCode}/lookup`, {
      headers: this.getHeaders()
    });
  }

  exportExcel(screenCode: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/records/${screenCode}/export`, {
      headers: this.getHeaders(),
      responseType: 'blob'
    });
  }
}
