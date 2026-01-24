import { Component, OnDestroy, OnInit, inject, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { jsPDF } from 'jspdf';
import { formatDateEs } from '../../utils/date-utils';
import { EstudiantesService, EstudianteDetalle, EstudianteResumen } from '../../services/estudiantes.service';
import { ActividadesEgresadosService } from '../../services/actividades-egresados.service';
import { Actividad, QueryActividadParams } from '../../services/actividades-estudiantes.service';


@Component({
  standalone: true,
  selector: 'app-egresados-registro',
  templateUrl: './egresados-registro.component.html',
  styleUrls: ['./egresados-registro.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
})

export class EgresadosRegistroComponent implements OnInit, OnDestroy {
  private estudiantesService = inject(EstudiantesService);
  private renderer = inject(Renderer2);
  private doc = inject(DOCUMENT);
  private snack = inject(MatSnackBar);

  egresados: EstudianteResumen[] = [];
  seleccionado: EstudianteResumen | null = null;
  detalle: EstudianteDetalle | null = null;

  searchTerm = '';
  cargandoLista = false;
  cargandoDetalle = false;
  mensajeError: string | null = null;

  pageIndex = 0;
  pageSize = 8;
  totalItems = 0;
  readonly pageSizeOptions = [5, 8, 12, 20];

  modalOpen = false;
  isSaving = false;
  cargandoModal = false;
  filtroModal = '';
  estudiantesModal: EstudianteResumen[] = [];
  seleccionados = new Set<string>();

  empleabilidadModalOpen = false;
  empleabilidadSaving = false;
  empleabilidadForm = {
    egresadoRut: '',
    lugarTrabajo: '',
    sector: '',
    sectorOtro: '',
    cargo: '',
    cargoOtro: '',
  };
  egresadoFichaModalOpen = false;
  egresadoFichaSaving = false;

  egresadoFichaForm = {
    nacionalidad: '',
    anioEgreso: null as number | null,
    notaTitulacion: null as number | null,
    fechaDefensa: '',

    celular: '',
    email: '',
    direccion: '',
    region: '',
    ciudad: '',
  };

  postgradoModalOpen = false;
  postgradoSaving = false;
  postgradoEditId: number | null = null;

  postgradoForm = {
    tipo: 'DIPLOMADO' as 'DIPLOMADO' | 'MAGISTER' | 'DOCTORADO' | 'OTRO',
    institucion: '',
    anioInicio: null as number | null,
    anioTermino: null as number | null,
    estado: 'EN_CURSO' as 'EN_CURSO' | 'FINALIZADO',
  };

  readonly tipoPostgradoOptions = [
    { value: 'DIPLOMADO', label: 'Diplomado' },
    { value: 'MAGISTER', label: 'Magíster' },
    { value: 'DOCTORADO', label: 'Doctorado' },
    { value: 'OTRO', label: 'Otro' },
  ];

  readonly estadoPostgradoOptions = [
    { value: 'EN_CURSO', label: 'En curso' },
    { value: 'FINALIZADO', label: 'Finalizado' },
  ];

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

  readonly REGIONES: { nombre: string; comunas: string[] }[] = [
    { nombre: 'Arica y Parinacota', comunas: ['Arica','Camarones','Putre','General Lagos'] },
    { nombre: 'Tarapacá', comunas: ['Iquique','Alto Hospicio','Pozo Almonte','Camiña','Colchane','Huara','Pica'] },
    { nombre: 'Antofagasta', comunas: ['Antofagasta','Mejillones','Sierra Gorda','Taltal','Calama','Ollagüe','San Pedro de Atacama','Tocopilla','María Elena'] },
    { nombre: 'Atacama', comunas: ['Copiapó','Caldera','Tierra Amarilla','Chañaral','Diego de Almagro','Vallenar','Freirina','Huasco','Alto del Carmen'] },
    { nombre: 'Coquimbo', comunas: ['La Serena','Coquimbo','Andacollo','La Higuera','Paihuano','Vicuña','Illapel','Canela','Los Vilos','Salamanca','Ovalle','Combarbalá','Monte Patria','Punitaqui','Río Hurtado'] },
    { nombre: 'Valparaíso', comunas: ['Valparaíso','Viña del Mar','Concón','Quilpué','Villa Alemana','Casablanca','Quintero','Puchuncaví','Limache','Olmué','San Antonio','Cartagena','El Quisco','El Tabo','Algarrobo','Santo Domingo','La Ligua','Cabildo','Papudo','Zapallar','Petorca','San Felipe','Llaillay','Catemu','Panquehue','Putaendo','Santa María','Los Andes','Calle Larga','Rinconada','San Esteban','Isla de Pascua','Juan Fernández'] },
    { nombre: 'Libertador General Bernardo O’Higgins', comunas: ['Rancagua','Machalí','Graneros','Doñihue','Requínoa','Rengo','Malloa','San Vicente','Las Cabras','Peumo','Pichidegua','San Fernando','Nancagua','Chimbarongo','Placilla','Santa Cruz','Lolol','Pumanque','Peralillo','Marchigüe','Pichilemu','La Estrella','Litueche','Navidad'] },
    { nombre: 'Maule', comunas: ['Talca','San Clemente','Pelarco','Río Claro','Maule','San Rafael','Curepto','Constitución','Empedrado','Linares','Colbún','Yerbas Buenas','Villa Alegre','Longaví','Retiro','Parral','Cauquenes','Chanco','Pelluhue','Curicó','Teno','Romeral','Rauco','Sagrada Familia','Hualañé','Licantén','Vichuquén'] },
    { nombre: 'Ñuble', comunas: ['Chillán','Chillán Viejo','Bulnes','Quillón','San Ignacio','Pinto','El Carmen','Yungay','Pemuco','Ñiquén','San Carlos','Coihueco','San Fabián','San Nicolás','Trehuaco','Ninhue','Portezuelo','Cobquecura','Coelemu','Quirihue'] },
    { nombre: 'Biobío', comunas: ['Concepción','Talcahuano','Hualpén','San Pedro de la Paz','Chiguayante','Penco','Tomé','Florida','Hualqui','Coronel','Lota','Santa Juana','Los Ángeles','Mulchén','Nacimiento','Negrete','San Rosendo','Laja','Yumbel','Cabrero','Tucapel','Antuco','Quilleco','Santa Bárbara','Quilaco','Alto Biobío','Arauco','Curanilahue','Lebu','Los Álamos','Cañete','Contulmo','Tirúa'] },
    { nombre: 'La Araucanía', comunas: ['Temuco','Padre Las Casas','Vilcún','Lautaro','Perquenco','Galvarino','Nueva Imperial','Carahue','Saavedra','Toltén','Teodoro Schmidt','Pitrufquén','Gorbea','Loncoche','Villarrica','Pucón','Curarrehue','Freire','Melipeuco','Cunco','Angol','Renaico','Collipulli','Ercilla','Los Sauces','Traiguén','Lumaco','Purén','Victoria','Curacautín','Lonquimay'] },
    { nombre: 'Los Ríos', comunas: ['Valdivia','Corral','Lanco','Mariquina','Máfil','Los Lagos','Paillaco','Panguipulli','La Unión','Futrono','Lago Ranco','Río Bueno'] },
    { nombre: 'Los Lagos', comunas: ['Puerto Montt','Puerto Varas','Frutillar','Llanquihue','Cochamó','Calbuco','Maullín','Los Muermos','Osorno','Puerto Octay','Purranque','Puyehue','Río Negro','San Juan de la Costa','San Pablo','Castro','Ancud','Quellón','Dalcahue','Curaco de Vélez','Puqueldón','Queilén','Quinchao','Chonchi','Quemchi'] },
    { nombre: 'Aysén del General Carlos Ibáñez del Campo', comunas: ['Coyhaique','Lago Verde','Aysén','Cisnes','Guaitecas','Cochrane','O’Higgins','Tortel','Chile Chico','Río Ibáñez'] },
    { nombre: 'Magallanes y de la Antártica Chilena', comunas: ['Punta Arenas','Río Verde','Laguna Blanca','San Gregorio','Porvenir','Primavera','Timaukel','Puerto Natales','Torres del Paine','Cabo de Hornos','Antártica'] },
    { nombre: 'Metropolitana de Santiago', comunas: ['Santiago','Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Vitacura','Puente Alto','Pirque','San José de Maipo','Colina','Lampa','Tiltil','Melipilla','María Pinto','Curacaví','Alhué','San Pedro','Talagante','El Monte','Isla de Maipo','Padre Hurtado','Peñaflor'] },
  ];
  ciudadesDisponibles: string[] = [];

  ngOnInit(): void {
    this.cargarEgresados();
  }

  ngOnDestroy(): void {
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  private syncModalBodyClass(): void {
    if (this.modalOpen || this.empleabilidadModalOpen) {
      this.renderer.addClass(this.doc.body, 'student-modal-open');
      return;
    }
    this.renderer.removeClass(this.doc.body, 'student-modal-open');
  }

  cargarEgresados(): void {
    this.cargandoLista = true;
    this.mensajeError = null;
    this.estudiantesService.listar({ egresado: true }).subscribe({
      next: (items) => {
        this.egresados = items || [];
        this.actualizarPaginacion();
        if (this.seleccionado) {
          this.seleccionado =
            items.find((e) => e.rut === this.seleccionado!.rut) || null;
        }
        if (this.seleccionado) {
          this.obtenerDetalle(this.seleccionado.rut, false);
        } else {
          this.detalle = null;
        }
        this.cargandoLista = false;
      },
      error: () => {
        this.cargandoLista = false;
        this.mensajeError = 'No se pudo cargar la lista de egresados.';
      },
    });
  }

  aplicarFiltros(): void {
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.pageIndex = 0;
    this.actualizarPaginacion();
  }

  get egresadosFiltrados(): EstudianteResumen[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.egresados;
    return this.egresados.filter((e) => {
      const nombre = (e.nombre || '').toLowerCase();
      const rut = (e.rut || '').toLowerCase();
      const plan = (e.plan || '').toLowerCase();
      return (
        nombre.includes(term) || rut.includes(term) || plan.includes(term)
      );
    });
  }

  get egresadosPaginados(): EstudianteResumen[] {
    const startIndex = this.pageIndex * this.pageSize;
    return this.egresadosFiltrados.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  actualizarPaginacion(): void {
    this.totalItems = this.egresadosFiltrados.length;
    const maxPage = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    if (this.pageIndex > maxPage) {
      this.pageIndex = maxPage;
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.actualizarPaginacion();
  }
 
  obtenerDetalle(rut: string, resetDetalle = true): void {
    this.cargandoDetalle = true;
    if (resetDetalle) {
      this.detalle = null;
    }
    this.estudiantesService.obtenerDetalle(rut).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
        this.cargandoDetalle = false;
      },
      error: () => {
        this.cargandoDetalle = false;
        this.mensajeError = 'No se pudo cargar el detalle del egresado.';
      },
    });
  }

  abrirModal(): void {
    this.modalOpen = true;
    this.syncModalBodyClass();
    this.cargarModal();
  }

  cerrarModal(): void {
    this.modalOpen = false;
    this.filtroModal = '';
    this.seleccionados.clear();
    this.syncModalBodyClass();
  }

  abrirEmpleabilidadModal(): void {
    if (!this.seleccionado) return;
    this.empleabilidadForm = {
      egresadoRut: this.seleccionado.rut,
      lugarTrabajo: '',
      sector: '',
      sectorOtro: '',
      cargo: '',
      cargoOtro: '',
    };
    this.empleabilidadModalOpen = true;
    this.syncModalBodyClass();
  }

  cerrarEmpleabilidadModal(): void {
    this.empleabilidadModalOpen = false;
    this.syncModalBodyClass();
  }

  empleabilidadValida(): boolean {
    if (!this.empleabilidadForm.egresadoRut) return false;
    if (!this.empleabilidadForm.lugarTrabajo.trim()) return false;
    if (!this.empleabilidadForm.sector) return false;
    if (this.empleabilidadForm.sector === 'otro' && !this.empleabilidadForm.sectorOtro.trim()) {
      return false;
    }
    if (!this.empleabilidadForm.cargo) return false;
    if (this.empleabilidadForm.cargo === 'otro' && !this.empleabilidadForm.cargoOtro.trim()) {
      return false;
    }
    return true;
  }

  guardarEmpleabilidad(): void {
    if (!this.empleabilidadValida()) return;
    const rut = this.empleabilidadForm.egresadoRut;
    const payload = {
      lugarTrabajo: this.empleabilidadForm.lugarTrabajo.trim(),
      sector: this.empleabilidadForm.sector,
      sectorOtro: this.empleabilidadForm.sector === 'otro'
        ? this.empleabilidadForm.sectorOtro.trim()
        : null,
      cargo: this.empleabilidadForm.cargo,
      cargoOtro: this.empleabilidadForm.cargo === 'otro'
        ? this.empleabilidadForm.cargoOtro.trim()
        : null,
    };

    this.empleabilidadSaving = true;
    this.estudiantesService.guardarEmpleabilidad(rut, payload).subscribe({
      next: () => {
        this.empleabilidadSaving = false;
        this.snack.open('Empleabilidad guardada.', 'OK', { duration: 3000 });
        this.cerrarEmpleabilidadModal();

        // ✅ refresca la ficha para que se vean los datos laborales guardados
        if (this.seleccionado) {
          this.obtenerDetalle(this.seleccionado.rut, false);
        }
      },
      error: () => {
        this.empleabilidadSaving = false;
        this.snack.open('No se pudo guardar la empleabilidad.', 'Cerrar', {
          duration: 4000,
        });
      },
    });
  }

  abrirEgresadoFichaModal(): void {
    if (!this.detalle || !this.detalle.egresado) return;

    const f = this.detalle.egresadoFicha;
    this.egresadoFichaForm = {
      nacionalidad: f?.nacionalidad ?? '',
      anioEgreso: f?.anioEgreso ?? null,
      notaTitulacion: f?.notaTitulacion ?? null,
      fechaDefensa: this.ddmmyyyyToDateInput(f?.fechaDefensa),

      celular: f?.celular ?? '',
      email: f?.email ?? '',
      direccion: f?.direccion ?? '',
      region: f?.region ?? '',
      ciudad: f?.ciudad ?? '',
    };

    this.egresadoFichaModalOpen = true;
    this.syncModalBodyClass();
    this.onRegionChange(this.egresadoFichaForm.region);

  }

  onRegionChange(regionNombre: string | null): void {
    const region = this.REGIONES.find(r => r.nombre === regionNombre);
    this.ciudadesDisponibles = region ? region.comunas : [];

    this.egresadoFichaForm.ciudad = '';
  }

  cerrarEgresadoFichaModal(): void {
    this.egresadoFichaModalOpen = false;
    this.syncModalBodyClass();
  }

  guardarEgresadoFicha(): void {
    if (!this.seleccionado) return;
    
    const rut = this.seleccionado.rut;
  
    const nota = this.clampNota(this.egresadoFichaForm.notaTitulacion);

    if (Number.isNaN(nota)) {
      this.snack.open(
        'La nota de titulación debe estar entre 1.0 y 7.0',
        'Cerrar',
        { duration: 3500 },
      );
      return;
    }

    const toNumOrNull = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const toStrOrNull = (v: any) => {
      const s = (v ?? '').toString().trim();
      return s ? s : null;
    };

    const payload = {
      nacionalidad: toStrOrNull(this.egresadoFichaForm.nacionalidad),
      anioEgreso: toNumOrNull(this.egresadoFichaForm.anioEgreso),
      notaTitulacion: nota === null ? null : nota,
      fechaDefensa: toStrOrNull(this.egresadoFichaForm.fechaDefensa), 

      celular: toStrOrNull(this.egresadoFichaForm.celular),
      email: toStrOrNull(this.egresadoFichaForm.email),
      direccion: toStrOrNull(this.egresadoFichaForm.direccion),
      region: toStrOrNull(this.egresadoFichaForm.region),
      ciudad: toStrOrNull(this.egresadoFichaForm.ciudad),
    };

    this.egresadoFichaSaving = true;
    this.estudiantesService.upsertEgresadoFicha(rut, payload).subscribe({
      next: () => {
        this.egresadoFichaSaving = false;
        this.snack.open('Ficha de egresado guardada.', 'OK', { duration: 3000 });
        this.cerrarEgresadoFichaModal();
        this.obtenerDetalle(rut, false); // refresca
      },
      error: () => {
        this.egresadoFichaSaving = false;
        this.snack.open('No se pudo guardar la ficha de egresado.', 'Cerrar', { duration: 4000 });
      },
    });
  }

  abrirPostgradoCrear(): void {
    this.postgradoEditId = null;
    this.postgradoForm = { tipo: 'DIPLOMADO', institucion: '', anioInicio: null, anioTermino: null, estado: 'EN_CURSO' };
    this.postgradoModalOpen = true;
    this.syncModalBodyClass();
  }

  abrirPostgradoEditar(p: any): void {
    this.postgradoEditId = p.id;
    this.postgradoForm = {
      tipo: p.tipo,
      institucion: p.institucion ?? '',
      anioInicio: p.anioInicio ?? null,
      anioTermino: p.anioTermino ?? null,
      estado: p.estado,
    };
    this.postgradoModalOpen = true;
    this.syncModalBodyClass();
  }

  cerrarPostgradoModal(): void {
    this.postgradoModalOpen = false;
    this.syncModalBodyClass();
  }

  guardarPostgrado(): void {
    if (!this.seleccionado) return;
    if (!this.postgradoForm.institucion.trim()) return;

    const rut = this.seleccionado.rut;
    const payload = {
      tipo: this.postgradoForm.tipo,
      institucion: this.postgradoForm.institucion.trim(),
      anioInicio: this.postgradoForm.anioInicio ?? null,
      anioTermino: this.postgradoForm.anioTermino ?? null,
      estado: this.postgradoForm.estado,
    };

    this.postgradoSaving = true;

    const obs = this.postgradoEditId
      ? this.estudiantesService.actualizarPostgrado(this.postgradoEditId, payload)
      : this.estudiantesService.crearPostgrado(rut, payload);

    obs.subscribe({
      next: () => {
        this.postgradoSaving = false;
        this.snack.open('Postgrado guardado.', 'OK', { duration: 3000 });
        this.cerrarPostgradoModal();
        this.obtenerDetalle(rut, false);
      },
      error: () => {
        this.postgradoSaving = false;
        this.snack.open('No se pudo guardar el postgrado.', 'Cerrar', { duration: 4000 });
      },
    });
  }

  eliminarPostgrado(id: number): void {
    if (!this.seleccionado) return;
    const rut = this.seleccionado.rut;

    this.estudiantesService.eliminarPostgrado(id).subscribe({
      next: () => {
        this.snack.open('Postgrado eliminado.', 'OK', { duration: 2500 });
        this.obtenerDetalle(rut, false);
      },
      error: () => {
        this.snack.open('No se pudo eliminar el postgrado.', 'Cerrar', { duration: 4000 });
      },
    });
  }

  cargarModal(): void {
    this.cargandoModal = true;
    this.estudiantesService.listar().subscribe({
      next: (items) => {
        this.estudiantesModal = items || [];
        this.cargandoModal = false;
      },
      error: () => {
        this.cargandoModal = false;
      },
    });
  }

  get estudiantesModalFiltrados(): EstudianteResumen[] {
    const term = this.filtroModal.trim().toLowerCase();
    if (!term) return this.estudiantesModal;
    return this.estudiantesModal.filter((e) => {
      const nombre = (e.nombre || '').toLowerCase();
      const rut = (e.rut || '').toLowerCase();
      const plan = (e.plan || '').toLowerCase();
      return (
        nombre.includes(term) || rut.includes(term) || plan.includes(term)
      );
    });
  }

  toggleSeleccion(estudiante: EstudianteResumen): void {
    if (estudiante.egresado) return;
    if (this.seleccionados.has(estudiante.rut)) {
      this.seleccionados.delete(estudiante.rut);
      return;
    }
    this.seleccionados.add(estudiante.rut);
  }

  marcarComoEgresados(): void {
    if (this.seleccionados.size === 0) return;
    this.isSaving = true;
    const ops = Array.from(this.seleccionados).map((rut) =>
      this.estudiantesService.actualizarEgresado(rut, true),
    );

    forkJoin(ops).subscribe({
      next: () => {
        this.isSaving = false;
        this.cerrarModal();
        this.cargarEgresados();
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  formatearRut(rut?: string | null): string {
    if (!rut) return '-';
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length <= 1) return clean;
    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1);
    const reversed = cuerpo.split('').reverse();
    const withDots = reversed
      .map((digit, index) =>
        (index + 1) % 3 === 0 && index + 1 !== reversed.length
          ? `${digit}.`
          : digit,
      )
      .join('');
    return `${withDots.split('').reverse().join('')}-${dv}`;
  }

  private clampNota(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;

    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n)) return null;

    if (n < 1 || n > 7) return NaN;

    return n;
  }

  notaTitulacionValida(): boolean {
    const n = this.clampNota(this.egresadoFichaForm.notaTitulacion);
    return n === null || (Number.isFinite(n) && !Number.isNaN(n));
  }

  formatearNumero(value?: number | null): string {
    if (value === null || value === undefined) return '-';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(1);
  }

  formatearFecha(value?: string | Date | null): string {
    if (!value) return '-';

    if (value instanceof Date) {
      return formatDateEs(value.toISOString());
    }

    return formatDateEs(value);
  }

  private async cargarLogo(
    path: string,
  ): Promise<{ data: string; width: number; height: number } | null> {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo cargar el logo'));
        img.src = dataUrl;
      });
      return { data: dataUrl, width: image.width, height: image.height };
    } catch {
      return null;
    }
  }

  async exportarPdf(): Promise<void> {
    if (!this.detalle) return;
    const detalle = this.detalle;

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 52;
    const bottom = 54;
    const contentW = pageWidth - margin * 2;

    const colors = {
      text: '#111827',
      muted: '#6b7280',
      line: '#e5e7eb',
      border: '#d1d5db',
      headerFill: '#f8fafc',
      tableHead: '#f1f5f9',
    };

    const safe = (v: any) => (v === null || v === undefined || v === '' ? '-' : String(v));

    const setFont = (size: number, style: 'normal' | 'bold' = 'normal', color = colors.text) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(color);
    };

    const drawLine = (yy: number) => {
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, yy, pageWidth - margin, yy);
    };

    const [logoUta, logoFeh] = await Promise.all([
      this.cargarLogo('assets/img/uta.png'),
      this.cargarLogo('assets/img/feh.png'),
    ]);

    const drawLogo = (
      logo: { data: string; width: number; height: number } | null,
      boxX: number,
      boxY: number,
      boxW: number,
      boxH: number,
    ) => {
      if (!logo) return;
      const scale = Math.min(boxW / logo.width, boxH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      const x = boxX + (boxW - w) / 2;
      const yy = boxY + (boxH - h) / 2;
      doc.addImage(logo.data, 'PNG', x, yy, w, h);
    };

    const headerH = 92;

    const drawHeader = () => {
      doc.setFillColor(colors.headerFill);
      doc.rect(0, 0, pageWidth, headerH, 'F');

      drawLogo(logoUta, margin, 16, 76, 56);
      drawLogo(logoFeh, pageWidth - margin - 76, 8, 76, 76);

      setFont(14, 'bold', colors.text);
      doc.text('FICHA DEL EGRESADO', pageWidth / 2, 36, { align: 'center' as any });

      setFont(10, 'normal', colors.muted);
      doc.text('Registro de egresados', pageWidth / 2, 56, { align: 'center' as any });

      doc.setDrawColor(colors.line);
      doc.line(margin, headerH, pageWidth - margin, headerH);
    };

    const contentStartY = () => headerH + 22;

    let y = contentStartY();

    const addPageWithHeader = () => {
      doc.addPage();
      drawHeader();
      y = contentStartY();
    };

    const ensure = (needed: number) => {
      if (y + needed <= pageHeight - bottom) return;
      addPageWithHeader();
    };

    drawHeader();
    y = contentStartY();

    const now = new Date();
    const fecha = formatDateEs(now);
    const hora = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    setFont(13, 'bold', colors.text);
    doc.text(safe(detalle.nombre), pageWidth / 2, y, { align: 'center' as any });
    y += 16;

    setFont(10, 'normal', colors.muted);
    doc.text(
      `${this.formatearRut(detalle.rut)}  •  ${safe(detalle.plan)}`,
      pageWidth / 2,
      y,
      { align: 'center' as any },
    );

    y += 14;

    setFont(9, 'normal', colors.muted);
    doc.text(`Emitido: ${fecha}  ${hora}`, pageWidth / 2, y, { align: 'center' as any });
    y += 18;

    drawLine(y);
    y += 18;

    const section = (title: string, rows: [string, string][]) => {
      y += 18;
      ensure(70);

      setFont(11, 'bold', colors.text);
      doc.text(title.toUpperCase(), margin, y);

      y += 8;
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 260, y);

      y += 14;

      const labelW = 170;
      const valueW = contentW - labelW;

      rows.forEach(([label, value]) => {
        const v = safe(value);

        setFont(9, 'normal', colors.text);
        const lines = doc.splitTextToSize(v, valueW - 14);
        const rowH = Math.max(22, lines.length * 12 + 10);

        ensure(rowH + 12);

        doc.setDrawColor(colors.border);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentW, rowH);

        doc.setDrawColor(colors.line);
        doc.line(margin + labelW, y, margin + labelW, y + rowH);

        setFont(9, 'bold', colors.muted);
        doc.text(`${label}:`, margin + 10, y + 15);

        setFont(9, 'normal', colors.text);
        doc.text(lines, margin + labelW + 10, y + 15);

        y += rowH;
      });

      y += 16;
    };

    const ficha = (detalle as any).egresadoFicha;
    const emp = (detalle as any).empleabilidad;

    // helpers para “otro”
    const labelSector = () =>
      emp?.sector === 'otro' ? (emp?.sectorOtro || 'Otro') : (emp?.sector || '-');

    const labelCargo = () =>
      emp?.cargo === 'otro' ? (emp?.cargoOtro || 'Otro') : (emp?.cargo || '-');

    const drawSimpleTitle = (title: string) => {
      y += 18;
      ensure(70);
      setFont(11, 'bold', colors.text);
      doc.text(title, margin, y);
      y += 8;
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, y, margin + 260, y);
      y += 14;
    };

    const drawTable = (
      cols: { label: string; w: number }[],
      rows: (string | string[])[][],
    ) => {
      const headH = 22;

      const drawTableHead = () => {
        ensure(headH + 10);
        doc.setDrawColor(colors.border);
        doc.setFillColor(colors.tableHead);
        doc.rect(margin, y, contentW, headH, 'FD');
        setFont(9, 'bold', colors.text);
        let x = margin;
        cols.forEach((c, idx) => {
          doc.text(c.label, x + 8, y + 15);
          x += c.w;
          doc.setDrawColor(colors.line);
          if (idx < cols.length - 1) {
            doc.line(x, y, x, y + headH);
          }
        });
        y += headH;
      };

      drawTableHead();

      const rowHBase = 22;

      rows.forEach((r) => {
        const wrapped: string[][] = r.map((cell, i) => {
          const txt = safe(cell as any);
          const maxW = cols[i].w - 14;
          setFont(9, 'normal', colors.text);
          return doc.splitTextToSize(txt, maxW) as string[];
        });

        const maxLines = Math.max(...wrapped.map((w) => w.length));
        const rowH = Math.max(rowHBase, maxLines * 12 + 10);

        if (y + rowH > pageHeight - bottom) {
          addPageWithHeader();
          drawTableHead();
        }

        doc.setDrawColor(colors.border);
        doc.setLineWidth(1);
        doc.rect(margin, y, contentW, rowH);

        let x = margin;
        cols.forEach((c, i) => {
          x += c.w;
          doc.setDrawColor(colors.line);
          if (i < cols.length - 1) {
            doc.line(x, y, x, y + rowH);
          }
        });

        let cx = margin;
        wrapped.forEach((lines, i) => {
          const colW = cols[i].w;

          if (i === 0) {
            doc.text(lines[0] ?? '-', cx + colW / 2, y + 15, { align: 'center' as any });
            cx += colW;
            return;
          }

          const isEstado = i === cols.length - 1;
          if (isEstado) {
            const txt = safe(r[i] as any);
            doc.text(txt, cx + colW / 2, y + 15, { align: 'center' as any });
            cx += colW;
            return;
          }

          // Resto normal con wrap
          doc.text(lines, cx + 8, y + 15);
          cx += colW;
        });

        y += rowH;
      });

      y += 14;
    };

    // 1) Datos básicos y académicos
    section('Datos básicos y académicos', [
      ['RUT', this.formatearRut(detalle.rut)],
      ['Nombre completo', safe(detalle.nombre)],
      ['Sexo', safe((detalle as any).genero)],
      ['Fecha de nacimiento', this.formatearFecha((detalle as any).anio_nacimiento)],
      ['Nacionalidad', safe(ficha?.nacionalidad)],
      ['Año de ingreso a la carrera', safe((detalle as any).anio_ingreso)],
      ['Año de egreso', safe(ficha?.anioEgreso)],
      ['Nota de titulación', this.formatearNumero(ficha?.notaTitulacion ?? null)],
      ['Fecha de defensa', this.formatearFecha(ficha?.fechaDefensa ?? null)],
    ]);

    // 2) Contacto (del egresado)
    section('Datos de contacto', [
      ['Celular', safe(ficha?.celular)],
      ['Email', safe(ficha?.email)],
      ['Dirección', safe(ficha?.direccion)],
      ['Región', safe(ficha?.region)],
      ['Ciudad', safe(ficha?.ciudad)],
    ]);

    // 3) Laboral
    section('Datos laborales', [
      ['Lugar de trabajo', safe(emp?.lugarTrabajo)],
      ['Sector laboral', safe(labelSector())],
      ['Cargo actual', safe(labelCargo())],
    ]);

    addPageWithHeader();

    // 4) Postgrados (tabla)
    const postgrados = (ficha?.postgrados || []) as any[];

    const prettyEstado = (e: string) =>
      e === 'EN_CURSO' ? 'En curso' : e === 'FINALIZADO' ? 'Finalizado' : e;

    const prettyTipo = (t: string) =>
      t === 'DIPLOMADO' ? 'Diplomado'
      : t === 'MAGISTER' ? 'Magíster'
      : t === 'DOCTORADO' ? 'Doctorado'
      : t === 'OTRO' ? 'Otro'
      : t;

    drawSimpleTitle('ESTUDIOS DE POSTGRADO');

    if (!postgrados.length) {
      setFont(10, 'normal', colors.muted);
      doc.text('Sin postgrados registrados.', margin, y);
      y += 16;
    } else {
        const colsPg = [
          { label: 'Nro', w: 34 },
          { label: 'Tipo', w: 90 },
          { label: 'Institución', w: 210 },
          { label: 'Inicio', w: 60 },
          { label: 'Término', w: 60 },
          { label: 'Estado', w: contentW - (34 + 90 + 210 + 60 + 60) }, 
        ];

        const rowsPg = postgrados.map((p: any, idx: number) => ([
          String(idx + 1),
          prettyTipo(safe(p?.tipo)),
          safe(p?.institucion),
          safe(p?.anioInicio),
          safe(p?.anioTermino),
          prettyEstado(safe(p?.estado)),
        ]));


      drawTable(colsPg, rowsPg);
    }

    drawSimpleTitle('ACTIVIDADES ASOCIADAS');

    const actividades = (this.actividadesAsociadas || []) as any[];

    if (!actividades.length) {
      setFont(10, 'normal', colors.muted);
      doc.text('Sin actividades asociadas.', margin, y);
      y += 16;
    } else {
      const colsAct = [
        { label: 'Nro', w: 34 },
        { label: 'Actividad', w: 220 },
        { label: 'Fecha', w: 110 },
        { label: 'Horario', w: 85 },
        { label: 'Lugar', w: contentW - (34 + 220 + 110 + 85) },
      ];

      const rowsAct = actividades.map((a: any, idx: number) => {
        const nombre = safe(a?.nombre_actividad ?? a?.titulo ?? a?.nombre);
        const fechaAct = this.formatearFecha(a?.fecha ?? a?.fechaRegistro);
        const horario = safe(a?.horario);
        const lugar = safe(a?.lugar ?? a?.descripcion);
        return [String(idx + 1), nombre, fechaAct, horario, lugar];
      });

      drawTable(colsAct, rowsAct);
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(colors.line);
      doc.setLineWidth(1);
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);
      setFont(9, 'normal', colors.muted);
      doc.text('Gestion Academica • Ficha de egresado', margin, pageHeight - 18);
      doc.text(`Pagina ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 18, {
        align: 'right' as any,
      });
    }

    doc.save(`egresado_${detalle.rut}.pdf`);
  }

  private ddmmyyyyToDateInput(value: string | null | undefined): string {
    if (!value) return '';

    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';

    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`; // lo que necesita el input date
  }

  private actividadesEgresadosService = inject(ActividadesEgresadosService);

  actividadesAsociadas: Actividad[] = [];
  cargandoActividades = false;

  private cargarActividadesEgresado(rut: string) {
    this.cargandoActividades = true;
    this.actividadesAsociadas = [];

    this.actividadesEgresadosService
      .listarPorEgresadoRut(rut, { page: 1, limit: 1000 })
      .subscribe({
        next: (resp) => {
          this.actividadesAsociadas = resp.items ?? [];
          this.cargandoActividades = false;
        },
        error: () => {
          this.cargandoActividades = false;
          this.actividadesAsociadas = [];
        },
      });
  }

  seleccionar(estudiante: EstudianteResumen): void {
    this.seleccionado = estudiante;
    this.obtenerDetalle(estudiante.rut, true);      
    this.cargarActividadesEgresado(estudiante.rut);
  }
}
