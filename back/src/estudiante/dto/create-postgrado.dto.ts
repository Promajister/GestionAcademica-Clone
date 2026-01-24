import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum TipoPostgradoDto {
  DIPLOMADO = 'DIPLOMADO',
  MAGISTER = 'MAGISTER',
  DOCTORADO = 'DOCTORADO',
  OTRO = 'OTRO',
}

export enum EstadoPostgradoDto {
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
}

export class CreatePostgradoDto {
  @IsEnum(TipoPostgradoDto)
  tipo!: TipoPostgradoDto;

  @IsString()
  institucion!: string;

  @IsOptional() @IsInt() @Min(1900) @Max(2100)
  anioInicio?: number | null;

  @IsOptional() @IsInt() @Min(1900) @Max(2100)
  anioTermino?: number | null;

  @IsEnum(EstadoPostgradoDto)
  estado!: EstadoPostgradoDto;
}
