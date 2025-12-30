import 'crypto'; // Apenas para garantir
if (!global.crypto) {
  global.crypto = require('crypto');
}
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // Especificamos o tipo NestExpressApplication para acessar o Express subjacente
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configura trust proxy para obter IP real do cliente
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: isDev
      ? [
          'http://localhost:4200',
          'http://localhost:3000',
          'http://localhost:3001',
        ]
      : ['https://use-tudu.com.br', 'https://professional.use-tudu.com.br'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}

bootstrap();
