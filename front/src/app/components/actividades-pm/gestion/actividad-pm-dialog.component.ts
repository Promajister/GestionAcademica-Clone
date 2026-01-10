import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ActividadesPmService } from '../../../services/actividades-pm.service';

export interface ActividadPmDialogData {
  id: number;
  mode: 'view' | 'edit';
}

@Component({
  selector: 'app-actividad-pm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './actividad-pm-dialog.component.html',
  styleUrls: ['./actividad-pm-dialog.component.scss'],
})
export class ActividadPmDialogComponent implements OnInit {
  loading = true;
  saving = false;
  errorMsg = '';

  form!: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ActividadPmDialogData,
    private dialogRef: MatDialogRef<ActividadPmDialogComponent>,
    private fb: FormBuilder,
    private api: ActividadesPmService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      objetivo: ['', Validators.required],
      descripcion: ['', Validators.required],
      sede: ['', Validators.required],
      fechaInicio: ['', Validators.required],
      fechaTermino: ['', Validators.required],
      resultados: [''],
    });

    this.cargar();
  }

  get isView(): boolean {
    return this.data.mode === 'view';
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    this.api.obtener(this.data.id).subscribe({
      next: (a) => {
        this.form.patchValue({
          nombre: a.nombre,
          objetivo: a.objetivo,
          descripcion: a.descripcion,
          sede: a.sede,
          fechaInicio: a.fechaInicio,
          fechaTermino: a.fechaTermino,
          resultados: a.resultados,
        });

        if (this.isView) {
          this.form.disable({ emitEvent: false });
        }

        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.errorMsg = 'No se pudo cargar la actividad.';
        this.loading = false;
      },
    });
  }

  cerrar(): void {
    this.dialogRef.close({ refresh: false });
  }

  guardar(): void {
    if (this.isView) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;

    const req = {
      payload: {
        proyecto: {
          ...this.form.value,
        },
      },
      unidades: [],
      responsables: [],
      equipoTrabajo: [],
      financiamientos: [],
      centrosCosto: [],
      instituciones: [],
      estudiantes: [],
      difusiones: [],
      files: {},
    };

    this.api.actualizar(this.data.id, req as any).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close({ refresh: true });
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        this.errorMsg = 'No se pudo guardar los cambios.';
      },
    });
  }
}
