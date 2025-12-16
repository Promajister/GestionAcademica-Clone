import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

import { ReportesService } from '../../services/reportes.service';

@Component({
  standalone: true,
  selector: 'app-reportes-satisfaccion',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatSelectModule,
  ],
  templateUrl: './reportes-satisfaccion.component.html',
})
export class ReportesSatisfaccionComponent {
  private reportesService = inject(ReportesService);

  anio = new Date().getFullYear();
  loading = false;

  satisfaccion: any = null;
  indicadores: any = null;

  buscar() {
    this.loading = true;

    this.reportesService.getSatisfaccion(this.anio).subscribe({
      next: res => {
        this.satisfaccion = res;
        this.loading = false;
      },
      error: () => {
        this.satisfaccion = null;
        this.loading = false;
      },
    });
  }
}
