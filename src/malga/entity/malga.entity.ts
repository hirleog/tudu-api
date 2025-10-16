// No controller ou em um arquivo de tipos
export interface MalgaPaymentRequest {
  merchantId?: string;
  amount: number;
  originAmount?: number;

  currency: string;
  statementDescriptor: string;
  description: string;
  capture: boolean;
  orderId: string;

  paymentMethod: {
    paymentType: 'credit' | 'debit';
    installments: number;
  };
  paymentSource: {
    sourceType: 'card';
    card: {
      cardNumber: string;
      cardCvv: string;
      cardExpirationDate: string;
      cardHolderName: string;
    };
  };
  customer: {
    name: string;
    email: string;
    phoneNumber: string;
    document: {
      type: string;
      number: string;
    };
    address: {
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
  };
  appInfo?: {
    platform?: {
      integrator?: string;
      name?: string;
      version?: string;
    };
    device?: {
      name?: string;
      version?: string;
    };
    system?: {
      name?: string;
      version?: string;
    };
  };
  id_pedido: string;
  installment_data?: {
    total_with_tax?: number;
    installments?: number;
    installment_value?: number;
  };
}
