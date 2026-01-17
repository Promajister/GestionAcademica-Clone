// carta.component.ts
import { Component, inject, ChangeDetectorRef, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
// --- LÍNEA CORREGIDA ---
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
// -------------------------

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, NativeDateAdapter, MAT_DATE_FORMATS, DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Servicios y Tipos de Datos
import {
  CartaDataService,
  ApiCentro,
  ApiEstudiante,
  ApiSupervisor,
  CreateCartaDto,
} from '../../services/carta-data.service';

// PDF
import { jsPDF } from 'jspdf';
import { PdfDialogComponent } from './pdf-dialog.component';

interface PdfAsset {
  dataUrl: string;
  width: number;
  height: number;
}

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
  selector: 'app-carta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: CustomDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: MAT_DATE_LOCALE, useValue: 'es-ES' },
  ],
  templateUrl: './carta.component.html',
  styleUrls: ['./carta.component.scss'],
})
export class CartaComponent {
  private fb = inject(FormBuilder);
  private data = inject(CartaDataService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private logosCargados = false;
  private logoUtaImg: PdfAsset | null = null;
  private logoFehImg: PdfAsset | null = null;

  private readonly TIPOS_PRACTICA_FALLBACK = [
    'Apoyo a la Docencia I',
    'Apoyo a la Docencia II',
    'Apoyo a la Docencia III',
    'Apoyo a la Docencia IV',
    'Práctica Profesional',
  ];

  // --- Catálogos ---
  tiposPractica: string[] = [...this.TIPOS_PRACTICA_FALLBACK];
  centros: ApiCentro[] = [];
  estudiantes: ApiEstudiante[] = [];
  supervisores: ApiSupervisor[] = [];

  // --- Filtros ---
  studentFilter = '';
  supervisorFilter = '';
  filteredStudents: ApiEstudiante[] = [];
  filteredSupervisores: ApiSupervisor[] = [];

  // --- Estado ---
  centroSeleccionado: ApiCentro | null = null;

  // ==========================
  //  FORMULARIO REACTIVO
  // ==========================

  // --- Formulario ---
  form = this.fb.group(
    {
      tipoPractica: ['', Validators.required],
      centroId: [null as number | null, Validators.required],

      // Se guardan los RUTs (string[])
      estudiantesIds: this.fb.control<string[]>([], {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(1)],
      }),

      supervisorId: [null as number | null, Validators.required],
      periodoInicio: [null as Date | null, Validators.required],
      periodoFin: [null as Date | null, Validators.required],

      // Campos de configuración de la carta
      referencia: ['', [Validators.required, Validators.maxLength(150)]],
      jefaturaNombre: ['', Validators.required],
      jefaturaCargo: ['', Validators.required],
      folioManual: [''],
    },
    { validators: [this.periodoValidator] }
  );

  // ==========================
  //  CONSTANTES DE JEFATURA
  // ==========================
  private readonly JEFATURA_NOMBRE = 'Dr. IGNACIO JARA PARRA';
  private readonly JEFATURA_CARGO = 'Jefe de Carrera';
  private readonly FECHA_FIJA = '22 de enero de 2026';
  private readonly CIUDAD_FIJA = 'ARICA';
  private readonly PREFIJO_FOLIO = 'PHGCS N°';

  get minFechaFin(): Date | null {
    return this.form.value.periodoInicio ?? null;
  }

  // --- Helpers de selección (para evitar casts repetidos) ---
  get alumnosSeleccionados(): ApiEstudiante[] {
    const ids = this.form.value.estudiantesIds ?? [];
    return this.estudiantes.filter((e) => ids.includes(e.rut));
  }

  get supervisorSeleccionado(): ApiSupervisor | null {
    const id = this.form.value.supervisorId;
    return this.supervisores.find((s) => s.id === id) ?? null;
  }

  get plural(): boolean {
    return (this.form.value.estudiantesIds?.length ?? 0) > 1;
  }

  // ===========================================
  // ===== Helpers para el destino de carta ====
  // ===========================================

  destinatario(): { linea: string; cargo: string } {
    const c = this.centroSeleccionado;
    if (!c) return { linea: 'Señor(a)', cargo: '' };

    // Usamos el nombre del centro
    return { linea: `Director(a) ${c.nombre}`, cargo: 'Director(a)' };
  }

