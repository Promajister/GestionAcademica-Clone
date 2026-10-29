import { IsOptional, IsPositive } from 'class-validator';

export class QueryAsignaturaDto {
  @IsOptional()
  origen?: string;

  @IsOptional()
  id_carrera?: string | number;

  @IsOptional()
  codigo_carrera?: string;

  @IsOptional()
  @IsPositive()
  id_plan?: number;

  @IsOptional()
  @IsPositive()
  semestre?: number;
}
