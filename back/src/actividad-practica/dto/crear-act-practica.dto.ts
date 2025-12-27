import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActividadPracticaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la actividad es obligatorio' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  descripcion?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'Debe indicar el tallerista asociado' })
  tallerista?: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty({ message: 'Debe indicar al menos un(a) estudiante asociado(a).' })
  estudiante?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato válido (YYYY-MM-DD)' })
  fechaRegistro?: string;

  @IsOptional()
  @IsString()
  evidenciaUrl?: string; // PDF o PNG
}