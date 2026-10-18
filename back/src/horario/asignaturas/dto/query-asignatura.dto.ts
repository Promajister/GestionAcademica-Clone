import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { OrigenAsignatura } from '@prisma/client';

export class QueryAsignaturaDto {
  @IsOptional()
  @IsEnum(OrigenAsignatura)
  origen?: OrigenAsignatura;

  @IsOptional()
  @IsInt()
  @IsPositive()
  id_carrera?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  id_plan?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  semestre?: number;
}
