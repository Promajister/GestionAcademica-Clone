import { IsEnum, IsInt, Min } from 'class-validator';
import { TipoContrato } from '@prisma/client';

export class CreateProfesorDto {
  @IsInt()
  @Min(1)
  id_usuario!: number;

  @IsEnum(TipoContrato)
  contrato!: TipoContrato;
}