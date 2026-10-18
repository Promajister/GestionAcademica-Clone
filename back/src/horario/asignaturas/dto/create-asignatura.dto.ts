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
import { OrigenAsignatura } from '@prisma/client';
import { trim } from '../../common/trim.transform';
import { BloqueExternoDto } from '../../bloques/dto/bloque-externo.dto';

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

  @IsInt()
  @Min(1)
  @Max(20)
  bloques_semanales!: number;

  @IsInt()
  @Min(1)
  @Max(100)
  cupo!: number;

  @IsEnum(OrigenAsignatura, {
    message: 'El origen debe ser PROPIA o EXTERNA',
  })
  origen!: OrigenAsignatura;

  // Solo para EXTERNAS (ADM-F02-T3). En PATCH reemplaza los bloques actuales.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BloqueExternoDto)
  bloques_externos?: BloqueExternoDto[];
}