  // Texto de referencia por tipo de práctica
  private referenciaPorTipo(tipo?: string | null): string {
    switch (tipo) {
      case 'Apoyo a la Docencia I':
        return 'SOLICITUD DE AUTORIZACION PARA APOYO A LA DOCENCIA I';
      case 'Apoyo a la Docencia II':
        return 'SOLICITUD DE AUTORIZACION PARA APOYO A LA DOCENCIA II';
      case 'Apoyo a la Docencia III':
        return 'SOLICITUD DE AUTORIZACION PARA APOYO A LA DOCENCIA III';
      case 'Apoyo a la Docencia IV':
        return 'SOLICITUD DE AUTORIZACION PARA APOYO A LA DOCENCIA IV';
      case 'Practica Profesional':
        return 'SOLICITUD DE AUTORIZACION PARA PRACTICA PROFESIONAL';
      default:
        return 'SOLICITUD DE AUTORIZACION PARA PRACTICA';
    }
  }

  private buildCartaData(folioBack?: string) {
    const centro = this.centroSeleccionado;
    const referencia =
      this.form.value.referencia?.trim() ||
      this.referenciaPorTipo(this.form.value.tipoPractica);

    const folioManual = this.form.value.folioManual?.trim();
    const folioUsado = folioBack || folioManual || '';

    const estudiantes = this.alumnosSeleccionados.map((e) => ({
      nombre: e.nombre,
      rut: e.rut,
    }));

    const sup = this.supervisorSeleccionado;
    const tutora =
      sup?.nombre != null
        ? `El tutor de practica responsable es ${sup.trato ? sup.trato + ' ' : ''}${sup.nombre}.`
        : 'La tutora de practica responsable es la Srta. Carolina Quintana Talvac.';

    return {
      referencia,
      fechaCiudad: `${this.CIUDAD_FIJA}, ${this.FECHA_FIJA}.-`,
      folio: folioUsado ? `${this.PREFIJO_FOLIO} ${folioUsado}. -` : '',
      destinatario: [
        'Señor',
        `Director(a) ${centro?.nombre ?? 'del establecimiento'}`,
        centro?.comuna ? centro.comuna : '',
        'Presente',
      ].filter(Boolean),
            intro: 'Conforme a lo establecido en el curriculo de la carrera de Pedagogia en Historia y Geografia de la Facultad de Educacion y Humanidades de la Universidad de Tarapaca, me permito solicitar su autorizacion para que los siguientes estudiantes realicen su Practica Profesional Docente en el establecimiento que usted dirige durante el presente semestre:',

      estudiantes,
      tutora,
      adjuntos: [
        'Credencial del profesor en practica.',
        'Perfiles de egreso del grado de Licenciado en Educacion y Profesor de Historia y Geografia.',
        'Ficha de seguro escolar (de acuerdo con el Decreto Ley Nro 16.774) de cada estudiante.',
        'Responsabilidades del docente colaborador encargado en el aula.',
      ],
      importancia:
        'Es importante subrayar que los procesos de practica son elementos cruciales en la formacion de futuros profesionales, contribuyendo significativamente a la consecucion de nuestro perfil de egreso tanto como Licenciados en Educacion como Profesores de Historia y Geografia.',
      agradecimiento:
        'Agradezco de antemano las facilidades brindadas por su establecimiento a nuestros estudiantes y quedo a la espera de su respuesta.',
      despedida: 'Se despide atentamente,',
      firmaNombre:
        this.form.value.jefaturaNombre?.trim() || this.JEFATURA_NOMBRE,
      firmaCargo:
        this.form.value.jefaturaCargo?.trim() || this.JEFATURA_CARGO,
      pie: {
        direccion: 'Av. 18 de Septiembre Nro 2222, Arica - Chile',
        correo: 'pedhg@gestion.uta.cl',
        telefono: '+56 582205253',
        web: 'www.uta.cl',
      },
    };
  }

  // ===========================================
  //         GENERACION DE PDF
  // ===========================================

