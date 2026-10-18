import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DiaSemana } from '@prisma/client';
import { trim } from '../../common/trim.transform';

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class BloqueExternoDto {
  @IsEnum(DiaSemana, { message: 'dia debe ser LUNES a VIERNES' })
  dia!: DiaSemana;

  @IsString()
  @Matches(HORA, { message: 'hora_inicio debe tener formato HH:mm' })
  hora_inicio!: string;

  @IsString()
  @Matches(HORA, { message: 'hora_fin debe tener formato HH:mm' })
  hora_fin!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  bloque_numero?: number;

  // Una de las 6 salas del departamento...
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  // ...o una sala de Educación u otra facultad
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sala_externa?: string;
}

export class CreateBloquesExternosDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe enviar al menos un bloque' })
  @ValidateNested({ each: true })
  @Type(() => BloqueExternoDto)
  bloques!: BloqueExternoDto[];
}
