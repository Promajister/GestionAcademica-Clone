import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { TipoDia } from '@prisma/client';

export class QueryBloqueDto {
  @IsOptional()
  @IsEnum(TipoDia)
  dia?: TipoDia;

  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  @IsOptional()
  @IsString()
  origen?: string;
}
