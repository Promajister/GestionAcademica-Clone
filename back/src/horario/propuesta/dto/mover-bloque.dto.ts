import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { PeriodoDto } from './periodo.dto';

// GEN-F02: mover una clase (bloques seguidos de un curso) a otro día, bloque o sala
export class MoverBloqueDto extends PeriodoDto {
  @IsIn(['INTERNA', 'EXTERNA'])
  origen: 'INTERNA' | 'EXTERNA';

  @Type(() => Number)
  @IsInt()
  id_curso: number;

  // Dónde está hoy la clase
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  id_dia: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bloque_inicio: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bloque_fin: number;

  // null: clase externa en una sala de otro departamento
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  id_sala: number | null;

  // A dónde se suelta
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  hacia_dia: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  hacia_bloque: number;

  // Si se omite, la clase se queda en su sala
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  hacia_sala?: number;
}
