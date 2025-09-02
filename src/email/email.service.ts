import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    try {
      const mailOptions = {
        from: this.configService.get('EMAIL_USER'),
        to: email,
        subject: '🔐 Código de Redefinição de Senha',
        html: this.buildPasswordResetTemplate(code),
      };

      console.log('allala', mailOptions);
      console.log(this.configService.get('EMAIL_USER'));

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email de redefinição enviado para: ${email}`);
      return true;
    } catch (error) {
      this.logger.error('Erro ao enviar email:', error);
      return false;
    }
  }

  private buildPasswordResetTemplate(code: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Redefinição de Senha</h2>
        <p>Olá! Use o código abaixo para redefinir sua senha:</p>
        
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
          <strong style="font-size: 28px; letter-spacing: 3px; color: #007bff;">${code}</strong>
        </div>
        
        <p>Este código expira em <strong>10 minutos</strong>.</p>
        
        <p style="color: #666; font-size: 14px;">
          Se você não solicitou esta redefinição, ignore este email.
        </p>
      </div>
    `;
  }
}
