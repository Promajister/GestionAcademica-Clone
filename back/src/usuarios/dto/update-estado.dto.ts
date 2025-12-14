import { IsBoolean } from 'class-validator';

export class UpdateEstadoDto {
  @IsBoolean()
  activo: boolean;
}
