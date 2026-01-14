import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

type RoleId = 'jefatura' | 'vinculacion' | 'practicas';

type PracticeEvent = {
  type: string;
  at: string;
  payload?: {
    id?: number;
    tipo?: string | null;
    estudiante?: { nombre?: string | null; rut?: string | null };
    centro?: { nombre?: string | null };
  };
  meta?: {
    createdByRole?: string;
  };
};

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  private eventSource?: EventSource;
  private started = false;

  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.started) return;
    if (typeof EventSource === 'undefined') return;

    this.started = true;
    this.requestDesktopPermission();

    const url = `${environment.apiUrl}/practicas/stream`;
    this.eventSource = new EventSource(url, { withCredentials: true });

    this.eventSource.onmessage = (msg) => {
      const event = this.safeParseEvent(msg.data);
      if (!event) return;
      this.handlePracticeEvent(event);
    };

    this.eventSource.onerror = () => {
      // The browser will retry automatically; keep the connection open.
    };
  }

  stop(): void {
    this.eventSource?.close();
    this.eventSource = undefined;
    this.started = false;
  }

  private handlePracticeEvent(event: PracticeEvent) {
    if (event.type !== 'practice.created') return;
    if (!this.isPracticaProfesional(event.payload?.tipo)) return;

    const createdByRole = (event.meta?.createdByRole || '').toLowerCase();
    if (createdByRole && createdByRole !== 'practicas') return;

    const currentRole = this.getCurrentRoleId();
    if (!currentRole || currentRole === 'practicas') return;

    const estudiante = event.payload?.estudiante?.nombre?.trim() || 'Estudiante';
    const centro = event.payload?.centro?.nombre?.trim() || 'centro educativo';

    const title = 'Nueva practica profesional';
    const body = `${estudiante} en ${centro}`;

    this.snack.open(body, 'Cerrar', { duration: 7000 });
    this.showDesktopNotification(title, body);
  }

  private getCurrentRoleId(): RoleId | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    try {
      const saved = localStorage.getItem('app.selectedRole');
      if (saved) {
        const role = JSON.parse(saved) as { id?: RoleId };
        if (role?.id) return role.id;
      }
    } catch {
      // Ignore storage parse errors.
    }

    const user = this.auth.getCurrentUser?.();
    return (user?.role as RoleId) ?? null;
  }

  private isPracticaProfesional(tipo?: string | null): boolean {
    if (!tipo) return false;
    const normalized = tipo.toLowerCase();
    return normalized.includes('practica profesional') || normalized.includes('práctica profesional');
  }

  private requestDesktopPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    Notification.requestPermission().catch(() => undefined);
  }

  private showDesktopNotification(title: string, body: string) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body });
  }

  private safeParseEvent(data: string): PracticeEvent | null {
    try {
      return JSON.parse(data) as PracticeEvent;
    } catch {
      return null;
    }
  }
}
