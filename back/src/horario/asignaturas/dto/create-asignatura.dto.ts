import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OrigenAsignatura } from '@prisma/client';
import { trim } from '../../common/trim.transform';

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
}
