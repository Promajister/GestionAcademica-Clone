import { IsOptional, IsString, IsEnum, IsIn, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum EstadoPracticaFiltro {
  EN_CURSO = 'EN_CURSO',
  APROBADO = 'APROBADO',
  REPROBADO = 'REPROBADO',
}

export class QueryEstudianteDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  rut?: string;

  @IsOptional()
  @IsString()
  carrera?: string;

  @IsOptional()
  @IsEnum(EstadoPracticaFiltro)
  estadoPractica?: EstadoPracticaFiltro;

  @IsOptional()
  @IsString()
  tipoPractica?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  anio?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  anioIngreso?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  @IsIn([1, 2])
  semestre?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  page?: number;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  @IsInt()
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  egresado?: boolean;
}
