import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActividadEgresadosDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  horario?: string;

  @IsString()
  @IsNotEmpty({ message: 'Debe indicar al menos un egresado participante' })
  egresados: string; // JSON array de RUTs

  @IsOptional()
  @IsString()
  tercerosAsistieron?: string;

  @IsOptional()
  @IsString()
  terceros?: string; // JSON array de terceros

  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener un formato válido (YYYY-MM-DD)' })
  fechaRegistro?: string;

  @IsOptional()
  @IsString()
  evidenciaUrl?: string;

  @IsOptional()
  satisfaccion?: number | null;
}
