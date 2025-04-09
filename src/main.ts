import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:4200', // ou '*' para permitir qualquer origem
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Habilitar o ValidationPipe globalmente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove campos não definidos no DTO
      forbidNonWhitelisted: true, // Lança erro para campos não permitidos
      transform: true, // Transforma os dados para os tipos esperados no DTO
    }),
  );
  await app.listen(process.env.PORT ?? 3000);

  const allowedOrigins = [
    'http://localhost:4200',
    'https://seusite.com',
    'https://outrosite.com',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });
}

bootstrap();
