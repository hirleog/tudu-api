import { Controller, Post, Body, Get } from '@nestjs/common';
import { InstallmentsService } from '../service/installments.service';
import { CalculateInstallmentsDto } from '../dto/calculate-installments.dto';
import { InstallmentCalculation } from '../entities/installment.entity';
import { SelectedInstallmentDto } from '../dto/selected-installment.dto';

@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Post('calculate')
  calculate(
    @Body() calculateInstallmentsDto: CalculateInstallmentsDto,
  ): InstallmentCalculation {
    return this.installmentsService.calculateInstallments(
      calculateInstallmentsDto,
    );
  }

  @Post('validate')
  validate(@Body() selectedInstallmentDto: SelectedInstallmentDto): {
    isValid: boolean;
  } {
    const isValid = this.installmentsService.validateInstallment(
      selectedInstallmentDto,
    );
    return { isValid };
  }

  @Get('table')
  getInstallmentTable() {
    const table = this.installmentsService.getInstallmentTable();
    return Object.fromEntries(table);
  }
}
