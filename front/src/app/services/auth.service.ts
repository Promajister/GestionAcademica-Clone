import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, tap, throwError } from 'rxjs';

const API = 'http://localhost:3000/api/auth';

export interface LoginResponse {
  user: {
    id: number;
    email: string;
    nombre: string;
    role: 'jefatura' | 'vinculacion' | 'practicas';
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

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API}/login`, { email, password })
      .pipe(tap((res) => this.setSession(res)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ACCESS_EXP_KEY);
    localStorage.removeItem('app.accessToken');
  }

  isLoggedIn(): boolean {
    if (typeof localStorage === 'undefined') return false;
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

  private setSession(res: LoginResponse) {
    // El backend usa cookies HTTP-only; guardamos un flag/csrf para saber que hay sesión
    localStorage.setItem(this.TOKEN_KEY, res.csrfToken || 'cookie');
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
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
}

