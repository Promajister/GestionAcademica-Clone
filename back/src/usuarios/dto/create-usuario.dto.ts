import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  nombre: string;

  // profesor y secretaria: perfiles del módulo Horario (ADM-F04)
  @IsIn(['jefatura', 'vinculacion', 'practicas', 'profesor', 'secretaria'])
  role: 'jefatura' | 'vinculacion' | 'practicas' | 'profesor' | 'secretaria';

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  rolId?: number;

  @IsString()
  @MinLength(4)
  password: string;
}
