import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class ActualizarNotaFinalDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(7)
  nota_final!: number;
}
