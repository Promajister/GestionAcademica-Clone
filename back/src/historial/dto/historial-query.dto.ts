import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class HistorialQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pdf'], { message: 'Solo se soporta format=pdf' })
  format?: string;

  @Transform(({ value }) => (value !== undefined ? Number(value) : 50))
  @IsOptional()
  limit?: number;
}
