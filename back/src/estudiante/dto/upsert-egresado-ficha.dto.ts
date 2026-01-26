import { IsDateString, IsEmail, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

const emptyToNull = () =>
  Transform(({ value }) => (value === '' ? null : value));

const toIntOrNull = () =>
  Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)));

export class UpsertEgresadoFichaDto {
  @IsOptional()
  @emptyToNull()
  @IsString()
  nacionalidad?: string | null;

  @IsOptional()
  @toIntOrNull()
  @IsInt()
  anioEgreso?: number | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)))
  @IsNumber()
  notaTitulacion?: number | null;

  @IsOptional()
  @emptyToNull()
  @IsDateString()
  fechaDefensa?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  celular?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  direccion?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  region?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  ciudad?: string | null;
}
