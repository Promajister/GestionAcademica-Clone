import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class QuerySalaDto {
  // La conversión implícita haría Boolean('false') === true, por eso se transforma a mano
  @IsOptional()
  @Transform(({ obj }: { obj: { soloActivas?: unknown } }) =>
    [true, 'true'].includes(obj.soloActivas as string),
  )
  @IsBoolean()
  soloActivas?: boolean;
}
