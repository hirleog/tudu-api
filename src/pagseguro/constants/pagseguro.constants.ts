export const PAGSEGURO_CONSTANTS = {
  SANDBOX: {
    AUTH_URL: 'https://sandbox.api.pagseguro.com/oauth2',
    API_URL: 'https://sandbox.api.pagseguro.com',
  },
  PRODUCTION: {
    AUTH_URL: 'https://api.pagseguro.com/oauth2',
    API_URL: 'https://api.pagseguro.com',
  },
  ENDPOINTS: {
    ACCESS_TOKEN: '/token',
    CREATE_CHARGE: '/charges',
    GET_CHARGE: '/charges/{charge_id}',
    CANCEL_CHARGE: '/charges/{charge_id}/cancel',
  },
  PIX_EXPIRATION: 15, // minutos
};
