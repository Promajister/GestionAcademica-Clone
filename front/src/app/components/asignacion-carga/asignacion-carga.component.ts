import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CargaDocenteService, ProfesorAsignable, AsignarCargaPayload } from '../../services/carga-docente.service';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-asignacion-carga',
  standalone: true,
  // IMPORTANTE: Agregamos los módulos de Angular Material aquí
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule
  ],
  templateUrl: './asignacion-carga.component.html',
  styleUrl: './asignacion-carga.component.css'
})
export class AsignacionCargaComponent implements OnInit {
  cursos: any[] = [];
  profesores: ProfesorAsignable[] = [];

  textoBusquedaCurso: string = '';
  
  // Usamos FormControl para el autocompletado de Angular Material
  profesorControl = new FormControl('');
  profesoresFiltradosMaterial!: Observable<ProfesorAsignable[]>;

  semestreActual = 2; 
  yearActual = 2026;

  cursoSeleccionado: any = null;
  profesoresAsignados: { profesor: ProfesorAsignable; cantidad_horas: number }[] = [];

  constructor(private cargaDocenteService: CargaDocenteService) {}

  ngOnInit() {
    this.cargarDatos();

    // Lógica para filtrar en tiempo real mientras escribes en el input de Material
    this.profesoresFiltradosMaterial = this.profesorControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const nombre = typeof value === 'string' ? value : (value as any)?.nombre;
        return nombre ? this._filterProfesores(nombre as string) : this.profesores.slice();
      })
    );
  }

  // Función auxiliar para el filtro de Material
  private _filterProfesores(nombre: string): ProfesorAsignable[] {
    const filterValue = nombre.toLowerCase();
    return this.profesores.filter(p => p.nombre.toLowerCase().includes(filterValue));
  }

  // Muestra el nombre del profesor en el input en lugar de un objeto
  mostrarNombreProfesor(profesor: ProfesorAsignable): string {
    return profesor && profesor.nombre ? profesor.nombre : '';
  }

  cargarDatos() {
    this.cargaDocenteService.obtenerCursos(this.semestreActual, this.yearActual).subscribe(res => {
      this.cursos = res;
    });
    this.cargaDocenteService.obtenerProfesores().subscribe(res => {
      this.profesores = res;
    });
  }

  get cursosFiltrados() {
    if (!this.textoBusquedaCurso) return this.cursos;
    const termino = this.textoBusquedaCurso.toLowerCase();
    return this.cursos.filter(c => 
      c.asignatura?.nombre.toLowerCase().includes(termino) ||
      c.codigo_asignatura.toLowerCase().includes(termino)
    );
  }

  seleccionarCurso(curso: any) {
    this.cursoSeleccionado = curso;
    if (curso.cargaDocentes && curso.cargaDocentes.length > 0) {
      this.profesoresAsignados = curso.cargaDocentes.map((c: any) => ({
        profesor: this.profesores.find(p => p.id_usuario === c.id_usuario) || c.profesor,
        cantidad_horas: c.cantidad_horas
      }));
    } else {
      this.profesoresAsignados = [];
    }
  }

  // Se activa cuando seleccionas a alguien de la lista desplegable de Material
  agregarProfesorSeleccionado(event: any) {
    const profeSeleccionado = event.option.value;
    
    if (profeSeleccionado && !this.profesoresAsignados.find(pa => pa.profesor.id_usuario === profeSeleccionado.id_usuario)) {
      this.profesoresAsignados.push({ profesor: profeSeleccionado, cantidad_horas: 0 });
    }
    
    // Limpiamos el input para poder buscar otro
    this.profesorControl.setValue('');
  }

  // Método modificado para eliminar tanto visualmente como en la base de datos
  removerProfesor(index: number, id_usuario: number) {
    if (!this.cursoSeleccionado) return;

    if(confirm('¿Estás seguro de que quieres quitar a este profesor del curso?')) {
      this.cargaDocenteService.eliminarCarga(this.cursoSeleccionado.id_curso, id_usuario).subscribe({
        next: () => {
          this.profesoresAsignados.splice(index, 1);
          this.cargarDatos(); // Recargamos para actualizar los totales
        },
        error: (err) => {
          console.error(err);
          alert('Hubo un error al eliminar la asignación en la base de datos.');
        }
      });
    }
  }

  guardarAsignacion() {
    if (!this.cursoSeleccionado) return;

    const payload: AsignarCargaPayload = {
      id_curso: this.cursoSeleccionado.id_curso,
      profesores: this.profesoresAsignados.map(pa => ({
        id_usuario: pa.profesor.id_usuario,
        cantidad_horas: pa.cantidad_horas
      }))
    };

    this.cargaDocenteService.asignarCarga(payload).subscribe({
      next: () => {
        alert('Carga docente guardada con éxito.');
        this.cargarDatos();
        this.cursoSeleccionado = null;
      },
      error: (err) => {
        console.error(err);
        alert('Hubo un error al guardar la asignación.');
      }
    });
  }
}
