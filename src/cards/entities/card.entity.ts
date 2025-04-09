import { AddressContent } from './address-content.entity';
import { FilterCategory } from './filter-category.entity';

export class Card {
  id?: string;
  cardTitle: string;
  addressContent: AddressContent[];
  filters: FilterCategory[];
  dateTimeSelected: string;
  price: string;
}
