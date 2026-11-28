import { HttpClientModule } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { Header } from "./layout/header/header";
import { Sidebar } from "./layout/sidebar/sidebar";
import { filter } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ThemeService } from './services/theme.service';
import { NavigationPreferenceService } from './services/navigation-preference.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HttpClientModule, Header, Sidebar, CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private router = inject(Router);
  readonly navPref = inject(NavigationPreferenceService);
  showHeader = true;

  constructor(theme: ThemeService) {
    void theme;
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const noHeaderRoutes = ['/', '/login', '/register', '/forgotpassward'];
        this.showHeader = !noHeaderRoutes.includes(event.urlAfterRedirects);
      });
  }
}
