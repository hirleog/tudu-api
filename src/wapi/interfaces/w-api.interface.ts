export interface SendMessageDto {
  phone: string;
  message: string;
  delayMessage?: number;
}

export interface MessageResponse {
  instanceId: string;
  messageId: string;
  insertedId: string;
}

export interface WApiConfig {
  baseUrl: string;
  instanceId: string;
  token: string;
}
