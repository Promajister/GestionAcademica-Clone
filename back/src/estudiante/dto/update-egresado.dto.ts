import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEgresadoDto {
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return value;
  })
  @IsBoolean()
  egresado!: boolean;
}
