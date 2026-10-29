import { IsDateString, IsInt, IsPositive, Max, Min } from 'class-validator';
import { TOTAL_BLOQUES } from '../../common/grilla';

export class CreateOcupacionDto {
  @IsDateString(
    { strict: true },
    { message: 'fecha debe tener formato YYYY-MM-DD' },
  )
  fecha!: string;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_inicio!: number;

  @IsInt()
  @Min(1)
  @Max(TOTAL_BLOQUES)
  bloque_fin!: number;

  @IsInt()
  @IsPositive()
  id_sala!: number;
}
