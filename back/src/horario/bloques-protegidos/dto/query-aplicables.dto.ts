import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAplicablesDto {
  @IsOptional()
  @IsString()
  codigo_carrera?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semestre?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  id_usuario?: number;
}
