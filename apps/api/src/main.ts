import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(',') ?? [
      'http://localhost:3100',
      'http://127.0.0.1:3100',
      'http://localhost:8180',
    ],
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/ready', 'health/live'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4100);
  await app.listen(port, '0.0.0.0');
  console.log(`LogIT API listening on 0.0.0.0:${port}`);
}

bootstrap();
