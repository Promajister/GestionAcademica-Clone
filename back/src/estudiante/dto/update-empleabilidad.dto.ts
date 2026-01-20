import { IsOptional, IsString } from 'class-validator';

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
}
