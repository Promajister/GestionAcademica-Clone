import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Length } from 'class-validator';

export class UpdatePracticaDto {
  @IsString() @IsNotEmpty() @Length(3, 20)
  estudianteRut!: string;

  @IsInt() @IsPositive()
  centroId!: number;

  @IsArray()
  @IsInt({ each: true }) @IsPositive({ each: true })
  colaboradorIds!: number[];

  @IsArray()
  @IsInt({ each: true }) @IsPositive({ each: true })
  tutorIds!: number[];

  @IsArray()
  @IsIn(['Supervisor','Tallerista'] as unknown as string[], { each: true })
  tutorRoles!: ('Supervisor' | 'Tallerista')[];

  @IsDateString()
  fecha_inicio!: string;

  @IsOptional() @IsDateString()
  fecha_termino?: string;

  @IsOptional() @IsString()
  tipo?: string;

  @IsInt() @IsPositive()
  anio!: number;

  @IsInt() @IsIn([1, 2])
  semestre!: number;
}
