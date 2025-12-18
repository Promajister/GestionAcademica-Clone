import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { EstudiantesService, ImportSummary } from '../../services/estudiantes.service';

@Component({
  selector: 'app-importar-estudiantes',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatListModule,
  ],
  templateUrl: './importar-estudiantes.component.html',
  styleUrls: ['./importar-estudiantes.component.scss'],
})
export class ImportarEstudiantesComponent {
  private service = inject(EstudiantesService);

  selectedFile: File | null = null;
  isUploading = false;
  errorMsg: string | null = null;
  result: ImportSummary | null = null;

  expectedHeaders = [
    'Rut',
    'Nombre',
    'Genero',
    'Plan',
    'Año Ingreso',
    'Año Nacimiento',
    'Sist. Ingreso',
    'E-mail',
    'Fono',
    'Direccion',
    'Ptj. Ponderado',
    'Ptj. PSU',
    'Nro Inscripciones',
    'Promedio',
    'Avance',
  ];

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.errorMsg = null;
      this.result = null;
    }
  }

  clearFile() {
    this.selectedFile = null;
  }

  subirArchivo() {
    if (!this.selectedFile) {
      this.errorMsg = 'Selecciona un archivo .xlsx para continuar';
      return;
    }

    this.isUploading = true;
    this.errorMsg = null;
    this.result = null;

    this.service.importarDesdeXlsx(this.selectedFile).subscribe({
      next: (res) => {
        this.result = res;
        this.isUploading = false;
      },
      error: (err) => {
        const msg =
          err?.error?.message ||
          err?.message ||
          'No se pudo importar el archivo. Verifica que sea .xlsx y tenga la fila de encabezados.';
        this.errorMsg = msg;
        this.isUploading = false;
      },
    });
  }

  hasErrors(result: ImportSummary | null): boolean {
    return !!result?.errors?.length;
  }
}
