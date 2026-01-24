import { PartialType } from '@nestjs/mapped-types';
import { CreatePostgradoDto } from './create-postgrado.dto';

export class UpdatePostgradoDto extends PartialType(CreatePostgradoDto) {}
