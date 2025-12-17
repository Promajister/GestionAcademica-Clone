import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateObservacionDto {
  @IsString() @IsNotEmpty()
  descripcion!: string;
}

