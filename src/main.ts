import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet'; // Note a mudança na importação

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuração de segurança - agora helmet é chamado diretamente
  app.use(helmet());

  // Restante do seu código permanece o mesmo...
  app.enableCors({
    origin: [
      'https://use-tudu.com.br',
      'https://www.use-tudu.com.br',
      'https://admin.use-tudu.com.br',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Authorization', 'X-Total-Count'],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://use-tudu.com.br');
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS',
    );
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
bootstrap();
