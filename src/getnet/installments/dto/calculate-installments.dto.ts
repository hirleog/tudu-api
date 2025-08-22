import { IsNumber, IsPositive, Min, Max } from 'class-validator';

export class CalculateInstallmentsDto {
  @IsNumber()
  @IsPositive()
  @Min(100) // mínimo de R$ 1,00 (100 centavos)
  totalValue: number; // em centavos

  @IsNumber()
  @IsPositive()
  @Min(1)
  @Max(12)
  maxInstallments?: number = 12;
}
