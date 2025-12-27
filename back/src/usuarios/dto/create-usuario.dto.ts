import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class CreateUsuarioDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  nombre: string;

  @IsIn(['jefatura', 'vinculacion', 'practicas'])
  role: 'jefatura' | 'vinculacion' | 'practicas';

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
