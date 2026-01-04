import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-actividades-pm',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule],
  templateUrl: './actividades-pm.component.html',
  styleUrls: ['./actividades-pm.component.scss']
})
export class ActividadesPmComponent implements OnInit {
  form!: FormGroup;

  camposKeys: string[] = [];

  tiposActividad = [
    'Feria Vocacional',
    'Jornada Pedagógica',
    'Taller Remedial',
    'Congreso Académico',
    'Alternancia Pedagógica',
    'Salida a Terreno'
  ];

  labels: Record<string, string> = {
    institucionVisitada: 'Institución visitada',
    estudiantes: 'Estudiantes (nombres o listado)',
    temaCentral: 'Tema central',
    talleres: 'Talleres',
    responsableTaller: 'Responsable de taller',
    nAsistentes: 'Nº de asistentes',
    satisfaccion: '% satisfacción',
    asignatura: 'Asignatura',
    competencia: 'Competencia a reforzar',
    nEstudiantes: 'Nº estudiantes beneficiados',
    nombreEvento: 'Nombre del evento',
    ponencia: 'Ponencia presentada',
    relator: 'Relator',
    colegio: 'Colegio asociado',
    docenteColaborador: 'Docente colaborador',
    curso: 'Curso',
    objetivoPedagogico: 'Objetivo pedagógico',
    profesorResponsable: 'Profesor responsable'
  };

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombreActividad: ['', Validators.required],
      tipoActividad: ['', Validators.required],
      responsable: ['', Validators.required],
      anio: [new Date().getFullYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
      fecha: ['', Validators.required],
      hora: ['', Validators.required],
      lugar: ['', Validators.required],

      presupuesto: [0, [Validators.required, Validators.min(0)]],
      gastoAsociado: [0, [Validators.min(0)]],

      // dinámicos
      datosEspecificos: this.fb.group({}),

      enlaceNoticia: [''],
      observaciones: ['']
    });

    this.form.get('tipoActividad')?.valueChanges.subscribe((tipo) => {
      this.cargarCamposPorTipo(String(tipo ?? ''));
    });
  }

  get datosEspecificosGroup(): FormGroup {
    return this.form.get('datosEspecificos') as FormGroup;
  }

  cargarCamposPorTipo(tipo: string): void {
    const grupo = this.fb.group({});

    switch (tipo) {
      case 'Feria Vocacional':
        grupo.addControl('institucionVisitada', this.fb.control('', Validators.required));
        grupo.addControl('estudiantes', this.fb.control('', Validators.required));
        break;

      case 'Jornada Pedagógica':
        grupo.addControl('temaCentral', this.fb.control('', Validators.required));
        grupo.addControl('talleres', this.fb.control('', Validators.required));
        grupo.addControl('responsableTaller', this.fb.control('', Validators.required));
        grupo.addControl('nAsistentes', this.fb.control('', [Validators.required, Validators.min(0)]));
        grupo.addControl('satisfaccion', this.fb.control('', [Validators.required, Validators.min(0), Validators.max(100)]));
        break;

      case 'Taller Remedial':
        grupo.addControl('asignatura', this.fb.control('', Validators.required));
        grupo.addControl('competencia', this.fb.control('', Validators.required));
        grupo.addControl('nEstudiantes', this.fb.control('', [Validators.required, Validators.min(0)]));
        break;

      case 'Congreso Académico':
        grupo.addControl('nombreEvento', this.fb.control('', Validators.required));
        grupo.addControl('ponencia', this.fb.control('', Validators.required));
        grupo.addControl('relator', this.fb.control('', Validators.required));
        grupo.addControl('nAsistentes', this.fb.control('', [Validators.required, Validators.min(0)]));
        grupo.addControl('satisfaccion', this.fb.control('', [Validators.required, Validators.min(0), Validators.max(100)]));
        break;

      case 'Alternancia Pedagógica':
        grupo.addControl('colegio', this.fb.control('', Validators.required));
        grupo.addControl('docenteColaborador', this.fb.control('', Validators.required));
        grupo.addControl('asignatura', this.fb.control('', Validators.required));
        grupo.addControl('curso', this.fb.control('', Validators.required));
        grupo.addControl('estudiantes', this.fb.control('', Validators.required));
        break;

      case 'Salida a Terreno':
        grupo.addControl('objetivoPedagogico', this.fb.control('', Validators.required));
        grupo.addControl('asignatura', this.fb.control('', Validators.required));
        grupo.addControl('profesorResponsable', this.fb.control('', Validators.required));
        grupo.addControl('estudiantes', this.fb.control('', Validators.required));
        break;
    }

    this.form.setControl('datosEspecificos', grupo);
    this.camposKeys = Object.keys(grupo.controls);
  }

  labelFor(key: string): string {
    return this.labels[key] ?? key;
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    console.log('Guardar Actividad PM:', this.form.value);
  }
  limpiar(): void {
  // Vaciar dinámicos también (si hay un tipo seleccionado)
  this.form.get('tipoActividad')?.setValue('', { emitEvent: false });

  // Reinicia datosEspecificos y sus keys
  const emptyGroup = this.fb.group({});
  this.form.setControl('datosEspecificos', emptyGroup);
  this.camposKeys = [];

  this.form.reset({
    nombreActividad: '',
    tipoActividad: '',
    responsable: '',
    anio: new Date().getFullYear(),
    fecha: '',
    hora: '',
    lugar: '',
    presupuesto: 0,
    gastoAsociado: 0,
    enlaceNoticia: '',
    observaciones: '',
  });

  this.form.markAsPristine();
  this.form.markAsUntouched();
}

}
