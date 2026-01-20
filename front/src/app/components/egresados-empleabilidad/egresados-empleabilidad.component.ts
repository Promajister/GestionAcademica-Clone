import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-egresados-empleabilidad',
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './egresados-empleabilidad.component.html',
  styleUrls: ['./egresados-empleabilidad.component.scss'],
})
export class EgresadosEmpleabilidadComponent {}