  private async crearYMostrarPDF(
    titulo: string,
    esPrevio: boolean,
    folioBack?: string
  ): Promise<void> {
    const data = this.buildCartaData(folioBack);
    const doc = new jsPDF({ unit: 'pt', format: 'letter' }); // 612 x 792 pt (carta)
    const margin = { left: 56, top: 64, right: 56, bottom: 64 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin.left - margin.right;

    // ==========================
    //  LOGOS [UTA] ........ [FEH]
    // ==========================
    const utaWidth = 90;
    const fehWidth = 72;
    const logoHeightFallback = 40;
    const yLogos = 32;

    await this.ensureLogos();
    const leftLogoHeight = this.drawLogo(
      doc,
      this.logoUtaImg,
      margin.left,
      yLogos,
      utaWidth
    );
    const rightLogoHeight = this.drawLogo(
      doc,
      this.logoFehImg,
      pageWidth - margin.right - fehWidth,
      yLogos,
      fehWidth
    );
    const usedLogoHeight =
      Math.max(leftLogoHeight, rightLogoHeight) || logoHeightFallback;

    let y = yLogos + usedLogoHeight + 20;

    // Marca de agua (solo previa)
    if (esPrevio) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      doc.setTextColor(200);
      doc.text('VISTA PREVIA', pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
      doc.setTextColor(0);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(data.referencia, pageWidth - margin.right, y, { align: 'right' });
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.text(data.fechaCiudad, pageWidth - margin.right, y, { align: 'right' });
    y += 14;
    if (data.folio) {
      doc.text(data.folio, pageWidth - margin.right, y, { align: 'right' });
      y += 18;
    } else {
      y += 4;
    }

    // Destinatario
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y = this.writeLines(doc, data.destinatario, margin.left, y, contentWidth, 16);
    y += 10;

    // Separador
    doc.setDrawColor(180);
    doc.setLineWidth(0.5);
    doc.line(margin.left, y, pageWidth - margin.right, y);
    y += 16;

    // ==========================
    //  CUERPO DE LA CARTA
    // ==========================
    doc.setLineHeightFactor(1.4);
    y = this.writeParagraph(doc, data.intro, margin.left, y, contentWidth, {
      fontSize: 11,
    });

    // Lista de estudiantes
    const estudiantes = data.estudiantes.length
      ? data.estudiantes
      : [{ nombre: 'Nombre estudiante', rut: 'Rut' }];
    y = this.writeBullets(
      doc,
      estudiantes.map((e) => `${e.nombre}, Rut ${e.rut}`),
      margin.left,
      y,
      contentWidth
    );

    // Tutora
    y = this.writeParagraph(doc, data.tutora, margin.left, y + 4, contentWidth, {
      fontSize: 11,
    });

    // Adjuntos
    y = this.writeParagraph(
      doc,
      'Adjunto a este correo el detalle de la estructura de la practica solicitada, junto con los siguientes documentos:',
      margin.left,
      y + 10,
      contentWidth,
      { fontSize: 11 }
    );
    y = this.writeBullets(doc, data.adjuntos, margin.left, y, contentWidth);

    // Importancia y agradecimiento
    y = this.writeParagraph(doc, data.importancia, margin.left, y + 8, contentWidth, {
      fontSize: 11,
    });
    y = this.writeParagraph(doc, data.agradecimiento, margin.left, y + 8, contentWidth, {
      fontSize: 11,
    });

    // Despedida y firma
    y = this.writeParagraph(doc, data.despedida, margin.left, y + 12, contentWidth, {
      fontSize: 11,
    });
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.text(data.firmaNombre, margin.left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(data.firmaCargo, margin.left, y + 14);
    doc.text('Licenciatura y Pedagogia en Historia y Geografia', margin.left, y + 28);

    // Pie de pagina
    const footerY = pageHeight - margin.bottom + 18;
    doc.setFontSize(10);
    doc.text(
      `${data.pie.direccion}  |  ${data.pie.correo}  |  ${data.pie.telefono}  |  ${data.pie.web}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Barra de colores
    const barY = footerY + 10;
    const barHeight = 8;
    const segmentWidth = (pageWidth - margin.left - margin.right) / 4;
    const barX = margin.left;
    doc.setFillColor(7, 78, 146);
    doc.rect(barX, barY, segmentWidth, barHeight, 'F');
    doc.setFillColor(242, 179, 52);
    doc.rect(barX + segmentWidth, barY, segmentWidth, barHeight, 'F');
    doc.setFillColor(92, 110, 141);
    doc.rect(barX + segmentWidth * 2, barY, segmentWidth, barHeight, 'F');
    doc.setFillColor(26, 33, 63);
    doc.rect(barX + segmentWidth * 3, barY, segmentWidth, barHeight, 'F');

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const ref = this.dialog.open(PdfDialogComponent, {
      data: { dataUrl: pdfUrl, title: titulo },
      width: '980px',
      maxHeight: '95vh',
    });
    ref.afterClosed().subscribe(() => URL.revokeObjectURL(pdfUrl));
  }

  private writeLines(
    doc: jsPDF,
    lines: string[],
    x: number,
    y: number,
    width: number,
    lineHeight: number
  ): number {
    let currentY = y;
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, width);
      doc.text(wrapped, x, currentY);
      currentY += lineHeight * wrapped.length;
    }
    return currentY;
  }

  private writeParagraph(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number,
    opts?: { fontSize?: number }
  ): number {
    const fontSize = opts?.fontSize ?? 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const wrapped = doc.splitTextToSize(text, width);
    doc.text(wrapped, x, y);
    return y + wrapped.length * fontSize * 1.25 + 6;
  }

  private writeBullets(
    doc: jsPDF,
    items: string[],
    x: number,
    y: number,
    width: number
  ): number {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    let currentY = y;
    for (const item of items) {
      const wrapped = doc.splitTextToSize(item, width - 14);
      doc.text('•', x, currentY);
      doc.text(wrapped, x + 12, currentY);
      currentY += wrapped.length * 14;
    }
    return currentY + 4;
  }

  // ===========================================
  // --- Ciclo de Vida y Carga de Datos ---
  // ===========================================

  ngOnInit(): void {
    // Valores por defecto de los campos de carta
    this.form.patchValue({
      referencia: 'SOLICITUD DE AUTORIZACIÓN PARA PRÁCTICA',
      jefaturaNombre: this.JEFATURA_NOMBRE,
      jefaturaCargo: this.JEFATURA_CARGO,
    });

    // Actualizamos la referencia automáticamente según el tipo de práctica,
    // siempre que el usuario no la haya modificado manualmente.
    this.form.get('tipoPractica')!.valueChanges.subscribe((tipo) => {
      if (!tipo) return;
      const refCtrl = this.form.get('referencia');
      if (refCtrl && !refCtrl.dirty) {
        refCtrl.setValue(this.referenciaPorTipo(tipo), { emitEvent: false });
      }
    });

    this.data.getTiposPractica().subscribe({
      next: (t) => {
        if (Array.isArray(t) && t.length) {
          this.tiposPractica = t;
        }
      },
      error: () => {
        this.tiposPractica = [...this.TIPOS_PRACTICA_FALLBACK];
        this.snack.open('No se pudieron cargar los tipos de práctica', 'OK', {
          duration: 3000,
        });
      },
    });
    this.data.getCentros('').subscribe((cs) => (this.centros = cs));

    this.data.getEstudiantes('').subscribe((es) => {
      this.estudiantes = es;
      this.filteredStudents = es;
    });

    this.data.getSupervisores('').subscribe((ss) => {
      this.supervisores = ss;
      this.filteredSupervisores = ss;
    });

    // Actualiza 'centroSeleccionado' cuando el ID cambia
    this.form.get('centroId')!.valueChanges.subscribe((id: number | null) => {
      this.centroSeleccionado = this.centros.find((c) => c.id === id) ?? null;
      this.cdr.markForCheck();
    });

    this.form.get('periodoInicio')!.valueChanges.subscribe((inicio: Date | null) => {
      const finCtrl = this.form.get('periodoFin');
      const finVal = finCtrl?.value as Date | null;
      if (inicio && finVal && new Date(finVal).getTime() <= new Date(inicio).getTime()) {
        finCtrl?.setValue(null);
      }
    });
  }

  // --- Filtros (UI) ---
  _markForCheck() {
    this.cdr.markForCheck();
    this.applyFilters();
  }

  applyFilters() {
    const fS = this.studentFilter.toLowerCase();
    const fP = this.supervisorFilter.toLowerCase();

    this.filteredStudents = this.estudiantes.filter((e) =>
      `${e.nombre} ${e.rut}`.toLowerCase().includes(fS)
    );
    this.filteredSupervisores = this.supervisores.filter((s) =>
      `${s.nombre} ${s.correo ?? ''}`.toLowerCase().includes(fP)
    );
  }

  // --- Acciones de Botones  ---

  private async ensureLogos(): Promise<void> {
    if (this.logosCargados) {
      return;
    }
    const [uta, feh] = await Promise.all([
      this.loadAssetAsDataUrl('assets/img/uta.png'),
      this.loadAssetAsDataUrl('assets/img/feh.png'),
    ]);
    this.logoUtaImg = uta;
    this.logoFehImg = feh;
    this.logosCargados = true;
  }

  private resolveAssetPath(path: string): string {
    try {
      return new URL(path, document.baseURI).toString();
    } catch {
      return path;
    }
  }

  private drawLogo(
    doc: jsPDF,
    logo: PdfAsset | null,
    x: number,
    y: number,
    width: number
  ): number {
    if (!logo?.dataUrl) {
      return 0;
    }
    const aspect = logo.width > 0 ? logo.height / logo.width : 0.5;
    const scaledHeight = Math.max(1, width * aspect);
    doc.addImage(logo.dataUrl, 'PNG', x, y, width, scaledHeight);
    return scaledHeight;
  }

  private async loadAssetAsDataUrl(assetPath: string): Promise<PdfAsset | null> {
    const url = this.resolveAssetPath(assetPath);
    return new Promise((resolve) => {
      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const image = new Image();
            image.onload = () =>
              resolve({
                dataUrl,
                width: image.width,
                height: image.height,
              });
            image.onerror = () =>
              resolve({
                dataUrl,
                width: 0,
                height: 0,
              });
            image.src = dataUrl;
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        },
        error: (error) => {
          console.warn('Error cargando asset para PDF', url, error);
          resolve(null);
        },
      });
    });
  }

  /** Muestra una vista previa del PDF sin guardar */
  previa(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open(
        'Completa los campos requeridos (centro, estudiantes, supervisor y periodo).',
        'OK',
        { duration: 2200 }
      );
      return;
    }
    this.crearYMostrarPDF('Vista previa de carta', true).catch((err) => {
      console.error('No se pudo generar la vista previa', err);
      this.snack.open('No se pudo generar la vista previa', 'OK', {
        duration: 2400,
      });
    });
  }

  /** Guarda en la BD y (si es exitoso) genera el PDF con folio */
  grabar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Completa los campos requeridos.', 'OK', {
        duration: 2200,
      });
      return;
    }

    const v = this.form.value;
    const dto: CreateCartaDto = {
      tipoPractica: v.tipoPractica!,
      centroId: v.centroId!,
      estudiantesIds: v.estudiantesIds!,
      supervisorId: v.supervisorId!,
      periodoInicio: this.toISO(v.periodoInicio),
      periodoFin: this.toISO(v.periodoFin),
    };

    this.data.crearCarta(dto).subscribe({
      next: (respuesta: any) => {
        const folio = respuesta?.folio ?? 'S/F'; // Tomamos el folio del backend

        this.crearYMostrarPDF(`Carta folio ${folio}`, false, folio).catch((err) => {
          console.error('Carta guardada, pero no se pudo generar el PDF', err);
          this.snack.open('Carta guardada, pero no se pudo generar el PDF', 'OK', {
            duration: 3000,
          });
        });

        this.snack.open(`Carta guardada con folio ${folio} `, 'OK', {
          duration: 2400,
        });
        this.limpiar();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Error al crear la carta ', 'Cerrar', {
          duration: 3000,
        });
      },
    });
  }

  /** Limpia el formulario */
  limpiar(): void {
    this.form.reset({
      tipoPractica: '',
      centroId: null,
      estudiantesIds: [],
      supervisorId: null,
      periodoInicio: null,
      periodoFin: null,
      referencia: 'SOLICITUD DE AUTORIZACIÓN PARA PRÁCTICA',
      jefaturaNombre: this.JEFATURA_NOMBRE,
      jefaturaCargo: this.JEFATURA_CARGO,
      folioManual: '',
    });
    this.studentFilter = '';
    this.supervisorFilter = '';
    this.filteredStudents = this.estudiantes;
    this.filteredSupervisores = this.supervisores;
    this.centroSeleccionado = null;
  }

  // --- Validadores ---

  private periodoValidator(group: AbstractControl): ValidationErrors | null {
    const i = group.get('periodoInicio')?.value as Date | null;
    const f = group.get('periodoFin')?.value as Date | null;
    if (i && f && new Date(f).getTime() <= new Date(i).getTime()) {
      return { periodoInvalido: true };
    }
    return null;
  }

  private toISO(d: any): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toISOString().slice(0, 10);
  }
}
