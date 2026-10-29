import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HorarioApiService,
  CarreraDTO,
  PlanDTO,
  AsignaturaDTO,
  OrigenAsignatura,
  DiaSemana,
  BloqueGrillaDTO,
  BloqueExternoPayload,
  CreateAsignaturaPayload,
  UpdateAsignaturaPayload,
} from '../../services/horario-api.service';
import { SalasApiService, SalaDTO } from '../../services/salas-api.service';

interface BloqueFilaForm {
  dia: DiaSemana;
  bloque_inicio: number;
  bloque_fin: number;
  tipo_ubicacion: 'DEPTO' | 'EXTERNA';
  id_sala: number | null;
  sala_externa: string;
}

@Component({
  standalone: true,
  selector: 'app-horario-asignaturas',
  templateUrl: './horario-asignaturas.component.html',
  styleUrls: ['./horario-asignaturas.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class HorarioAsignaturasComponent implements OnInit {
  private horarioApi = inject(HorarioApiService);
  private salasApi = inject(SalasApiService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  carreras: CarreraDTO[] = [];
  planes: PlanDTO[] = [];
  salasActivas: SalaDTO[] = [];
  grilla: BloqueGrillaDTO[] = [];

  asignaturas: AsignaturaDTO[] = [];
  cargando = false;
  guardando = false;

  // Filtros
  filtroTexto = '';
  filtroCarrera: string | 'all' = 'all';
  filtroPlan: number | 'all' = 'all';
  filtroSemestre: number | 'all' = 2; // Semestre 2 para demo por defecto
  filtroOrigen: string | 'all' = 'all';

  // Modal Crear / Editar
  mostrarModal = false;
  asignaturaEditando: AsignaturaDTO | null = null;
  form: FormGroup;
  errorBackend: string | null = null;

  // Modal Confirmar Eliminar
  asignaturaPorEliminar: AsignaturaDTO | null = null;

  readonly DIAS: { dia: DiaSemana; label: string }[] = [
    { dia: 'LUNES', label: 'Lunes' },
    { dia: 'MARTES', label: 'Martes' },
    { dia: 'MIERCOLES', label: 'Miércoles' },
    { dia: 'JUEVES', label: 'Jueves' },
    { dia: 'VIERNES', label: 'Viernes' },
  ];

  readonly SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  constructor() {
    this.form = this.fb.group({
      id_carrera: [null, [Validators.required]],
      id_plan: [null, [Validators.required]],
      codigo: ['', [Validators.required, Validators.maxLength(30)]],
      nombre: ['', [Validators.required, Validators.maxLength(150)]],
      semestre: [2, [Validators.required, Validators.min(1), Validators.max(12)]],
      catedraSemanal: [4, [Validators.required, Validators.min(0), Validators.max(20)]],
      tallerSemanal: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
      labSemanal: [0, [Validators.required, Validators.min(0), Validators.max(20)]],
      bloques_semanales: [{ value: 4, disabled: true }, [Validators.required, Validators.min(1), Validators.max(20)]],
      cupo: [22, [Validators.required, Validators.min(1), Validators.max(100)]],
      origen: ['INTERNA' as OrigenAsignatura, [Validators.required]],
      bloques_externos: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  get bloquesArray(): FormArray {
    return this.form.get('bloques_externos') as FormArray;
  }

  esPropia(origen: string): boolean {
    return origen === 'PROPIA' || origen === 'INTERNA';
  }

  recalcularBloques(): void {
    const c = Number(this.form.get('catedraSemanal')?.value) || 0;
    const t = Number(this.form.get('tallerSemanal')?.value) || 0;
    const l = Number(this.form.get('labSemanal')?.value) || 0;
    this.form.patchValue({ bloques_semanales: c + t + l }, { emitEvent: false });
  }

  cargarDatosIniciales(): void {
    this.cargando = true;
    this.horarioApi.getCarreras().subscribe({
      next: (carreras) => {
        this.carreras = carreras;
        this.actualizarPlanesDisponibles();

        // Si existe carrera 311, seleccionarla en los filtros por defecto
        const c311 = carreras.find((c) => c.codigo === '311');
        if (c311) {
          this.filtroCarrera = c311.codigo;
          const p2025 = c311.planes.find(
            (p) => p.year === 2025 || p.anio === 2025 || p.nombre.includes('2025'),
          );
          if (p2025) {
            this.filtroPlan = p2025.id_plan;
          }
        }

        this.cargarAsignaturas();
      },
      error: () => {
        this.cargando = false;
      },
    });

    this.salasApi.listar(true).subscribe({
      next: (salas) => {
        this.salasActivas = salas;
      },
    });

    this.horarioApi.getGrilla().subscribe({
      next: (g) => {
        this.grilla = g;
      },
    });
  }

  actualizarPlanesDisponibles(): void {
    if (this.filtroCarrera === 'all') {
      this.planes = this.carreras.flatMap((c) => c.planes);
    } else {
      const c = this.carreras.find(
        (car) => car.codigo === this.filtroCarrera || String(car.id_carrera) === this.filtroCarrera,
      );
      this.planes = c ? c.planes : [];
    }
  }

  onFiltroCarreraChange(): void {
    this.actualizarPlanesDisponibles();
    this.filtroPlan = 'all';
    this.cargarAsignaturas();
  }

  onFiltroChange(): void {
    this.cargarAsignaturas();
  }

  cargarAsignaturas(): void {
    this.cargando = true;
    const params: {
      origen?: string;
      codigo_carrera?: string;
      id_carrera?: string;
      id_plan?: number;
      semestre?: number;
    } = {};

    if (this.filtroOrigen !== 'all') params.origen = this.filtroOrigen;
    if (this.filtroCarrera !== 'all') {
      params.codigo_carrera = String(this.filtroCarrera);
      params.id_carrera = String(this.filtroCarrera);
    }
    if (this.filtroPlan !== 'all') params.id_plan = Number(this.filtroPlan);
    if (this.filtroSemestre !== 'all') params.semestre = Number(this.filtroSemestre);

    this.horarioApi.getAsignaturas(params).subscribe({
      next: (data) => {
        this.asignaturas = data;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        const msg = err.error?.message || err.message;
        this.snack.open('Error al cargar asignaturas: ' + (Array.isArray(msg) ? msg.join(', ') : msg), 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  get asignaturasFiltradas(): AsignaturaDTO[] {
    const q = this.filtroTexto.trim().toLowerCase();
    if (!q) return this.asignaturas;
    return this.asignaturas.filter(
      (a) =>
        a.nombre.toLowerCase().includes(q) ||
        a.codigo.toLowerCase().includes(q) ||
        a.plan?.nombre?.toLowerCase().includes(q),
    );
  }

  // --- FORMULARIO Y MODAL ---
  planesParaForm(): PlanDTO[] {
    const idCar = this.form.get('id_carrera')?.value;
    if (!idCar) return [];
    const c = this.carreras.find(
      (car) => car.codigo === String(idCar) || String(car.id_carrera) === String(idCar),
    );
    return c ? c.planes : [];
  }

  onCarreraFormChange(): void {
    const planes = this.planesParaForm();
    if (planes.length > 0) {
      this.form.patchValue({ id_plan: planes[0].id_plan });
    } else {
      this.form.patchValue({ id_plan: null });
    }
  }

  abrirCrear(): void {
    this.asignaturaEditando = null;
    this.errorBackend = null;
    this.bloquesArray.clear();

    const idCarDefecto =
      this.filtroCarrera !== 'all' ? this.filtroCarrera : this.carreras[0]?.codigo || null;
    let idPlanDefecto = this.filtroPlan !== 'all' ? this.filtroPlan : null;

    if (!idPlanDefecto && idCarDefecto) {
      const c = this.carreras.find(
        (car) => car.codigo === idCarDefecto || String(car.id_carrera) === idCarDefecto,
      );
      idPlanDefecto = c?.planes[0]?.id_plan || null;
    }

    this.form.reset({
      id_carrera: idCarDefecto,
      id_plan: idPlanDefecto,
      codigo: '',
      nombre: '',
      semestre: this.filtroSemestre !== 'all' ? this.filtroSemestre : 2,
      catedraSemanal: 4,
      tallerSemanal: 0,
      labSemanal: 0,
      bloques_semanales: 4,
      cupo: 22,
      origen: 'INTERNA',
    });

    this.mostrarModal = true;
  }

  abrirEditar(a: AsignaturaDTO): void {
    this.asignaturaEditando = a;
    this.errorBackend = null;
    this.bloquesArray.clear();

    const catedra = a.catedraSemanal ?? a.bloques_semanales ?? 4;
    const taller = a.tallerSemanal ?? 0;
    const lab = a.labSemanal ?? 0;
    const idCarrera = a.plan?.codigo_carrera || a.plan?.id_carrera || null;

    this.form.patchValue({
      id_carrera: idCarrera,
      id_plan: a.id_plan,
      codigo: a.codigo,
      nombre: a.nombre,
      semestre: a.semestre,
      catedraSemanal: catedra,
      tallerSemanal: taller,
      labSemanal: lab,
      bloques_semanales: catedra + taller + lab,
      cupo: a.cupo,
      origen: this.esPropia(a.origen) ? 'INTERNA' : 'EXTERNA',
    });

    // Cargar bloques si es externa
    if (!this.esPropia(a.origen) && a.cursos && a.cursos.length > 0) {
      const bloques = a.cursos[0].bloques_horarios || [];
      this.reconstruirBloquesEnFormulario(bloques);
    }

    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.asignaturaEditando = null;
    this.errorBackend = null;
    this.bloquesArray.clear();
  }

  onOrigenChange(): void {
    const origen = this.form.get('origen')?.value;
    if (origen === 'EXTERNA' && this.bloquesArray.length === 0) {
      this.agregarFilaBloque();
    }
  }

  agregarFilaBloque(init?: Partial<BloqueFilaForm>): void {
    const fila = this.fb.group({
      dia: [init?.dia || 'LUNES', [Validators.required]],
      bloque_inicio: [init?.bloque_inicio || 1, [Validators.required]],
      bloque_fin: [init?.bloque_fin || 2, [Validators.required]],
      tipo_ubicacion: [init?.tipo_ubicacion || 'DEPTO', [Validators.required]],
      id_sala: [init?.id_sala || (this.salasActivas[0]?.id_sala ?? null)],
      sala_externa: [init?.sala_externa || ''],
    });

    this.bloquesArray.push(fila);
  }

  eliminarFilaBloque(index: number): void {
    this.bloquesArray.removeAt(index);
  }

  private reconstruirBloquesEnFormulario(bloques: any[]): void {
    const ordenados = [...bloques].sort((x, y) => {
      if (x.dia !== y.dia) return x.dia.localeCompare(y.dia);
      return x.bloque_numero - y.bloque_numero;
    });

    let i = 0;
    while (i < ordenados.length) {
      const actual = ordenados[i];
      let fin = actual.bloque_numero;
      let j = i + 1;
      while (
        j < ordenados.length &&
        ordenados[j].dia === actual.dia &&
        ordenados[j].bloque_numero === fin + 1 &&
        ordenados[j].id_sala === actual.id_sala &&
        ordenados[j].sala_externa === actual.sala_externa
      ) {
        fin = ordenados[j].bloque_numero;
        j++;
      }

      const tipoUbi: 'DEPTO' | 'EXTERNA' = actual.id_sala ? 'DEPTO' : 'EXTERNA';
      this.agregarFilaBloque({
        dia: actual.dia,
        bloque_inicio: actual.bloque_numero,
        bloque_fin: fin,
        tipo_ubicacion: tipoUbi,
        id_sala: actual.id_sala || null,
        sala_externa: actual.sala_externa || '',
      });

      i = j;
    }
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valor = this.form.getRawValue();
    const origen: string = valor.origen;

    const catedra = Number(valor.catedraSemanal) || 0;
    const taller = Number(valor.tallerSemanal) || 0;
    const lab = Number(valor.labSemanal) || 0;
    const bloquesTotales = catedra + taller + lab;

    if (bloquesTotales <= 0) {
      this.errorBackend = 'La suma de horas de cátedra, taller y laboratorio debe ser al menos 1 bloque semanal.';
      return;
    }

    let bloquesExternosPayload: BloqueExternoPayload[] | undefined = undefined;

    if (origen === 'EXTERNA') {
      const filas: BloqueFilaForm[] = valor.bloques_externos || [];
      if (filas.length === 0) {
        this.errorBackend = 'Las asignaturas externas deben tener al menos un bloque fijo configurado.';
        return;
      }

      bloquesExternosPayload = filas.map((f) => {
        const item: BloqueExternoPayload = {
          dia: f.dia,
          bloque_inicio: Number(f.bloque_inicio),
          bloque_fin: Number(f.bloque_fin),
        };
        if (f.tipo_ubicacion === 'DEPTO') {
          item.id_sala = Number(f.id_sala);
        } else {
          item.sala_externa = (f.sala_externa || '').trim() || 'Sala Externa';
        }
        return item;
      });
    }

    this.guardando = true;
    this.errorBackend = null;

    if (this.asignaturaEditando) {
      const payload: UpdateAsignaturaPayload = {
        nombre: valor.nombre,
        id_plan: Number(valor.id_plan),
        semestre: Number(valor.semestre),
        catedraSemanal: catedra,
        tallerSemanal: taller,
        labSemanal: lab,
        bloques_semanales: bloquesTotales,
        cupo: Number(valor.cupo),
        origen,
      };

      if (origen === 'EXTERNA' && bloquesExternosPayload) {
        payload.bloques_externos = bloquesExternosPayload;
      }

      this.horarioApi.updateAsignatura(this.asignaturaEditando.codigo, payload).subscribe({
        next: (res) => {
          this.guardando = false;
          this.snack.open(`Asignatura "${res.nombre}" actualizada exitosamente`, 'Cerrar', {
            duration: 3500,
          });
          this.cerrarModal();
          this.cargarAsignaturas();
        },
        error: (err) => {
          this.guardando = false;
          const msg = err.error?.message || 'Error al actualizar asignatura';
          const errorMsg = Array.isArray(msg) ? msg.join(', ') : String(msg);
          this.errorBackend = errorMsg;
          this.snack.open(errorMsg, 'Cerrar', { duration: 6000 });
        },
      });
    } else {
      const payload: CreateAsignaturaPayload = {
        codigo: valor.codigo.trim().toUpperCase(),
        nombre: valor.nombre.trim(),
        id_plan: Number(valor.id_plan),
        semestre: Number(valor.semestre),
        catedraSemanal: catedra,
        tallerSemanal: taller,
        labSemanal: lab,
        bloques_semanales: bloquesTotales,
        cupo: Number(valor.cupo),
        origen,
      };

      if (origen === 'EXTERNA' && bloquesExternosPayload) {
        payload.bloques_externos = bloquesExternosPayload;
      }

      this.horarioApi.createAsignatura(payload).subscribe({
        next: (res) => {
          this.guardando = false;
          this.snack.open(`Asignatura "${res.nombre}" creada exitosamente`, 'Cerrar', {
            duration: 3500,
          });
          this.cerrarModal();
          this.cargarAsignaturas();
        },
        error: (err) => {
          this.guardando = false;
          const msg = err.error?.message || 'Error al registrar asignatura';
          const errorMsg = Array.isArray(msg) ? msg.join(', ') : String(msg);
          this.errorBackend = errorMsg;
          this.snack.open(errorMsg, 'Cerrar', { duration: 6000 });
        },
      });
    }
  }

  pedirEliminar(a: AsignaturaDTO): void {
    this.asignaturaPorEliminar = a;
  }

  cerrarConfirmarEliminar(): void {
    this.asignaturaPorEliminar = null;
  }

  confirmarEliminar(): void {
    if (!this.asignaturaPorEliminar) return;
    const a = this.asignaturaPorEliminar;
    this.guardando = true;

    this.horarioApi.deleteAsignatura(a.codigo).subscribe({
      next: () => {
        this.guardando = false;
        this.asignaturaPorEliminar = null;
        this.snack.open(`Asignatura "${a.codigo}" eliminada correctamente`, 'Cerrar', {
          duration: 3500,
        });
        this.cargarAsignaturas();
      },
      error: (err) => {
        this.guardando = false;
        this.asignaturaPorEliminar = null;
        const msg = err.error?.message || 'Error al eliminar asignatura';
        this.snack.open(Array.isArray(msg) ? msg.join(', ') : msg, 'Cerrar', {
          duration: 6000,
        });
      },
    });
  }

  getHoraBloque(num: number): string {
    const b = this.grilla.find((g) => g.numero === num);
    return b ? `${b.hora_inicio}–${b.hora_fin}` : '';
  }
}
