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

import { ActividadesPmService } from '../../../services/actividades-pm.service';
import { ActividadPmDialogComponent } from './actividad-pm-dialog.component';

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

  ngOnInit(): void {
    this.cargar();

    this.filtroForm.valueChanges.subscribe(() => {
      this.cargar();
    });
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
        width: '980px',
        maxWidth: '98vw',
        data: { id: row.id, mode: 'view' },
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.refresh) this.cargar();
      });
  }

  abrirEditar(row: any): void {
    this.dialog
      .open(ActividadPmDialogComponent, {
        width: '980px',
        maxWidth: '98vw',
        data: { id: row.id, mode: 'edit' },
        disableClose: true,
      })
      .afterClosed()
      .subscribe((result) => {
        if (result?.refresh) this.cargar();
      });
  }

  eliminar(row: any): void {
    const ok = confirm(`¿Eliminar la actividad "${row.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    this.api.eliminar(row.id).subscribe({
      next: () => this.cargar(),
      error: (err) => {
        console.error(err);
        alert('No se pudo eliminar. Puede que la actividad ya no exista.');
      },
    });
  }
}
