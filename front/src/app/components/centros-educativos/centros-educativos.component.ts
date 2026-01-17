import { Component, inject, PLATFORM_ID, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule }   from '@angular/material/icon';
import { MatCardModule }   from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule }  from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, NativeDateAdapter, MAT_DATE_FORMATS, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';


// APIs
import {
  CentrosApiService,
  CentroEducativoDTO,
  TrabajadorDTO,
  CreateCentroPayload,
  UpdateCentroPayload,
} from '../../services/centros-api.service';
import { TrabajadoresApiService } from '../../services/trabajadores-api.service';
import { PracticasService, Practica, EstadoPractica } from '../../services/practicas.service';
import { OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// === tipos compatibles con tu enum Prisma ===
type TipoCentro = 'PARTICULAR' | 'PARTICULAR_SUBVENCIONADO' | 'SLEP' | 'NO_CONVENCIONAL';
type Convenio   = 'Marco SLEP' | 'Solicitud directa' | 'ADEP' | string;

interface CentroEducativo {
  id: number;
  nombre: string;
  rbd?: string | null;
  tipo: TipoCentro;
  region: string;
  comuna: string;
  convenio?: Convenio;
  direccion?: string | null;
  url_rrss?: string | null;
  telefono?: number | string | null;
  correo?: string | null;
  fecha_inicio_asociacion?: string | null; // YYYY-MM-DD
}

type CentroDetalle = CentroEducativo & {
  trabajadores?: TrabajadorDTO[];
};

@Injectable()
export class CustomDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: Object): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  override parse(value: string): Date | null {
    if (!value) return null;
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          return date;
        }
      }
    }
    return super.parse(value);
  }
}

