import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const DIAS_DISPONIBILIDAD = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
] as const;

export type DiaDisponibilidad = (typeof DIAS_DISPONIBILIDAD)[number];

export class BloqueDisponibleDto {
  @IsIn(DIAS_DISPONIBILIDAD as unknown as string[], {
    message: 'El día debe ser de lunes a viernes',
  })
  dia: DiaDisponibilidad;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bloque: number;
}

// PUT /horario/disponibilidad/mia → reemplaza la disponibilidad completa del docente
export class GuardarDisponibilidadDto {
  @IsArray()
  @ArrayMaxSize(5 * 12)
  @ValidateNested({ each: true })
  @Type(() => BloqueDisponibleDto)
  bloques: BloqueDisponibleDto[];
}
