import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryCursosDto {
  // Nivel de la malla; si no viene, se listan los cursos de todos los niveles
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  semestre?: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year!: number;
}
