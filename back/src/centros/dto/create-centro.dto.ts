import { IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const TIPO_CENTRO_VALUES = ['PARTICULAR', 'PARTICULAR_SUBVENCIONADO', 'SLEP', 'NO_CONVENCIONAL'] as const;
export type TipoCentroDTO = typeof TIPO_CENTRO_VALUES[number];

export class CreateCentroDto {
  @IsString()
  @MaxLength(200)
  @IsNotEmpty()
  nombre!: string;

  @IsOptional() @IsString()
  @MaxLength(20)
  rbd?: string | null;

  @IsString()
  @IsIn(TIPO_CENTRO_VALUES)
  tipo!: TipoCentroDTO;

  @IsString()
  @IsNotEmpty()
  region!: string;

  @IsString()
  @IsNotEmpty()
  comuna!: string;

  @IsOptional() @IsString()
  convenio?: string | null;

  @IsOptional() @IsString()
  direccion?: string | null;

  @IsOptional()
  telefono?: number | null;

  @IsOptional()
  correo?: string | null;

  @IsOptional() @IsString()
  url_rrss?: string | null;

  @IsOptional() @IsDateString()
  fecha_inicio_asociacion?: string;
}
