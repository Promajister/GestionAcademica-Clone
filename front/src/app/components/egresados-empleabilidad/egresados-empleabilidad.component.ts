import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  EstudiantesService,
  EstudianteResumen,
} from '../../services/estudiantes.service';

@Component({
  standalone: true,
  selector: 'app-egresados-empleabilidad',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './egresados-empleabilidad.component.html',
  styleUrls: ['./egresados-empleabilidad.component.scss'],
})
export class EgresadosEmpleabilidadComponent implements OnInit {
  private estudiantesService = inject(EstudiantesService);
  private snack = inject(MatSnackBar);

  egresados: EstudianteResumen[] = [];
  cargandoEgresados = false;

  form = {
    egresadoRut: '',
    lugarTrabajo: '',
    sector: '',
    sectorOtro: '',
    cargo: '',
    cargoOtro: '',
  };

  readonly sectorOptions = [
    { value: 'publico', label: 'Publico' },
    { value: 'privado', label: 'Privado' },
    { value: 'otro', label: 'Otro' },
  ];

  readonly cargoOptions = [
    { value: 'jefatura', label: 'Jefatura' },
    { value: 'dependiente', label: 'Dependiente' },
    { value: 'independiente', label: 'Independiente' },
    { value: 'otro', label: 'Otro' },
  ];

  ngOnInit(): void {
    this.cargarEgresados();
  }

  cargarEgresados(): void {
    this.cargandoEgresados = true;
    this.estudiantesService.listar({ egresado: true }).subscribe({
      next: (items) => {
        this.egresados = items || [];
        this.cargandoEgresados = false;
      },
      error: () => {
        this.cargandoEgresados = false;
      },
    });
  }

  formValido(): boolean {
    if (!this.form.egresadoRut) return false;
    if (!this.form.lugarTrabajo.trim()) return false;
    if (!this.form.sector) return false;
    if (this.form.sector === 'otro' && !this.form.sectorOtro.trim()) return false;
    if (!this.form.cargo) return false;
    if (this.form.cargo === 'otro' && !this.form.cargoOtro.trim()) return false;
    return true;
  }

  limpiar(): void {
    this.form = {
      egresadoRut: '',
      lugarTrabajo: '',
      sector: '',
      sectorOtro: '',
      cargo: '',
      cargoOtro: '',
    };
  }

  guardar(): void {
    if (!this.formValido()) return;
    this.snack.open('Datos de empleabilidad listos para guardar.', 'OK', {
      duration: 3000,
    });
    this.limpiar();
  }
}
