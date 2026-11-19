import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';

// Periodo académico del horario: año y semestre (1: niveles impares, 2: niveles pares)
export class PeriodoDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2], { message: 'periodo debe ser 1 o 2' })
  periodo: number;
}
