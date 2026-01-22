import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-egresados-encuestas-actividades',
  templateUrl: './egresados-encuestas-actividades.component.html',
  styleUrls: ['./egresados-encuestas-actividades.component.scss'],
  imports: [CommonModule, RouterModule, MatCardModule, MatIconModule, MatButtonModule],
})
export class EgresadosEncuestasActividadesComponent {}
