// src/malga/dto/create-charge.dto.ts
export class CreateChargeDto {
  merchantId: string;
  amount: number;
  currency: string;
  orderId: string;
  customer: CustomerDto;
  paymentMethod: PaymentMethodDto;
  capture?: boolean;
  dueDate?: string;
  statementDescriptor?: string;
  metadata?: Record<string, any>;
}

export class CustomerDto {
  name: string;
  email: string;
  phoneNumber: string;
  document: DocumentDto;
  address: AddressDto;
}

export class DocumentDto {
  type: string;
  number: string;
}

export class AddressDto {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

export class PaymentMethodDto {
  paymentType: 'credit' | 'debit' | 'pix' | 'boleto';
  installments?: number;
  card?: CardDto;
  boleto?: BoletoDto;
}

export class CardDto {
  number: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  holderName: string;
}

export class BoletoDto {
  dueDate: string;
}

export class CreatePaymentDto {
  chargeId: string;
  paymentMethod: PaymentMethodDto;
}

export class UpdateChargeDto {
  status: 'authorized' | 'declined' | 'canceled';
  cancellationReason?: string;
}
