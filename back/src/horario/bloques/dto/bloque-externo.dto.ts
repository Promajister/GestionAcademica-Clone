import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from '../../common/trim.transform';
import { TOTAL_BLOQUES } from '../../common/grilla';

export enum DiaSemanaLaboral {
  LUNES = 'LUNES',
  MARTES = 'MARTES',
  MIERCOLES = 'MIERCOLES',
  JUEVES = 'JUEVES',
  VIERNES = 'VIERNES',
}

// Rango de bloques de la grilla (ver GET /horario/grilla). Ej. 3-4 = 09:40 a 11:10.
export class BloqueExternoDto {
  @IsEnum(DiaSemanaLaboral, { message: 'dia debe ser LUNES a VIERNES' })
  dia!: DiaSemanaLaboral;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_inicio!: number;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_fin!: number;

  // Una de las salas del departamento...
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  // ...o una sala de Educación u otra facultad
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sala_externa?: string;
}

export class CreateBloquesExternosDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un bloque' })
  @ValidateNested({ each: true })
  @Type(() => BloqueExternoDto)
  bloques!: BloqueExternoDto[];
}
