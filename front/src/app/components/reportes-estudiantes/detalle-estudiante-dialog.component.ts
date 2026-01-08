import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';

@Component({
  standalone: true,
  selector: 'app-detalle-estudiante-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
  ],
  templateUrl: './detalle-estudiante-dialog.component.html',
  styleUrls: ['./detalle-estudiante-dialog.component.scss'],
})
export class DetalleEstudianteDialogComponent {
  displayedColumns = ['tipo', 'estado', 'semestre', 'centro', 'tutores', 'inicio', 'termino'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DetalleEstudianteDialogComponent>
  ) {}

  cerrar() {
    this.dialogRef.close();
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('es-CL');
  }

  formatPeriodo(p: any): string {
    const s = p?.semestre ?? '—';
    const a = p?.anio ?? '';
    return `${s}° ${a}`.trim();
  }
}
