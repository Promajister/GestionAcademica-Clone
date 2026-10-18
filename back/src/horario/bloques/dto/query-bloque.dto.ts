import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { DiaSemana, OrigenAsignatura } from '@prisma/client';

export class QueryBloqueDto {
  @IsOptional()
  @IsEnum(DiaSemana)
  dia?: DiaSemana;

  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  @IsOptional()
  @IsEnum(OrigenAsignatura)
  origen?: OrigenAsignatura;
}
