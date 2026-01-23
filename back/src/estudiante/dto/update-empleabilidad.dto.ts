import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateEmpleabilidadDto {
  @IsString()
  lugarTrabajo!: string;

  @IsString()
  sector!: string;

  @IsOptional()
  @IsString()
  sectorOtro?: string | null;

  @IsString()
  cargo!: string;

  @IsOptional()
  @IsString()
  cargoOtro?: string | null;

  @IsOptional()
  @IsString()
  direccion?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fono?: number | null;
}
