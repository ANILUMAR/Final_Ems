import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { ReferenceService } from './services/reference.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Zone-based change detection. The screens fill their state from HTTP
    // subscriptions, which the zoneless scheduler never schedules a render for,
    // so the zoneless setup left every data-driven page at its initial values.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    // Pulls the roles, statuses and priorities from /api/reference before the
    // first screen renders, so no component carries its own copy of them.
    provideAppInitializer(() => firstValueFrom(inject(ReferenceService).load()))
  ]
};
