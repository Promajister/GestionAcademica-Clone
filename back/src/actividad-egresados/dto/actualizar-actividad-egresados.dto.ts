import { PartialType } from '@nestjs/mapped-types';
import { CreateActividadEgresadosDto } from './crear-actividad-egresados.dto';

export class UpdateActividadEgresadosDto extends PartialType(CreateActividadEgresadosDto) {}
