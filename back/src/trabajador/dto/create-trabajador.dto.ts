import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { IsRut } from 'src/validador/rut.validador';


export class CreateTrabajadorDto {
  @IsString()
  @Length(3, 20)
  @IsRut({ message: 'El RUT no es válido' })
  rut: string; // único según tu schema

  @IsString()
  @Length(3, 120)
  nombre: string;

  @IsOptional() @IsString()
  rol?: string;

  @IsOptional() @IsEmail()
  correo?: string;

  // Si mantienes Int en Prisma, usa IsInt; si cambias a String en Prisma, cámbialo por IsString aquí
  @IsOptional() @IsInt()
  @Min(100000, { message: 'El telefono debe tener entre 6 y 13 digitos' })
  @Max(9999999999999, { message: 'El telefono debe tener entre 6 y 13 digitos' })
  telefono?: number;

  // ← OBLIGATORIO: debe existir el centro
  @IsNotEmpty() @IsInt()
  centroId: number;
}
