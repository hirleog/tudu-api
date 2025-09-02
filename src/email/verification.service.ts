import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';

interface VerificationCode {
  code: string;
  email: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
}

@Injectable()
export class VerificationService {
  private codes: Map<string, VerificationCode> = new Map();
  private readonly logger = new Logger(VerificationService.name);
  private readonly MAX_ATTEMPTS = 3;
  private readonly CODE_EXPIRATION = 10 * 60 * 1000; // 10 minutos
  
  // verification.service.ts
  generateVerificationCode(email: string): string {
    // Limpar códigos expirados
    this.cleanExpiredCodes();

    // Gerar código de 6 dígitos e garantir que é string
    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRATION);

    this.codes.set(code, {
      code,
      email,
      expiresAt,
      used: false,
      attempts: 0,
    });

    this.logger.log(`Código gerado para ${email}: ${code}`);
    return code;
  }

  validateCode(code: string, email: string): boolean {
    const verificationCode = this.codes.get(code);

    if (!verificationCode) {
      throw new Error('Código inválido');
    }

    if (verificationCode.used) {
      throw new Error('Código já utilizado');
    }

    if (verificationCode.email !== email) {
      throw new Error('Código não corresponde ao email');
    }

    if (verificationCode.expiresAt < new Date()) {
      throw new Error('Código expirado');
    }

    if (verificationCode.attempts >= this.MAX_ATTEMPTS) {
      throw new Error('Muitas tentativas inválidas');
    }

    verificationCode.attempts++;
    return true;
  }

  markCodeAsUsed(code: string): void {
    const verificationCode = this.codes.get(code);
    if (verificationCode) {
      verificationCode.used = true;
    }
  }

  private cleanExpiredCodes(): void {
    const now = new Date();
    for (const [code, data] of this.codes.entries()) {
      if (data.expiresAt < now) {
        this.codes.delete(code);
      }
    }
  }

  getRemainingAttempts(code: string): number {
    const verificationCode = this.codes.get(code);
    if (!verificationCode) return 0;
    return this.MAX_ATTEMPTS - verificationCode.attempts;
  }
}
