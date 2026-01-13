import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ActividadesPmService } from '../../services/actividades-pm.service';
import { ActividadPmDialogComponent } from './actividad-pm-dialog.component';
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ConfirmDialogComponent } from './confirm-dialog.component';


@Component({
  selector: 'app-actividades-pm-gestion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatDialogModule,
    MatTooltipModule,
    MatProgressSpinnerModule
],
  templateUrl: './actividades-pm-gestion.component.html',
  styleUrls: ['./actividades-pm-gestion.component.scss'],
})
export class ActividadesPmGestionComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ActividadesPmService);
  private dialog = inject(MatDialog);

  loading = false;
  errorMsg = '';

  cols = ['nombre', 'tipoActividad', 'fecha', 'sede', 'areaImpacto', 'acciones'];
  rows: any[] = [];

  filtroForm = this.fb.group({
    anio: [new Date().getFullYear()],
    tipo: [''],
    q: [''],
  });

  tipos: { value: string; label: string }[] = [
    { value: '', label: 'Todos' },
    { value: 'FERIA_VOCACIONAL', label: 'Feria Vocacional' },
    { value: 'JORNADA_PEDAGOGICA', label: 'Jornada Pedagógica' },
    { value: 'TALLER_REMEDIAL', label: 'Taller Remedial' },
    { value: 'CONGRESO_ACADEMICO', label: 'Congreso Académico' },
    { value: 'ALTERNANCIA_PEDAGOGICA', label: 'Alternancia Pedagógica' },
    { value: 'SALIDA_A_TERRENO', label: 'Salida a Terreno' },
  ];

  anios = Array.from({ length: 7 }).map((_, i) => new Date().getFullYear() - i);
  private tipoActividadLabelMap: Record<string, string> = {};

  ngOnInit(): void {
    this.tipoActividadLabelMap = Object.fromEntries(
        this.tipos
        .filter(x => x.value) 
        .map(x => [x.value, x.label])
    );
    this.cargar();

    this.filtroForm.valueChanges
        .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        )
        .subscribe(() => this.cargar());
    }

  getTipoActividadLabel(value?: string): string {
    if (!value) return '-';
    return this.tipoActividadLabelMap[value] ?? value.replaceAll('_', ' ');
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    const { anio, tipo, q } = this.filtroForm.value;

    this.api
      .listar({
        anio: anio ?? undefined,
        tipo: tipo || undefined,
        q: q || undefined,
      })
      .subscribe({
        next: (data) => {
          this.rows = data ?? [];
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.errorMsg = 'No se pudo cargar el listado.';
          this.loading = false;
        },
      });
  }

  abrirVer(row: any): void {
    this.dialog
        .open(ActividadPmDialogComponent, {
        width: '900px',
        maxWidth: '92vw',
        data: { id: row.id, mode: 'view' },
        disableClose: true,
        panelClass: 'ga-dialog',
        backdropClass: 'ga-dialog-backdrop',
        autoFocus: false,
        })
        .afterClosed()
        .subscribe((result) => {
        if (result?.refresh) this.cargar();
        });
  }

  abrirEditar(row: any): void {
    this.dialog.open(ActividadPmDialogComponent, {
        width: '980px',
        maxWidth: '96vw',
        maxHeight: '90vh',
        height: '90vh',      
        data: { id: row.id, mode: 'edit' },
        disableClose: true,
        panelClass: 'ga-dialog',
        backdropClass: 'ga-dialog-backdrop',
        autoFocus: false,
    })
    .afterClosed()
    .subscribe((result) => {
    if (result?.refresh) this.cargar();
    });
  }

  limpiarFiltros(): void {
    this.filtroForm.patchValue({
        anio: new Date().getFullYear(),
        tipo: '',
        q: '',
    });
  }

  trackById = (_: number, row: any) => row?.id;

  formatearRangoFechas(inicio?: string, termino?: string): string {
    const f = (v?: string) => {
      const raw = String(v ?? '').trim();
      if (!raw) return '-';

      const datePart = raw.includes('T') ? raw.split('T')[0] : raw;

      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
      if (!m) return raw;

      const [, yyyy, mm, dd] = m;
      return `${dd}/${mm}/${yyyy}`; 
    };

    if (!inicio && !termino) return '-';
    return `${f(inicio)} → ${f(termino)}`;
  }

  eliminar(row: any): void {
    this.dialog.open(ConfirmDialogComponent, {
        width: '520px',
        maxWidth: '92vw',
        disableClose: true,
        autoFocus: false,
        data: {
        title: 'Eliminar actividad',
        message: 'Se eliminará de forma permanente la siguiente actividad:',
        detail: row.nombre,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        tone: 'danger',
        },
    })
    .afterClosed()
    .subscribe((ok: boolean) => {
        if (!ok) return;

        this.api.eliminar(row.id).subscribe({
        next: () => this.cargar(),
        error: (err) => {
            console.error(err);
            alert('No se pudo eliminar. Puede que la actividad ya no exista.');
        },
        });
    });
  }

}
