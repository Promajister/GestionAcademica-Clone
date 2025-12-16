import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class UpdateRolPermisosDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  permisosIds: number[];
}
