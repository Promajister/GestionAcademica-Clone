import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  nombre: string;

  @IsString()
  role: 'jefatura' | 'vinculacion' | 'practicas';

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  rolId?: number;

  @IsString()
  @MinLength(4)
  password: string;
}
