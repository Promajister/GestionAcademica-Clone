import { IsEnum, IsOptional } from 'class-validator';
import { TipoContrato } from '@prisma/client';

export class UpdateProfesorDto {
  @IsOptional()
  @IsEnum(TipoContrato)
  contrato?: TipoContrato;
}