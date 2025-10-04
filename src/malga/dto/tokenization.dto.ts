export class CreateTokenDto {
  cardNumber: string;
  cardExpirationDate: string;
  cardCvv: string;
  cardHolderName: string;
  customerId?: string;
}

export class TokenResponseDto {
  tokenId: string;
  brand: string;
  expiryMonth: string;
  expiryYear: string;
  last4: string;
  holderName: string;
  customerId?: string;
  createdAt: string;
}

export class ValidateTokenDto {
  tokenId: string;
  securityCode: string;
}

export class CustomerCreationDto {
  name: string;
  email: string;
  phoneNumber: string;
  document: {
    type: string;
    number: string;
  };
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
  };
}
