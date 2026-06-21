import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredFrontend = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';
  const staticAllowedOrigins = new Set([
    configuredFrontend,
    'http://localhost:3000',
    'http://localhost:3003',
  ]);

  const isLikelyContainerAppOrigin = (origin: string) => {
    try {
      const { hostname } = new URL(origin);
      return hostname.endsWith('.azurecontainerapps.io') || hostname.endsWith('.azurecontainer.io');
    } catch {
      return false;
    }
  };

  // Base64 첨부파일이 포함된 요청(질문/답변 등록) 수용을 위해 body parser 한도를 상향합니다.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.use(cookieParser());

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || staticAllowedOrigins.has(origin) || isLikelyContainerAppOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('KeepIt API')
    .setDescription('KeepIt backend API documentation')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
