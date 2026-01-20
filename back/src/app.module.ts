import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from '../prisma/prisma.module';

import { ColaboradoresModule } from './colaboradores/colaboradores.module';
import { CentrosModule } from './centros/centros.module';
import { TrabajadorModule } from './trabajador/trabajador.module';
import { EstudianteModule } from './estudiante/estudiante.module';
import { CartaModule } from './carta/carta.module';
import { TutorModule } from './tutor/tutor.module';
import { PracticasModule } from './practicas/practicas.module';
import { ActividadPracticaModule } from './actividad-practica/actividad-practica.module';
import { ActividadesModule } from './actividades/actividades.module';
import { ActividadesPmModule } from './actividades-pm/actividades-pm.module';
import { AuthModule } from './auth/auth.module';
import { EncuestasModule } from './encuestas/encuestas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { HistorialModule } from './historial/historial.module';
import { ReportesModule } from './reportes/reportes.module';
import { EncuestasJefaturaModule } from './encuestas-jefatura/encuestas-jefatura.module';
import { ActividadVinculacionModule } from './actividad-vinculacion/actividad-vinculacion.module';
import { EncuestasEgresadosModule } from './encuestas-egresados/encuestas-egresados.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api'], 
    }),

    PrismaModule,
    ColaboradoresModule,
    CentrosModule,
    TrabajadorModule,
    EstudianteModule,
    CartaModule,
    TutorModule,
    PracticasModule,
    ActividadPracticaModule,
    ActividadesModule,
    ActividadesPmModule,
    EncuestasModule,
    AuthModule,
    UsuariosModule,
    HistorialModule,
    ReportesModule,
    EncuestasJefaturaModule,
    ActividadVinculacionModule,
    EncuestasEgresadosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
