import { IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProfesorCargaDto {
  @IsInt()
  id_usuario!: number;

  @IsInt()
  cantidad_horas!: number;
}

export class AsignarCargaDto {
  @IsInt()
  id_curso!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfesorCargaDto)
  profesores!: ProfesorCargaDto[];
}