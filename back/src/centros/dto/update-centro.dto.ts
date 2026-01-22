import { PartialType } from '@nestjs/mapped-types';
import { CreateCentroDto, TIPO_CENTRO_VALUES } from './create-centro.dto';
import { IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';

export class UpdateCentroDto extends PartialType(CreateCentroDto) {
  @IsOptional() @IsString() @MaxLength(200)
  override nombre?: string;

  @IsOptional()
  @IsString()
  @IsIn(TIPO_CENTRO_VALUES)
  override tipo?: (typeof TIPO_CENTRO_VALUES)[number];

  @IsOptional() @IsString()
  override region?: string;

  @IsOptional() @IsString()
  override comuna?: string;

  @IsOptional() @IsString()
  override convenio?: string | null;

  @IsOptional() @IsString()
  override direccion?: string | null;

  @IsOptional()
  @IsInt()
  @Min(100000, { message: 'El telefono debe tener entre 6 y 13 digitos' })
  @Max(9999999999999, { message: 'El telefono debe tener entre 6 y 13 digitos' })
  override telefono?: number | null;

  @IsOptional()
  override correo?: string | null;

  @IsOptional() @IsString()
  override url_rrss?: string | null;

  @IsOptional() @IsDateString()
  fecha_inicio_asociacion?: string;
}
