import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { trim } from '../../common/trim.transform';
import { BloqueExternoDto } from '../../bloques/dto/bloque-externo.dto';

export enum OrigenEntrada {
  INTERNA = 'INTERNA',
  EXTERNA = 'EXTERNA',
  PROPIA = 'PROPIA',
}

// Un grupo (sección) de una asignatura propia: cada uno es un curso con su cupo y su docente
export class GrupoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z0-9]{1,3}$/, {
    message: 'El grupo se identifica con hasta 3 letras o números (ej. A, B)',
  })
  grupo!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  cupo!: number;
}

export class CreateAsignaturaDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El código de la asignatura es obligatorio' })
  @MaxLength(30)
  codigo!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la asignatura es obligatorio' })
  @MaxLength(150)
  nombre!: string;

  @IsInt()
  @IsPositive()
  id_plan!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  semestre!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  catedraSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  tallerSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  labSemanal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  bloques_semanales?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  cupo?: number;

  // Grupos de una asignatura propia. Si no se envían, hay un solo grupo A con el cupo indicado.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'La asignatura debe tener al menos un grupo' })
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => GrupoDto)
  grupos?: GrupoDto[];

  @IsEnum(OrigenEntrada, {
    message: 'El origen debe ser INTERNA, PROPIA o EXTERNA',
  })
  origen!: OrigenEntrada;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BloqueExternoDto)
  bloques_externos?: BloqueExternoDto[];
}
