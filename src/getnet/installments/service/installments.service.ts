import { Injectable } from '@nestjs/common';
import { CalculateInstallmentsDto } from '../dto/calculate-installments.dto';
import {
  InstallmentCalculation,
  InstallmentOption,
} from '../entities/installment.entity';
import { SelectedInstallmentDto } from '../dto/selected-installment.dto';

@Injectable()
export class InstallmentsService {
  private readonly installmentTable = new Map<number, number>([
    [12, 33.99],
    [11, 31.46],
    [10, 29.44],
    [9, 26.91],
    [8, 24.8],
    [7, 22.78],
    [6, 21.16],
    [5, 19.14],
    [4, 17.02],
    [3, 14.4],
    [2, 12.38],
    [1, 8.84],
  ]);

  calculateInstallments(dto: CalculateInstallmentsDto): InstallmentCalculation {
    const totalValueInReais = dto.totalValue / 100;
    const options: InstallmentOption[] = [];

    // Opção à vista (sem juros)
    // options.push(this.createInstallmentOption(1, totalValueInReais, 0, false));

    // Opções parceladas
    for (
      let installments = 1;
      installments <= dto.maxInstallments;
      installments++
    ) {
      const interestRate = this.installmentTable.get(installments) || 0;
      options.push(
        this.createInstallmentOption(
          installments,
          totalValueInReais,
          interestRate,
          true,
        ),
      );
    }

    return {
      originalValue: dto.totalValue,
      options: options.sort((a, b) => a.installments - b.installments),
    };
  }

  private createInstallmentOption(
    installments: number,
    totalValueInReais: number,
    interestRate: number,
    hasInterest: boolean,
  ): InstallmentOption {
    let totalWithInterest: number;
    let installmentValue: number;

    if (hasInterest) {
      totalWithInterest = totalValueInReais * (1 + interestRate / 100);
      installmentValue = totalWithInterest / installments;
    } else {
      totalWithInterest = totalValueInReais;
      installmentValue = totalValueInReais;
    }

    // Converter para centavos e arredondar
    const totalValueInCents = Math.round(totalWithInterest * 100);
    const installmentValueInCents = Math.round(installmentValue * 100);

    return {
      installments,
      totalValue: totalValueInCents,
      installmentValue: installmentValueInCents,
      interestRate,
      hasInterest,
      displayText: this.generateDisplayText(
        installments,
        installmentValue,
        interestRate,
        hasInterest,
      ),
    };
  }

  private generateDisplayText(
    installments: number,
    installmentValue: number,
    interestRate: number,
    hasInterest: boolean,
  ): string {
    const formattedValue = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(installmentValue);

    // const interestText = hasInterest
    //   ? `(com ${interestRate.toFixed(2)}% de juros)`
    //   : '(sem juros)';

    return `${installments}x de ${formattedValue} `;
  }

  validateInstallment(selectedInstallment: SelectedInstallmentDto): boolean {
    const calculation = this.calculateInstallments({
      totalValue: selectedInstallment.totalValue,
      maxInstallments: selectedInstallment.installments,
    });

    const option = calculation.options.find(
      (opt) => opt.installments === selectedInstallment.installments,
    );

    if (!option) {
      return false;
    }

    // Valida se o valor total calculado bate com o esperado
    // Você pode adicionar uma margem de tolerância se necessário
    const expectedTotal = option.totalValue;
    return Math.abs(expectedTotal - selectedInstallment.totalValue) < 10; // tolerância de 10 centavos
  }

  getInstallmentTable(): Map<number, number> {
    return new Map(this.installmentTable);
  }
}
