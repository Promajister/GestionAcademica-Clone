import { Type } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

// Plan + período (1 = primer semestre, 2 = segundo). El año es el año en curso.
export class PlanPeriodoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_plan!: number;

  @Type(() => Number)
  @IsInt()
  @IsIn([1, 2], { message: 'El período debe ser 1 (primer semestre) o 2 (segundo semestre)' })
  periodo!: number;
}
