import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, Max, Min } from 'class-validator';

// Mover un bloque protegido registrado (todas sus filas seguidas) a otro día y bloque de inicio
export class MoverBloqueProtegidoDto {
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  ids!: number[];

  @IsIn(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'], {
    message: 'El día debe ser de lunes a viernes',
  })
  dia!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bloque_inicio!: number;
}
