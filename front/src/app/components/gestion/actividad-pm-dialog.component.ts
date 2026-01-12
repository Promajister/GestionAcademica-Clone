import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ActividadesPmService } from '../../services/actividades-pm.service';

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './actividad-pm-dialog.component.html',
  styleUrls: ['./actividad-pm-dialog.component.scss'],
})
export class ActividadPmDialogComponent implements OnInit {

  loading = true;
  saving = false;
  errorMsg = '';

  actividad: any = null;
  form!: FormGroup;

  tipoActividadLabelMap: Record<string, string> = {};

  tipoActividadCatalogo = [
    { value: 'SELECCIONE', label: 'SELECCIONE' },
    { value: 'FERIA_VOCACIONAL', label: 'Feria Vocacional' },
    { value: 'JORNADA_PEDAGOGICA', label: 'Jornada Pedagógica' },
    { value: 'TALLER_REMEDIAL', label: 'Taller Remedial' },
    { value: 'CONGRESO_ACADEMICO', label: 'Congreso Académico' },
    { value: 'ALTERNANCIA_PEDAGOGICA', label: 'Alternancia Pedagógica' },
    { value: 'SALIDA_A_TERRENO', label: 'Salida a Terreno' },
  ];

  areasImpacto = [
    'SELECCIONE',
    'Desarrollo social y comunitario',
    'Fortalecimiento educativo y formativo',
    'Cultural y patrimonio',
    'Educación regional',
  ];

  sedes = [
    'SELECCIONE',
    'CASA MATRIZ ARICA',
    'SEDE IQUIQUE',

  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ActividadPmDialogData,
    private dialogRef: MatDialogRef<ActividadPmDialogComponent>,
    private fb: FormBuilder,
    private api: ActividadesPmService,
  ) {}

  get isView(): boolean {
    return this.data.mode === 'view';
  }

  ngOnInit(): void {
    this.tipoActividadLabelMap = Object.fromEntries(
        this.tipoActividadCatalogo.map(x => [x.value, x.label])
    );

    this.form = this.fb.group({
      proyecto: this.fb.group({
        nombre: ['', Validators.required],
        tipoActividad:[
          'SELECCIONE',
          [Validators.required, Validators.pattern('^(?!SELECCIONE$).+')],
        ],
        areaImpacto: [
          'SELECCIONE',
          [Validators.required, Validators.pattern('^(?!SELECCIONE$).+')],
        ],
        objetivo: ['', Validators.required],
        descripcion: ['', Validators.required],
        sede: [
          'SELECCIONE',
          [Validators.required, Validators.pattern('^(?!SELECCIONE$).+')],
        ],
        fechaInicio: ['', Validators.required],
        fechaTermino: ['', Validators.required],
        resultados: [''],
      }),
    });

    this.cargar();
  }

  getTipoActividadLabel(value?: string): string {
    if (!value) return '—';
    return this.tipoActividadLabelMap[value] ?? value.replaceAll('_', ' ');
   }

  private toDateInput(v?: any): string {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().substring(0, 10);
  }

  private toDateLabel(v?: any): string {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CL');
  }

  get fechaRango(): string {
    if (!this.actividad) return '—';
    return `${this.toDateLabel(this.actividad.fechaInicio)} → ${this.toDateLabel(this.actividad.fechaTermino)}`;
  }

  cargar(): void {
    this.loading = true;
    this.errorMsg = '';

    this.api.obtener(this.data.id).subscribe({
      next: (a) => {
        this.actividad = a;

        this.form.patchValue({
          proyecto: {
            nombre: a.nombre,
            tipoActividad: a.tipoActividad ?? 'SELECCIONE',
            areaImpacto: a.areaImpacto ?? 'SELECCIONE',
            objetivo: a.objetivo,
            descripcion: a.descripcion,
            sede: a.sede ?? 'SELECCIONE',
            fechaInicio: this.toDateInput(a.fechaInicio),
            fechaTermino: this.toDateInput(a.fechaTermino),
            resultados: a.resultados,
          },
        });

        this.loading = false;
      },
      error: () => {
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
        proyecto: this.form.value.proyecto,
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
      error: () => {
        this.errorMsg = 'No se pudo guardar los cambios.';
        this.saving = false;
      },
    });
  }
}
