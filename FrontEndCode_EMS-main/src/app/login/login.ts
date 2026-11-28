import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { RoleGuard } from '../role-guard';
import { RolePermissionService } from '../services/role-permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class Login {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private roleGuard: RoleGuard,
    private rolePermissionService: RolePermissionService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onLogin() {
    if (this.loginForm.invalid || this.loading) {
      return;
    }

    const loginData = this.loginForm.value;
    this.loading = true;
    this.errorMessage = '';

    this.http.post<{ userEntity: any; token: string }>(
      'http://localhost:9001/api/auth/login',
      loginData,
      { headers: { 'Content-Type': 'application/json' } }
    ).subscribe({
      next: (response) => {
        this.loading = false;

        // Clear any old session permissions first
        this.rolePermissionService.clearPermissions();

        localStorage.setItem('token', response.token);
        localStorage.setItem('email', response.userEntity.email);
        localStorage.setItem('role', response.userEntity.role);
        localStorage.setItem('name', response.userEntity.username || response.userEntity.name || response.userEntity.email);
        localStorage.setItem('taskManager', String(response.userEntity.taskManager === true));

        // Refresh role-based screen and action permissions for the logged-in role before navigating
        this.rolePermissionService.refreshCurrentUserPermissions().subscribe({
          next: () => {
            const landingPage = this.roleGuard.getSafeLandingRoute(response.userEntity.role);
            this.router.navigate([landingPage]);
          },
          error: () => {
            const landingPage = this.roleGuard.getSafeLandingRoute(response.userEntity.role);
            this.router.navigate([landingPage]);
          }
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.status === 401
          ? 'Those credentials do not match our records.'
          : 'Sign in failed. Please try again or contact your administrator.';
        console.error('Login failed', err);
      }
    });
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

  goToForgotPassword() {
    this.router.navigate(['/forgotpassward']);
  }
}
