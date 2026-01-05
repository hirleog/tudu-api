import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get('EMAIL_USER');
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.fromEmail,
        pass: this.configService.get('EMAIL_PASSWORD'),
      },
    });
  }

  /**
   * Método genérico para envio de e-mail
   */
  private async send(
    to: string,
    subject: string,
    html: string,
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: `"Sua Empresa" <${this.fromEmail}>`,
        to,
        subject,
        html,
      });
      this.logger.log(`E-mail enviado com sucesso: ${subject} -> ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail para ${to}:`, error);
      return false;
    }
  }

  // --- CENÁRIOS DE ENVIO ---

  async sendWelcomeEmail(email: string, name: string) {
    const content = `
      <span class="badge">Boas-vindas</span>
      <h1>Olá, ${name}!</h1>
      <p>Estamos muito felizes em ver você por aqui. Sua conta foi criada com sucesso e já está pronta para uso.</p>
      <p>Explore nossa plataforma e aproveite todas as funcionalidades que preparamos para você.</p>
      <a href="https://seuapp.com/login" class="button">Acessar minha conta</a>
    `;
    const html = this.buildMainLayout(content);
    return this.send(email, '🚀 Bem-vindo à nossa plataforma!', html);
  }

  async sendPaymentConfirmation(
    email: string,
    orderId: string,
    amount: number,
  ) {
    const content = `
      <div style="text-align: center;">
        <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
        <h1>Pagamento Confirmado!</h1>
        <p>Recebemos a confirmação do seu pagamento para o pedido <strong>#${orderId}</strong>.</p>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
          <p style="margin:0; color: #666;">Valor processado</p>
          <strong style="font-size: 24px; color: #28a745;">R$ ${amount.toFixed(2)}</strong>
        </div>
        <p>Em breve você receberá novas atualizações sobre o rastreio.</p>
      </div>
    `;
    const html = this.buildMainLayout(content);
    return this.send(email, '✅ Pagamento Confirmado', html);
  }

  async sendOrderCompleted(email: string, orderId: string) {
    const content = `
      <span class="badge" style="background: #d4edda; color: #155724;">Concluído</span>
      <h1>Seu pedido chegou!</h1>
      <p>O pedido <strong>#${orderId}</strong> foi entregue com sucesso.</p>
      <p>Esperamos que sua experiência tenha sido incrível. Se precisar de algo, estamos à disposição no suporte.</p>
      <div style="margin-top: 25px; border-top: 1px solid #eee; padding-top: 20px;">
         <p style="font-size: 14px; color: #666;">Obrigado por comprar conosco!</p>
      </div>
    `;
    const html = this.buildMainLayout(content);
    return this.send(email, '📦 Seu pedido chegou!', html);
  }

  async sendOrderReviewRequest(email: string, orderId: string) {
    const content = `
      <h1>O que você achou?</h1>
      <p>Sua opinião é fundamental para melhorarmos nossos serviços. Como foi sua experiência com o pedido <strong>#${orderId}</strong>?</p>
      <p>Clique abaixo para nos dar uma nota:</p>
      <div style="text-align: center; padding: 20px 0;">
        <a href="https://seuapp.com/review/${orderId}" class="button">Avaliar Pedido</a>
      </div>
      <p style="text-align: center; color: #ffc107; font-size: 24px;">★ ★ ★ ★ ★</p>
    `;
    const html = this.buildMainLayout(content);
    return this.send(email, '⭐ Avalie sua compra', html);
  }

  async sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
    const content = `
      <span class="badge" style="background: #fff3cd; color: #856404;">Segurança</span>
      <h1>Redefinição de Senha</h1>
      <p>Você solicitou a redefinição de sua senha. Use o código abaixo para prosseguir:</p>
      <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; border: 1px dashed #007bff;">
        <strong style="font-size: 32px; letter-spacing: 5px; color: #007bff;">${code}</strong>
      </div>
      <p>Este código expira em <strong>10 minutos</strong>.</p>
      <p style="color: #666; font-size: 14px;">Se você não solicitou esta alteração, pode ignorar este e-mail com segurança.</p>
    `;
    const html = this.buildMainLayout(content);
    return this.send(email, '🔐 Código de Redefinição de Senha', html);
  }

  async sendProviderAnalysisEmail(email: string, name: string) {
    const content = `
    <span class="badge" style="background: #fff3cd; color: #856404;">Em Análise</span>
    <h1>Olá, ${name}! Recebemos seus dados.</h1>
    <p>Obrigado por escolher ser um parceiro da <strong>Sua Empresa</strong>. Seus documentos já foram enviados para o nosso setor de compliance.</p>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f80e6e;">
      <p style="margin:0; font-weight: bold;">O que acontece agora?</p>
      <p style="margin:5px 0 0; font-size: 14px; color: #666;">
        Nossa equipe revisará suas fotos e documentos em até <strong>48 horas úteis</strong>. 
        Assim que a análise for concluída, você receberá um novo e-mail com o resultado.
      </p>
    </div>

    <p>Enquanto isso, certifique-se de que seu perfil está completo para atrair mais clientes assim que for aprovado!</p>
    <a href="https://seuapp.com/perfil" class="button">Ver meu Perfil</a>
  `;
    const html = this.buildMainLayout(content);
    return this.send(
      email,
      '📋 Recebemos seu cadastro! Seus dados estão em análise',
      html,
    );
  }

  /**
   * Estrutura HTML base (Design System)
   */
  private buildMainLayout(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          .wrapper { background-color: #f4f7f9; padding: 40px 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
          .header { background: #f80e6e; padding: 40px 20px; text-align: center; }
          .body { padding: 40px; color: #333333; line-height: 1.8; }
          .footer { padding: 30px; text-align: center; color: #999999; font-size: 13px; background: #fafafa; }
          .button { background: #007bff; color: #ffffff !important; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 25px 0; }
          .badge { background: #e7f3ff; color: #007bff; padding: 6px 16px; border-radius: 50px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: inline-block; margin-bottom: 15px; }
          h1 { margin: 0 0 20px; font-size: 26px; color: #111; font-weight: 800; }
          p { margin: 0 0 15px; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              <span style="color: white; font-size: 22px; font-weight: bold; letter-spacing: 3px;">Tudü</span>
            </div>
            <div class="body">
              ${content}
            </div>
            <div class="footer">
              <strong>Sua Empresa S.A.</strong><br>
              Rua Exemplo, 123 - São Paulo, SP<br>
              <div style="margin-top: 10px;">
                <a href="#" style="color: #007bff; text-decoration: none;">Suporte</a> | 
                <a href="#" style="color: #007bff; text-decoration: none;">Privacidade</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
