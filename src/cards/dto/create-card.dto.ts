// create-card.dto.ts
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressContentDto {
  @IsNotEmpty() @IsString() cep: string;
  @IsNotEmpty() @IsString() street: string;
  @IsNotEmpty() @IsString() neighborhood: string;
  @IsNotEmpty() @IsString() city: string;
  @IsNotEmpty() @IsString() state: string;
  @IsNotEmpty() @IsString() country: string;
  @IsNotEmpty() @IsString() number: string;
  @IsNotEmpty() @IsString() complement: string;
  
  // ... outros campos
}

class FilterOptionDto {
  @IsNotEmpty() @IsString() label: string;
  @IsNotEmpty() @IsString() value: string;
  @IsNotEmpty() selected: boolean;
}

class FilterCategoryDto {
  @IsNotEmpty() @IsString() title: string;
  isSingleSelect?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterOptionDto)
  options: FilterOptionDto[];
}

export class CreateCardDto {
  @IsNotEmpty() @IsString() cardTitle: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressContentDto)
  addressContent: AddressContentDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterCategoryDto)
  filters: FilterCategoryDto[];
  @IsNotEmpty() @IsString() dateTimeSelected: string;
  @IsNotEmpty() @IsString() price: string;
}
