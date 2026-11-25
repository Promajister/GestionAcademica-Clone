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

  yearActual = 2026;

  // Filtros de la lista: nivel (o todos los pares/impares) y plan
  readonly NIVELES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  filtroNivel: number | 'PARES' | 'IMPARES' | 'TODOS' = 'PARES';
  filtroPlan: number | 'TODOS' = 'TODOS';

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
    // Todos los niveles: los filtros se aplican en pantalla
    this.cargaDocenteService.obtenerCursos(null, this.yearActual).subscribe(res => {
      this.cursos = res;
    });
    this.cargaDocenteService.obtenerProfesores().subscribe(res => {
      this.profesores = res;
    });
  }

  // Nivel de un curso: el semestre de su malla
  nivelDe(c: any): number {
    return c.malla?.semestre ?? c.semestre;
  }

  planDe(c: any): string {
    const p = c.malla?.plan;
    return p ? `${p.codigo_carrera} · Plan ${p.year} v${p.version}` : 'Sin plan';
  }

  // Planes presentes en los cursos, para el filtro
  get planes(): { id_plan: number; nombre: string }[] {
    const vistos = new Map<number, string>();
    for (const c of this.cursos) {
      if (c.malla?.plan) vistos.set(c.malla.plan.id_plan, this.planDe(c));
    }
    return [...vistos].map(([id_plan, nombre]) => ({ id_plan, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  get etiquetaNivel(): string {
    const f = this.filtroNivel;
    if (f === 'PARES') return 'Semestres pares (2do semestre)';
    if (f === 'IMPARES') return 'Semestres impares (1er semestre)';
    if (f === 'TODOS') return 'Todos los semestres';
    return `Semestre ${f}`;
  }

  get etiquetaPlan(): string {
    return this.filtroPlan === 'TODOS' ? 'Todos los planes' : (this.planes.find(p => p.id_plan === this.filtroPlan)?.nombre ?? '');
  }

  get cursosFiltrados() {
    const f = this.filtroNivel;
    const termino = this.textoBusquedaCurso.toLowerCase();
    return this.cursos
      .filter(c => {
        const n = this.nivelDe(c);
        return f === 'TODOS' || (f === 'PARES' ? n % 2 === 0 : f === 'IMPARES' ? n % 2 === 1 : n === f);
      })
      .filter(c => this.filtroPlan === 'TODOS' || c.malla?.plan?.id_plan === this.filtroPlan)
      .filter(c =>
        !termino ||
        c.asignatura?.nombre.toLowerCase().includes(termino) ||
        c.codigo_asignatura.toLowerCase().includes(termino)
      )
      .sort((a, b) => this.nivelDe(a) - this.nivelDe(b) || a.codigo_asignatura.localeCompare(b.codigo_asignatura) || a.grupo.localeCompare(b.grupo));
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
          alert(this.mensajeError(err, 'Hubo un error al eliminar la asignación en la base de datos.'));
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
        alert(this.mensajeError(err, 'Hubo un error al guardar la asignación.'));
      }
    });
  }

  // Muestra el mensaje de validación del backend (400/404) si viene
  private mensajeError(err: any, porDefecto: string): string {
    const msg = err?.error?.message;
    if (Array.isArray(msg)) return msg.join('\n');
    return typeof msg === 'string' ? msg : porDefecto;
  }
}
