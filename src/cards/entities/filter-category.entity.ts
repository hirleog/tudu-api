import { FilterOption } from './filter-option.entity';

export class FilterCategory {
  title: string;
  options: FilterOption[];
  isSingleSelect?: boolean;
}
