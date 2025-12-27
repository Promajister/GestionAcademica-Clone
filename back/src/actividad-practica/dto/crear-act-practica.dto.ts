import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActividadPracticaDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  descripcion: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe indicar el tallerista asociado' })
  tallerista: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe indicar el estudiante asociado' })
  estudiante: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato válido (YYYY-MM-DD)' })
  fechaRegistro?: string;

  @IsOptional()
  @IsString()
  evidenciaUrl?: string; // PDF o PNG
}