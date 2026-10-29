import { IsDateString, IsInt, IsOptional, IsPositive } from 'class-validator';

export class QueryOcupacionDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  id_sala?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  desde?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  hasta?: string;
}
