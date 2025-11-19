export interface PixChargeRequest {
  reference_id: string;
  description: string;
  amount: {
    value: number;
    currency: string;
  };
  payment_method: {
    type: string;
    expires_at?: string;
    additional_info?: {
      name: string;
      value: string;
    }[];
  };
  notification_urls?: string[];
}

export interface PixChargeResponse {
  id: string;
  reference_id: string;
  status: string;
  created_at: string;
  paid_at?: string;
  description: string;
  amount: {
    value: number;
    currency: string;
    summary: {
      total: number;
      paid: number;
      refunded: number;
    };
  };
  payment_response: {
    code: string;
    message: string;
  };
  payment_method: {
    type: string;
    installments: number;
    capture: boolean;
    pix: {
      encrypted_value: string;
      qr_code: string;
      qr_code_image: string;
      expiration_date: string;
    };
  };
  links: {
    rel: string;
    href: string;
    media: string;
    type: string;
  }[];
}

export interface PixWebhookPayload {
  event: string;
  charge: {
    id: string;
    reference_id: string;
    status: string;
    created_at: string;
    paid_at?: string;
    amount: {
      value: number;
      currency: string;
    };
    payment_method: {
      type: string;
    };
  };
}
