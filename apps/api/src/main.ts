import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded, type Response } from 'express';
import type { IncomingMessage } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  const rawBodySaver = (
    req: IncomingMessage & { rawBody?: Buffer },
    _res: Response,
    buf: Buffer,
  ) => {
    if (Buffer.isBuffer(buf) && buf.length) {
      req.rawBody = buf;
    }
  };

  app.use(json({ verify: rawBodySaver, limit: '2mb' }));
  app.use(urlencoded({ verify: rawBodySaver, extended: true, limit: '2mb' }));
  app.use(helmet());
  app.use(cookieParser());

  // Behind Nginx/Caddy/Render: trust X-Forwarded-* so req.ip / secure cookies work.
  // TRUST_PROXY=1 (hop count) or true → enable; unset/false → leave Express default.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy && trustProxy !== '0' && trustProxy !== 'false') {
    const hops = Number(trustProxy);
    app.getHttpAdapter().getInstance().set(
      'trust proxy',
      Number.isFinite(hops) && hops > 0 ? hops : 1,
    );
  }

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
