import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { credentialsInterceptor } from './interceptors/credentials.interceptor';
import { authTokenInterceptor } from './interceptors/auth-token.interceptor';
import { refreshTokenInterceptor } from './interceptors/refresh-token.interceptor';
import { MatSnackBarModule } from '@angular/material/snack-bar';

registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withViewTransitions()),
    provideClientHydration(withEventReplay()),
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule),
    { provide: LOCALE_ID, useValue: 'es-ES' },
    provideHttpClient(
      withFetch(),
      withInterceptors([authTokenInterceptor, credentialsInterceptor, refreshTokenInterceptor]),
    ),
  ],
};
