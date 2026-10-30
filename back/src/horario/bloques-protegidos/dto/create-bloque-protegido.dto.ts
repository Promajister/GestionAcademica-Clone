import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AlcanceBloqueProtegido, TipoContrato } from '@prisma/client';
import { trim } from '../../common/trim.transform';

export class CreateBloqueProtegidoDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del bloque protegido es obligatorio' })
  nombre!: string;

  @IsEnum(AlcanceBloqueProtegido, {
    message:
      'El alcance debe ser UNIVERSIDAD, FACULTAD, CARRERA, ESTUDIANTES, PRACTICA_PREPRACTICA, ACADEMICOS o ACADEMICO_INDIVIDUAL',
  })
  alcance!: AlcanceBloqueProtegido;

  @IsOptional()
  @IsArray({ message: 'dias debe ser una lista de días' })
  @IsString({ each: true })
  dias?: string[];

  @IsOptional()
  @IsString()
  dia?: string;

  @IsInt({ message: 'bloque_inicio debe ser un número entero' })
  @Min(1, { message: 'El bloque de inicio debe ser entre 1 y 12' })
  @Max(12, { message: 'El bloque de inicio debe ser entre 1 y 12' })
  bloque_inicio!: number;

  @IsInt({ message: 'bloque_fin debe ser un número entero' })
  @Min(1, { message: 'El bloque de fin debe ser entre 1 y 12' })
  @Max(12, { message: 'El bloque de fin debe ser entre 1 y 12' })
  bloque_fin!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  codigo_carrera?: string;

  @IsOptional()
  @IsInt({ message: 'semestre debe ser un número entero' })
  @Min(1)
  semestre?: number;

  @IsOptional()
  @IsEnum(TipoContrato, { message: 'El contrato debe ser PLANTA o HORAS' })
  contrato?: TipoContrato;

  @IsOptional()
  @IsInt({ message: 'id_usuario debe ser un número entero' })
  id_usuario?: number;
}
