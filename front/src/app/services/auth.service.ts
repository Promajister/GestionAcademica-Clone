import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { environment } from '../../environments/environment';

const API = `${environment.apiUrl}/auth`;

export interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    nombre: string;
    role: 'jefatura' | 'vinculacion' | 'practicas';
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly TOKEN_KEY = 'app.token';
  private readonly USER_KEY = 'app.user';

  login(email: string, password: string): Observable<LoginResponse> {
    if (environment.skipAuth) {
      const mock: LoginResponse = {
        accessToken: 'dev-token',
        user: {
          id: 0,
          email: email || 'dev@example.com',
          nombre: 'Dev User',
          role: 'jefatura',
        },
      };

      localStorage.setItem(this.TOKEN_KEY, mock.accessToken);
      localStorage.setItem(this.USER_KEY, JSON.stringify(mock.user));
      localStorage.setItem('lastLogin', new Date().toISOString());

      return of(mock);
    }

    return this.http
      .post<LoginResponse>(`${API}/login`, { email, password })
      .pipe(
        tap((res) => {
          localStorage.setItem(this.TOKEN_KEY, res.accessToken);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          localStorage.setItem('lastLogin', new Date().toISOString());
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  isLoggedIn(): boolean {
    if (environment.skipAuth) return true;
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  forgotPassword(email: string) {
  return this.http.post<{ message: string }>(
    `${API}/forgot-password`,
    { email }
    );
  }
}
