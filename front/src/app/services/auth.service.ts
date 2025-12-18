import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpHeaders } from '@angular/common/http';
import {  map, throwError } from 'rxjs';

const API = `${environment.apiUrl}/auth`;

export interface LoginResponse {
  user: {
    id: number;
    email: string;
    nombre: string;
    role: 'jefatura' | 'vinculacion' | 'practicas';
    fotoUrl?: string | null;
  };
  csrfToken?: string;
  accessToken?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly TOKEN_KEY = 'app.token';
  private readonly USER_KEY = 'app.user';
  private readonly ACCESS_EXP_KEY = 'app.accessExp';
  private readonly PHOTO_KEY = 'app.profilePhoto';

  login(email: string, password: string): Observable<LoginResponse> {
    console.log('[AuthService.login] skipAuth=', environment.skipAuth, 'API=', API);
    if (environment.skipAuth) {
      // Determinar el rol basándose en el email
      let role: 'jefatura' | 'vinculacion' | 'practicas' = 'jefatura';
      const emailLower = (email || '').toLowerCase();
      
      if (emailLower.includes('practicas')) {
        role = 'practicas';
      } else if (emailLower.includes('vinculacion')) {
        role = 'vinculacion';
      }
      
      const accessToken = 'dev-token';
      const mock: LoginResponse = {
        accessToken,
        user: {
          id: 0,
          email: email || 'dev@example.com',
          nombre: 'Dev User',
          role: role,
        },
      };

      localStorage.setItem(this.TOKEN_KEY, accessToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(mock.user));
      localStorage.setItem('lastLogin', new Date().toISOString());
      localStorage.removeItem('app.loggedOut'); // Limpiar flag de logout

      return of(mock);
    }

    return this.http
      .post<LoginResponse>(`${API}/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('app.loggedOut', 'true');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ACCESS_EXP_KEY);
    localStorage.removeItem('app.accessToken');
  }

  isLoggedIn(): boolean {
    if (typeof localStorage === 'undefined') return false;
    
    // Si hay un flag de logout explícito, no considerar logueado
    if (localStorage.getItem('app.loggedOut') === 'true') {
      return false;
    }
    
    if (environment.skipAuth) return true;
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  hasValidAccessToken(): boolean {
    const exp = this.getAccessExp();
    if (!exp) return false;
    const now = Math.floor(Date.now() / 1000);
    // Margen de 15s para evitar usar tokens a punto de expirar
    return exp - 15 > now;
  }

  getCurrentUser() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(
      'http://localhost:3000/api/auth/forgot-password',
      { email },
    );
  }

  refreshSession(): Observable<boolean> {
    if (typeof localStorage === 'undefined') {
      return throwError(() => new Error('No storage available'));
    }

    const csrf = localStorage.getItem(this.TOKEN_KEY);
    if (!csrf) {
      return throwError(() => new Error('No CSRF token found'));
    }

    const headers = new HttpHeaders({ 'x-csrf-token': csrf });
    return this.http.post<LoginResponse>(`${API}/refresh`, {}, { headers }).pipe(
      tap((res) => this.setSession(res)),
      map(() => true),
    );
  }

  uploadAvatar(file: File): Observable<{ ok: boolean; url: string; user: LoginResponse['user'] }> {
    const csrf = typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_KEY) : null;
    if (!csrf) {
      return throwError(() => new Error('CSRF token no disponible'));
    }

    const form = new FormData();
    form.append('file', file);

    const headers = new HttpHeaders({ 'x-csrf-token': csrf });

    return this.http
      .post<{ ok: boolean; url: string; user: LoginResponse['user'] }>(
        `${API}/avatar`,
        form,
        { headers },
      )
      .pipe(
        tap((res) => {
          if (res?.user) {
            this.storeUser(res.user);
          }
          if (res?.url && typeof localStorage !== 'undefined') {
            localStorage.setItem(this.PHOTO_KEY, res.url);
          }
        }),
      );
  }

  updateProfile(payload: { nombre?: string; email?: string }): Observable<{ ok: boolean; user: LoginResponse['user'] }> {
    const csrf = typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_KEY) : null;
    if (!csrf) {
      return throwError(() => new Error('CSRF token no disponible'));
    }
    const headers = new HttpHeaders({ 'x-csrf-token': csrf });
    return this.http.post<{ ok: boolean; user: LoginResponse['user'] }>(`${API}/profile`, payload, {
      headers,
    }).pipe(
      tap((res) => {
        if (res?.user) {
          this.storeUser(res.user);
          if (res.user.fotoUrl && typeof localStorage !== 'undefined') {
            localStorage.setItem(this.PHOTO_KEY, res.user.fotoUrl);
          }
        }
      }),
    );
  }

  changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Observable<{ ok: boolean }> {
    const csrf = typeof localStorage !== 'undefined' ? localStorage.getItem(this.TOKEN_KEY) : null;
    if (!csrf) {
      return throwError(() => new Error('CSRF token no disponible'));
    }
    const headers = new HttpHeaders({ 'x-csrf-token': csrf });
    return this.http.post<{ ok: boolean }>(`${API}/change-password`, payload, { headers });
  }

  private setSession(res: LoginResponse) {
    // El backend usa cookies HTTP-only; guardamos un flag/csrf para saber que hay sesión
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('app.loggedOut');
    }
    localStorage.setItem(this.TOKEN_KEY, res.csrfToken || 'cookie');
    this.storeUser(res.user);
    // Limpiar rol persistido para que se cargue el rol real del nuevo usuario
    localStorage.removeItem('app.selectedRole');
    localStorage.setItem('lastLogin', new Date().toISOString());

    if (res.accessToken) {
      localStorage.setItem('app.accessToken', res.accessToken);
      const exp = this.extractExp(res.accessToken);
      if (exp) {
        localStorage.setItem(this.ACCESS_EXP_KEY, exp.toString());
      } else {
        localStorage.removeItem(this.ACCESS_EXP_KEY);
      }
    } else {
      localStorage.removeItem('app.accessToken');
      localStorage.removeItem(this.ACCESS_EXP_KEY);
    }
  }

  private extractExp(token?: string): number | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return typeof decoded?.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  private getAccessExp(): number | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.ACCESS_EXP_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  }

  private storeUser(user: LoginResponse['user']) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    if (user?.role) {
      // Persistir foto de perfil si existe
      if (user.fotoUrl) {
        localStorage.setItem(this.PHOTO_KEY, user.fotoUrl);
      }
    }
  }
}
