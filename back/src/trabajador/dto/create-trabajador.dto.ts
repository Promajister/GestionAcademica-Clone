import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsRut } from 'src/validador/rut.validador';
import { IsEmailList } from 'src/validador/email-list.validador';


export class CreateTrabajadorDto {
  @ValidateIf((o) => o.rut !== undefined && o.rut !== null && o.rut !== '')
  @IsString()
  @Length(3, 20)
  @IsRut({ message: 'El RUT no es válido' })
  rut?: string; // único según tu schema

  @IsString()
  @Length(3, 120)
  nombre: string;

  @IsOptional() @IsString()
  rol?: string;

  @IsOptional() @IsEmailList({ message: 'Correo no tiene formato válido' })
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
