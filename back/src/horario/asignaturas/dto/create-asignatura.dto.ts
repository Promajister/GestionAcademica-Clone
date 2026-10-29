import { Transform, Type } from 'class-transformer';
import {
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
import { BloqueExternoDto } from '../../bloques/dto/bloque-externo.dto';

export enum OrigenEntrada {
  INTERNA = 'INTERNA',
  EXTERNA = 'EXTERNA',
  PROPIA = 'PROPIA',
}

export class CreateAsignaturaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El código de la asignatura es obligatorio' })
  @MaxLength(30)
  codigo!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la asignatura es obligatorio' })
  @MaxLength(150)
  nombre!: string;

  @IsInt()
  @IsPositive()
  id_plan!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  semestre!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  catedraSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  tallerSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  labSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  bloques_semanales?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  cupo?: number;

  @IsEnum(OrigenEntrada, {
    message: 'El origen debe ser INTERNA, PROPIA o EXTERNA',
  })
  origen!: OrigenEntrada;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BloqueExternoDto)
  bloques_externos?: BloqueExternoDto[];
}
