import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-egresados-ficha-digital',
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './egresados-ficha-digital.component.html',
  styleUrls: ['./egresados-ficha-digital.component.scss'],
})
export class EgresadosFichaDigitalComponent {}
