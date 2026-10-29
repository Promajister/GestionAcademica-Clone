import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TipoSala } from '@prisma/client';
import { trim } from '../../common/trim.transform';

export class CreateSalaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre oficial de la sala es obligatorio' })
  @MaxLength(100)
  nombre!: string;

  @IsEnum(TipoSala, { message: 'El tipo de sala debe ser CLASES o REUNIONES' })
  tipo!: TipoSala;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
