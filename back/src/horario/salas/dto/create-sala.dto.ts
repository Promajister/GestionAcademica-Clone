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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSalaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El código de la sala es obligatorio' })
  @MaxLength(30)
  codigo!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre oficial de la sala es obligatorio' })
  @MaxLength(100)
  nombre!: string;

  @IsEnum(TipoSala, { message: 'El tipo de sala debe ser CLASES o REUNION' })
  tipo!: TipoSala;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
