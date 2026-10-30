import { IsInt, IsArray, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProfesorCargaDto {
  @IsInt()
  id_usuario!: number;

  @IsInt()
  @Min(1, { message: 'La cantidad de horas debe ser mayor que 0' })
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
