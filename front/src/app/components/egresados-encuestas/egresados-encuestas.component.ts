import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  selector: 'app-egresados-encuestas',
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './egresados-encuestas.component.html',
  styleUrls: ['./egresados-encuestas.component.scss'],
})
export class EgresadosEncuestasComponent {}
