import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class UpdateRolPermisosDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permisosIds: number[];
}
