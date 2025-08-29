import { PartialType } from '@nestjs/mapped-types';
import { CreateExperienciaDto } from './create-experiencia.dto';

export class UpdateExperienciaDto extends PartialType(CreateExperienciaDto) {}
