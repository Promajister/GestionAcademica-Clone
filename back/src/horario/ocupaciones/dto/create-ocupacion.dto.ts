import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { DiaSemana, TipoOcupacion } from '@prisma/client';
import { trim } from '../../common/trim.transform';
import { TOTAL_BLOQUES } from '../../common/grilla';

export class CreateOcupacionDto {
  @IsEnum(TipoOcupacion, { message: 'tipo debe ser PUNTUAL o SEMESTRAL' })
  tipo!: TipoOcupacion;

  // PUNTUAL: fecha concreta "YYYY-MM-DD"
  @ValidateIf((o: CreateOcupacionDto) => o.tipo === TipoOcupacion.PUNTUAL)
  @IsDateString(
    { strict: true },
    { message: 'fecha debe tener formato YYYY-MM-DD' },
  )
  fecha?: string;

  // SEMESTRAL: día de la semana que se repite
  @ValidateIf((o: CreateOcupacionDto) => o.tipo === TipoOcupacion.SEMESTRAL)
  @IsEnum(DiaSemana, { message: 'dia debe ser LUNES a VIERNES' })
  dia?: DiaSemana;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_inicio!: number;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_fin!: number;

  @IsInt()
  @IsPositive()
  id_sala!: number;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MaxLength(255)
  motivo!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique quién solicita la sala' })
  @MaxLength(150)
  solicitante!: string;
}
