import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

export class CreateObservacionDto {
  @IsInt() @IsPositive()
  practicaId!: number;

  @IsString() @IsNotEmpty()
  descripcion!: string;
}