export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  standalone: true,
  selector: 'app-centros-educativos',
  templateUrl: './centros-educativos.component.html',
  styleUrls: ['./centros-educativos.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
  ],
})
export class CentrosEducativosComponent implements OnInit {
  private snack = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID);

  // APIs
  private centrosApi = inject(CentrosApiService);
  private trabajadoresApi = inject(TrabajadoresApiService);
  private practicasApi = inject(PracticasService);

  // ===== UI =====
  showForm = false;
  isEditing = false;
  sortAZ = true;
  isLoading = false;
  soloLecturaVinculacion = false;

  // Verificar si el usuario es jefatura (solo lectura)
  get esJefatura(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const roleStr = localStorage.getItem('app.selectedRole');
      if (!roleStr) return false;
      const role = JSON.parse(roleStr);
      return role?.id === 'jefatura';
    } catch {
      return false;
    }
  }

  // Está en modo solo lectura si es jefatura o vinculacion
  get esSoloLectura(): boolean {
    return this.esJefatura || this.soloLecturaVinculacion;
  }

  // ===== paginación (back) =====
  pageIndex = 0;        
  pageSize = 5;
  totalItems = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];

  // ===== filtros (lista) =====
  searchTerm = '';
  selectedTipo: 'all' | TipoCentro = 'all';

  // ===== regiones y comunas =====
  readonly REGIONES: { nombre: string; comunas: string[] }[] = [
    { nombre: 'Región de Arica y Parinacota', comunas: ['Arica','Camarones','Putre','General Lagos'] },
    { nombre: 'Región de Tarapacá', comunas: ['Iquique','Alto Hospicio','Pozo Almonte','Camiña','Colchane','Huara','Pica'] },
    { nombre: 'Región de Antofagasta', comunas: ['Antofagasta','Mejillones','Sierra Gorda','Taltal','Calama','Ollagüe','San Pedro de Atacama','Tocopilla','María Elena'] },
    { nombre: 'Región de Atacama', comunas: ['Copiapó','Caldera','Tierra Amarilla','Chañaral','Diego de Almagro','Vallenar','Freirina','Huasco','Alto del Carmen'] },
    { nombre: 'Región de Coquimbo', comunas: ['La Serena','Coquimbo','Andacollo','La Higuera','Paihuano','Vicuña','Illapel','Canela','Los Vilos','Salamanca','Ovalle','Combarbalá','Monte Patria','Punitaqui','Río Hurtado'] },
    { nombre: 'Región de Valparaíso', comunas: ['Valparaíso','Viña del Mar','Concón','Quilpué','Villa Alemana','Casablanca','Quintero','Puchuncaví','Limache','Olmué','San Antonio','Cartagena','El Quisco','El Tabo','Algarrobo','Santo Domingo','La Ligua','Cabildo','Papudo','Zapallar','Petorca','San Felipe','Llaillay','Catemu','Panquehue','Putaendo','Santa María','Los Andes','Calle Larga','Rinconada','San Esteban','Isla de Pascua','Juan Fernández'] },
    { nombre: 'Región del Libertador General Bernardo O’Higgins', comunas: ['Rancagua','Machalí','Graneros','Doñihue','Requínoa','Rengo','Malloa','San Vicente','Las Cabras','Peumo','Pichidegua','San Fernando','Nancagua','Chimbarongo','Placilla','Santa Cruz','Lolol','Pumanque','Peralillo','Marchigüe','Pichilemu','La Estrella','Litueche','Navidad'] },
    { nombre: 'Región del Maule', comunas: ['Talca','San Clemente','Pelarco','Río Claro','Maule','San Rafael','Curepto','Constitución','Empedrado','Linares','Colbún','Yerbas Buenas','Villa Alegre','Longaví','Retiro','Parral','Cauquenes','Chanco','Pelluhue','Curicó','Teno','Romeral','Rauco','Sagrada Familia','Hualañé','Licantén','Vichuquén'] },
    { nombre: 'Región de Ñuble', comunas: ['Chillán','Chillán Viejo','Bulnes','Quillón','San Ignacio','Pinto','El Carmen','Yungay','Pemuco','Ñiquén','San Carlos','Coihueco','San Fabián','San Nicolás','Trehuaco','Ninhue','Portezuelo','Cobquecura','Coelemu','Quirihue'] },
    { nombre: 'Región del Biobío', comunas: ['Concepción','Talcahuano','Hualpén','San Pedro de la Paz','Chiguayante','Penco','Tomé','Florida','Hualqui','Coronel','Lota','Santa Juana','Los Ángeles','Mulchén','Nacimiento','Negrete','San Rosendo','Laja','Yumbel','Cabrero','Tucapel','Antuco','Quilleco','Santa Bárbara','Quilaco','Alto Biobío','Arauco','Curanilahue','Lebu','Los Álamos','Cañete','Contulmo','Tirúa'] },
    { nombre: 'Región de La Araucanía', comunas: ['Temuco','Padre Las Casas','Vilcún','Lautaro','Perquenco','Galvarino','Nueva Imperial','Carahue','Saavedra','Toltén','Teodoro Schmidt','Pitrufquén','Gorbea','Loncoche','Villarrica','Pucón','Curarrehue','Freire','Melipeuco','Cunco','Angol','Renaico','Collipulli','Ercilla','Los Sauces','Traiguén','Lumaco','Purén','Victoria','Curacautín','Lonquimay'] },
    { nombre: 'Región de Los Ríos', comunas: ['Valdivia','Corral','Lanco','Mariquina','Máfil','Los Lagos','Paillaco','Panguipulli','La Unión','Futrono','Lago Ranco','Río Bueno'] },
    { nombre: 'Región de Los Lagos', comunas: ['Puerto Montt','Puerto Varas','Frutillar','Llanquihue','Cochamó','Calbuco','Maullín','Los Muermos','Osorno','Puerto Octay','Purranque','Puyehue','Río Negro','San Juan de la Costa','San Pablo','Castro','Ancud','Quellón','Dalcahue','Curaco de Vélez','Puqueldón','Queilén','Quinchao','Chonchi','Quemchi'] },
    { nombre: 'Región de Aysén del General Carlos Ibáñez del Campo', comunas: ['Coyhaique','Lago Verde','Aysén','Cisnes','Guaitecas','Cochrane','O’Higgins','Tortel','Chile Chico','Río Ibáñez'] },
    { nombre: 'Región de Magallanes y de la Antártica Chilena', comunas: ['Punta Arenas','Río Verde','Laguna Blanca','San Gregorio','Porvenir','Primavera','Timaukel','Puerto Natales','Torres del Paine','Cabo de Hornos','Antártica'] },
    { nombre: 'Región Metropolitana de Santiago', comunas: ['Santiago','Cerrillos','Cerro Navia','Conchalí','El Bosque','Estación Central','Huechuraba','Independencia','La Cisterna','La Florida','La Granja','La Pintana','La Reina','Las Condes','Lo Barnechea','Lo Espejo','Lo Prado','Macul','Maipú','Ñuñoa','Pedro Aguirre Cerda','Peñalolén','Providencia','Pudahuel','Quilicura','Quinta Normal','Recoleta','Renca','San Joaquín','San Miguel','San Ramón','Vitacura','Puente Alto','Pirque','San José de Maipo','Colina','Lampa','Tiltil','Melipilla','María Pinto','Curacaví','Alhué','San Pedro','Talagante','El Monte','Isla de Maipo','Padre Hurtado','Peñaflor'] },
  ];
  comunasFiltradas: string[] = [];

  // ===== formulario =====
  editId: number | null = null;
  newCentroEducativo: Partial<CentroEducativo> = {
    nombre: '',
    rbd: '',
    tipo: 'SLEP',
    region: '',
    comuna: '',
    convenio: 'Marco SLEP',
    direccion: '',
    url_rrss: '',
    telefono: '',
    correo: '',
    fecha_inicio_asociacion: null,
  };

  // ===== contactos (modal nuevo) =====
  contactosForm = {
    directorNombre: '',
    directorRut: '',
    directorCorreo: '',
    directorTelefono: '',
    utpNombre: '',
    utpRut: '',
    utpCorreo: '',
    utpTelefono: '',
  };
  private contactoDirectorId: number | null = null;
  private contactoUtpId: number | null = null;

  // ===== datos (lista) =====
  centrosEducativos: CentroEducativo[] = [];

  // dialog detalles
  selectedCentroEducativo: CentroDetalle | null = null;
  detalleCargando = false;

  // confirm delete
  pendingDelete: CentroEducativo | null = null;

  // modal contactos (nuevo)
  contactsForCentro: CentroEducativo | null = null;

  // modal historial practicas
  practicasCentro: Practica[] = [];
  practicasCentroLoading = false;
  practicasCentroTarget: CentroEducativo | null = null;
  practicasCentroYear: 'all' | number = 'all';
  practicasCentroYears: number[] = [];

  
  constructor() {
    this.load(); 
  }

  ngOnInit(): void {
    this.soloLecturaVinculacion = this.esRolVinculacionSoloLectura();
    if (this.esSoloLectura) {
      this.showForm = false;
      this.isEditing = false;
    }
  }

  showField(label: string, value: string) {
    console.log('CLICK', label, value);
    const text = `${label}: ${value}`;

  // Intenta copiar al portapapeles (si el navegador lo permite)
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(value).catch(() => {});
  }

  this.snack.open(text, 'Cerrar', {
    duration: 10000,
    horizontalPosition: 'center',
    verticalPosition: 'bottom',
    panelClass: ['info-snackbar'],
  });
}



  private esRolVinculacionSoloLectura(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      const saved = localStorage.getItem('app.selectedRole');
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return parsed?.id === 'vinculacion';
    } catch {
      return false;
    }
  }

  // ===== carga lista desde backend con paginación =====
  load(page?: number) {
    this.isLoading = true;

    const currentPage = page ?? this.pageIndex + 1; 
    const search = this.searchTerm.trim() || undefined;
    const tipo = this.selectedTipo === 'all' ? undefined : this.selectedTipo;
    const orderBy = 'nombre';
    const orderDir: 'asc' | 'desc' = this.sortAZ ? 'asc' : 'desc';

    this.centrosApi
      .list({
        page: currentPage,
        limit: this.pageSize,
        search,
        tipo,
        orderBy,
        orderDir,
      })
      .subscribe({
        next: (r) => {
          this.centrosEducativos = (r.items ?? []).map(this.mapDTOtoUI);
          this.totalItems = r.total ?? (r.items?.length ?? 0);
          this.pageIndex = (r.page ?? currentPage) - 1;
          this.pageSize = r.limit ?? this.pageSize;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.snack.open('No se pudieron cargar los centros', 'Cerrar', {
            duration: 2500,
          });
        },
      });
  }

  readonly TIPO_OPTIONS: { value: 'all' | TipoCentro; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'PARTICULAR_SUBVENCIONADO', label: 'Particular subvencionado' },
  { value: 'SLEP', label: 'SLEP' },
  { value: 'NO_CONVENCIONAL', label: 'No convencional' },
];


  private mapDTOtoUI = (dto: CentroEducativoDTO): CentroEducativo => ({
    id: dto.id,
    nombre: dto.nombre,
    rbd: dto.rbd ?? undefined,
    tipo: (dto.tipo as TipoCentro) ?? 'SLEP',
    region: dto.region,
    comuna: dto.comuna,
    convenio: dto.convenio ?? undefined,
    direccion: dto.direccion ?? undefined,
    url_rrss: dto.url_rrss ?? undefined,
    telefono: (dto.telefono as any) ?? undefined,
    correo: dto.correo ?? undefined,
    fecha_inicio_asociacion: dto.fecha_inicio_asociacion
      ? String(dto.fecha_inicio_asociacion).slice(0, 10)
      : null,
  });

  // ===== helpers de fecha =====
  toDate(iso?: string | null): Date | null {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private toISODateOnly(d?: Date | null): string | null {
    if (!d) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onFechaAsociacionChange(d: Date | null) {
    this.newCentroEducativo.fecha_inicio_asociacion = this.toISODateOnly(d);
  }

  // ===== helpers UI =====
  toggleForm() {
    if (this.esSoloLectura) return;
    this.showForm = !this.showForm;
    if (!this.showForm) this.resetForm();
  }

  onRegionChange() {
    const region = this.newCentroEducativo.region || '';
    const reg = this.REGIONES.find((r) => r.nombre === region);
    this.comunasFiltradas = reg ? reg.comunas : [];
    if (!this.comunasFiltradas.includes(this.newCentroEducativo.comuna || '')) {
      this.newCentroEducativo.comuna = '';
    }
  }

  private resetForm() {
    this.isEditing = false;
    this.editId = null;
    this.newCentroEducativo = {
      nombre: '',
      rbd: '',
      tipo: 'SLEP',
      region: '',
      comuna: '',
      convenio: 'Marco SLEP',
      direccion: '',
      url_rrss: '',
      telefono: '',
      correo: '',
      fecha_inicio_asociacion: null,
    };
    this.comunasFiltradas = [];
    this.contactosForm = {
      directorNombre: '',
      directorRut: '',
      directorCorreo: '',
      directorTelefono: '',
      utpNombre: '',
      utpRut: '',
      utpCorreo: '',
      utpTelefono: '',
    };
    this.contactoDirectorId = null;
    this.contactoUtpId = null;
    this.selectedCentroEducativo = null;
  }

  // ===== CRUD centro =====
  addOrUpdateCentro() {
    if (this.esSoloLectura) return;
    const c = this.newCentroEducativo;

    if (!c.nombre?.trim() || !c.tipo || !c.region || !c.comuna || !c.convenio) {
      this.snack.open('Debe completar todos los campos requeridos.', 'Cerrar', {
        duration: 2500,
      });
      return;
    }

    const cleanOrNull = (v: any) => {
      const s = (v ?? '').toString().trim();
      return s === '' ? null : s;
    };

    const telefonoStr = (c.telefono ?? '').toString().trim();
    const telefonoNum = telefonoStr !== '' ? Number(telefonoStr) : null;

    const payloadCentro: CreateCentroPayload = {
      nombre: c.nombre!.trim(),
      rbd: cleanOrNull(c.rbd),
      tipo: c.tipo as any,
      region: c.region!,
      comuna: c.comuna!,

      convenio: String(c.convenio),
      direccion: cleanOrNull(c.direccion),
      url_rrss: cleanOrNull(c.url_rrss),
      correo: cleanOrNull(c.correo),

  telefono: Number.isFinite(telefonoNum as number) ? telefonoNum : null,
  fecha_inicio_asociacion: c.fecha_inicio_asociacion ?? null,
};


    const req$ =
      this.isEditing && this.editId != null
        ? this.centrosApi.update(this.editId, payloadCentro as UpdateCentroPayload)
        : this.centrosApi.create(payloadCentro);

    req$.subscribe({
      next: () => {
        this.snack.open(
          this.isEditing
            ? '✓ Centro actualizado correctamente'
            : '✓ Centro agregado correctamente',
          'Cerrar',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['success-snackbar'],
          }
        );
        this.toggleForm();
        this.resetForm();
        this.load();
      },
      error: () =>
        this.snack.open('No se pudo guardar el centro.', 'Cerrar', {
          duration: 2500,
        }),
    });
  }

  editCentro(c: CentroEducativo) {
    if (this.esSoloLectura) return;
    this.isEditing = true;
    this.editId = c.id;
    this.showForm = true;
    this.newCentroEducativo = { ...c };
    this.onRegionChange();
  }

  editFromDetails() {
  if (this.esSoloLectura) return;
  if (!this.selectedCentroEducativo) return;

  // Guardamos una copia antes de cerrar el modal
  const centro = { ...this.selectedCentroEducativo };

  // Cerrar modal de detalle
  this.closeDetails();

  // Abrir formulario en modo edición
  this.editCentro(centro);
}

readonly TIPO_LABEL: Record<TipoCentro, string> = {
  PARTICULAR: 'Particular',
  PARTICULAR_SUBVENCIONADO: 'Particular subvencionado',
  SLEP: 'SLEP',
  NO_CONVENCIONAL: 'No convencional',
};

tipoLabel(tipo: TipoCentro | string | null | undefined): string {
  if (!tipo) return '';
  return (this.TIPO_LABEL as any)[tipo] ?? String(tipo);
}


  // ===== Confirmación de eliminación =====
  askDelete(c: CentroEducativo) {
    if (this.esSoloLectura) return;
    this.pendingDelete = c;
  }

  cancelDelete() {
    this.pendingDelete = null;
  }

  confirmDelete() {
    if (this.esSoloLectura) return;
    if (!this.pendingDelete) return;
    const id = this.pendingDelete.id;

    this.centrosApi.delete(id).subscribe({
      next: () => {
        this.snack.open('✓ Centro eliminado correctamente', 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['success-snackbar'],
        });
        this.pendingDelete = null;
        if (this.centrosEducativos.length === 1 && this.pageIndex > 0) {
          this.pageIndex--;
        }
        this.load();
      },
      error: () => {
        this.snack.open('No se pudo eliminar.', 'Cerrar', { duration: 2500 });
        this.pendingDelete = null;
      },
    });
  }

  // ===== Detalles =====
  viewCentro(c: CentroEducativo) {
    this.detalleCargando = true;
    this.selectedCentroEducativo = null;

    this.centrosApi.getById(c.id).subscribe({
      next: (full) => {
        const base = this.mapDTOtoUI(full);
        this.selectedCentroEducativo = {
          ...base,
          trabajadores: full.trabajadores ?? [],
        };
        this.detalleCargando = false;
      },
      error: () => {
        this.detalleCargando = false;
        this.snack.open('No se pudo cargar el detalle.', 'Cerrar', {
          duration: 2500,
        });
      },
    });
  }

  closeDetails() {
    this.selectedCentroEducativo = null;
  }

  // ===== Añadir/Editar contactos (modal) =====
  openContacts(c: CentroEducativo) {
    if (this.esSoloLectura) return;
    this.contactsForCentro = c;

    this.contactoDirectorId = null;
    this.contactoUtpId = null;
    this.contactosForm = {
      directorNombre: '',
      directorRut: '',
      directorCorreo: '',
      directorTelefono: '',
      utpNombre: '',
      utpRut: '',
      utpCorreo: '',
      utpTelefono: '',
    };

    // preload DIRECTOR
    this.trabajadoresApi
      .list({ centroId: c.id, rol: 'Director', page: 1, limit: 1 })
      .subscribe({
        next: (r) => {
          const d = r.items?.[0];
          if (d) {
            this.contactoDirectorId = d.id;
            this.contactosForm.directorNombre = d.nombre || '';
            this.contactosForm.directorRut = d.rut || '';
            this.contactosForm.directorCorreo = d.correo || '';
            this.contactosForm.directorTelefono =
              d.telefono != null ? String(d.telefono) : '';
          }
        },
      });

    // preload UTP
    this.trabajadoresApi
      .list({ centroId: c.id, rol: 'UTP', page: 1, limit: 1 })
      .subscribe({
        next: (r) => {
          const u = r.items?.[0];
          if (u) {
            this.contactoUtpId = u.id;
            this.contactosForm.utpNombre = u.nombre || '';
            this.contactosForm.utpRut = u.rut || '';
            this.contactosForm.utpCorreo = u.correo || '';
            this.contactosForm.utpTelefono =
              u.telefono != null ? String(u.telefono) : '';
          }
        },
      });
  }

  closeContacts() {
    this.contactsForCentro = null;
  }

  // ===== Historial de practicas por centro =====
  openPracticasHistory(c: CentroEducativo) {
    this.practicasCentroTarget = c;
    this.practicasCentro = [];
    this.practicasCentroLoading = true;
    this.practicasCentroYear = 'all';
    this.practicasCentroYears = [];

    this.practicasApi
      .listarParaJefatura({
        centroId: c.id,
        page: 1,
        pageSize: 50,
        sortBy: 'fecha_inicio',
        sortOrder: 'desc',
      })
      .subscribe({
        next: (res) => {
          this.practicasCentro = res.items ?? [];
          this.practicasCentroYears = this.buildPracticasYears(this.practicasCentro);
          this.practicasCentroLoading = false;
        },
        error: () => {
          this.practicasCentroLoading = false;
          this.snack.open('No se pudieron cargar las practicas del centro.', 'Cerrar', {
            duration: 2500,
          });
        },
      });
  }

  closePracticasHistory() {
    this.practicasCentroTarget = null;
  }

  get practicasCentroFiltradas(): Practica[] {
    if (this.practicasCentroYear === 'all') return this.practicasCentro;
    return this.practicasCentro.filter((p) => {
      const y = this.getYearFromDate(p.fecha_inicio) ?? this.getYearFromDate(p.fecha_termino);
      return y === this.practicasCentroYear;
    });
  }

  estadoPracticaLabel(estado?: EstadoPractica | null): string {
    const map: Record<EstadoPractica, string> = {
      EN_CURSO: 'En curso',
      APROBADO: 'Aprobado',
      REPROBADO: 'Reprobado',
    };
    return estado ? map[estado] : 'Sin estado';
  }

  estadoPracticaClass(estado?: EstadoPractica | null): string {
    switch (estado) {
      case 'APROBADO':
        return 'status-pill--ok';
      case 'REPROBADO':
        return 'status-pill--bad';
      case 'EN_CURSO':
        return 'status-pill--warn';
      default:
        return '';
    }
  }

  formatFechaPractica(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  private getYearFromDate(value?: string | null): number | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear();
  }

  private buildPracticasYears(items: Practica[]): number[] {
    const years = new Set<number>();
    for (const p of items) {
      const y = this.getYearFromDate(p.fecha_inicio) ?? this.getYearFromDate(p.fecha_termino);
      if (y) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }

  saveContactsForCentro() {
    if (this.esSoloLectura) return;
    if (!this.contactsForCentro) return;
    const centroId = this.contactsForCentro.id;

    const toNum = (v?: string | number | null) => {
      const s = (v ?? '').toString().trim();
      return s !== '' ? Number(s) : null;
    };

    const ops: Promise<any>[] = [];

    // DIRECTOR
    if ((this.contactosForm.directorNombre || '').trim() !== '') {
      const base = {
        rut:
          (this.contactosForm.directorRut ||
            `TEMP-Director-${centroId}-${Date.now()}`).trim(),
        nombre: this.contactosForm.directorNombre.trim(),
        correo: this.contactosForm.directorCorreo?.trim() || undefined,
        telefono: toNum(this.contactosForm.directorTelefono),
        rol: 'Director',
        centroId,
      };
      if (this.contactoDirectorId)
        ops.push(
          this.trabajadoresApi
            .update(this.contactoDirectorId, base)
            .toPromise()
        );
      else ops.push(this.trabajadoresApi.create(base).toPromise());
    }

    // UTP
    if ((this.contactosForm.utpNombre || '').trim() !== '') {
      const base = {
        rut:
          (this.contactosForm.utpRut ||
            `TEMP-UTP-${centroId}-${Date.now()}`).trim(),
        nombre: this.contactosForm.utpNombre.trim(),
        correo: this.contactosForm.utpCorreo?.trim() || undefined,
        telefono: toNum(this.contactosForm.utpTelefono),
        rol: 'UTP',
        centroId,
      };
      if (this.contactoUtpId)
        ops.push(
          this.trabajadoresApi.update(this.contactoUtpId, base).toPromise()
        );
      else ops.push(this.trabajadoresApi.create(base).toPromise());
    }

    Promise.all(ops)
      .then(() => {
        this.snack.open('✓ Contactos guardados correctamente', 'Cerrar', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
          panelClass: ['success-snackbar'],
        });
        this.closeContacts();
        this.load();
      })
      .catch(() => {
        this.snack.open('✗ Error al guardar contactos', 'Cerrar', {
          duration: 3500,
        });
      });
  }

  // ===== orden, filtros y paginador =====
  toggleSort() {
    this.sortAZ = !this.sortAZ;
    this.pageIndex = 0;
    this.load(1);
  }

  onFiltersChange() {
    this.pageIndex = 0;
    this.load(1);
  }

  onPageChange(event: PageEvent) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.load(this.pageIndex + 1);
  }

}
