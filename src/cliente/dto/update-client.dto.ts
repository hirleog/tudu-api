import { PartialType } from '@nestjs/mapped-types';
import { CreateCardDto } from 'src/cards/dto/create-card.dto';

export class UpdateCardDto extends PartialType(CreateCardDto) {}
