import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { DiaSemana, TipoOcupacion } from '@prisma/client';

export class QueryOcupacionDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  @IsOptional()
  @IsEnum(TipoOcupacion)
  tipo?: TipoOcupacion;

  @IsOptional()
  @IsEnum(DiaSemana)
  dia?: DiaSemana;

  // Rango de fechas para las PUNTUALES (las SEMESTRALES siempre se incluyen)
  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;
}
