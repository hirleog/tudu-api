import { IsNumber, IsPositive, Min, Max } from 'class-validator';

export class SelectedInstallmentDto {
  @IsNumber()
  @IsPositive()
  totalValue: number; // em centavos

  @IsNumber()
  @Min(1)
  @Max(12)
  installments: number;
}
