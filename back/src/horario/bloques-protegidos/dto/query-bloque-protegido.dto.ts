import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AlcanceBloqueProtegido } from '@prisma/client';

export class QueryBloqueProtegidoDto {
  @IsOptional()
  @IsEnum(AlcanceBloqueProtegido)
  alcance?: AlcanceBloqueProtegido;

  @IsOptional()
  @IsString()
  dia?: string;

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
