import { PartialType } from '@nestjs/mapped-types';
import { CreateBloqueProtegidoDto } from './create-bloque-protegido.dto';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateBloqueProtegidoDto extends PartialType(
  CreateBloqueProtegidoDto,
) {
  @IsOptional()
  @IsInt()
  @Min(1)
  id_dia?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  id_bloque?: number;
}
