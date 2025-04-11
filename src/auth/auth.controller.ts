import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login-cliente')
  async loginCliente(@Body() body: { email: string; password: string }) {
    const cliente = await this.authService.validateCliente(
      body.email,
      body.password,
    );
    return this.authService.loginCliente(cliente);
  }

  @Post('login-prestador')
  async loginPrestador(@Body() body: { email: string; password: string }) {
    const prestador = await this.authService.validatePrestador(
      body.email,
      body.password,
    );
    return this.authService.loginPrestador(prestador);
  }
}
