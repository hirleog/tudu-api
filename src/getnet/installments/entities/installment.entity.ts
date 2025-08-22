export class InstallmentOption {
  installments?: number;
  totalValue?: number; // em centavos
  installmentValue?: number; // em centavos
  interestRate?: number;
  hasInterest?: boolean;
  displayText?: string;
}

export class InstallmentCalculation {
  originalValue?: number; // em centavos
  options?: InstallmentOption[];
}
