import { IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length, IsIn } from 'class-validator';

export enum EstadoPractica {
  EN_CURSO = 'EN_CURSO',
  APROBADO = 'APROBADO',
  REPROBADO = 'REPROBADO',
}

export class CreatePracticaDto {
  @IsString() @IsNotEmpty() @Length(3, 20)
  estudianteRut!: string;

  @IsInt() @IsPositive()
  centroId!: number;

  // admitir uno o varios colaboradores
  @IsOptional() @IsInt() @IsPositive()
  colaboradorId?: number;
  @IsOptional() @IsArray()
  @IsInt({ each: true }) @IsPositive({ each: true })
  colaboradorIds?: number[];

  // admitir uno o varios tutores
  @IsOptional() @IsInt() @IsPositive()
  tutorId?: number;
  @IsOptional() @IsArray()
  @IsInt({ each: true }) @IsPositive({ each: true })
  tutorIds?: number[];

  // Roles por tutor (alineados con tutorIds)
  // Valores permitidos: 'Supervisor' | 'Tallerista'
  @IsOptional() @IsString() @IsIn(['Supervisor','Tallerista'])
  tutorRole?: 'Supervisor' | 'Tallerista';
  @IsOptional() @IsArray()
  @IsIn(['Supervisor','Tallerista'] as unknown as string[], { each: true })
  tutorRoles?: ('Supervisor' | 'Tallerista')[];

  @IsDateString()
  fecha_inicio!: string;

  @IsOptional() @IsDateString()
  fecha_termino?: string; // se valida en service

  @IsOptional() @IsString()
  tipo?: string;

  @IsInt() @IsPositive()
  anio!: number;

  @IsInt() @IsIn([1, 2])
  semestre!: number;

  @IsOptional() @IsEnum(EstadoPractica)
  estado?: EstadoPractica; // default = EN_CURSO
}
