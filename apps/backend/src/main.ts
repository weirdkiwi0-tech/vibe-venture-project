import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';

const REQUEST_BODY_LIMIT = '50mb';

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

  const isAllowedOrigin = (origin: string | undefined) => {
    if (!origin) {
      return true;
    }

    return staticAllowedOrigins.has(origin) || isLikelyContainerAppOrigin(origin);
  };

  // Base64 첨부파일이 포함된 요청(질문/답변/영상 등록) 수용을 위해 body parser 한도를 상향합니다.
  app.use(json({ limit: REQUEST_BODY_LIMIT }));
  app.use(urlencoded({ limit: REQUEST_BODY_LIMIT, extended: true }));

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      (error as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({ message: 'video payload too large' });
      return;
    }

    next(error);
  });

  app.use(cookieParser());

  // Some ingress paths omit Access-Control-Allow-Credentials on OPTIONS responses.
  // Ensure credentialed auth/signup requests always receive the required CORS headers.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowed = typeof origin === 'string' && isAllowedOrigin(origin);

    if (allowed && origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      if (!allowed) {
        res.status(403).send('CORS blocked');
        return;
      }

      const reqMethods = req.headers['access-control-request-method'];
      const reqHeaders = req.headers['access-control-request-headers'];
      res.header('Access-Control-Allow-Methods', typeof reqMethods === 'string' ? reqMethods : 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      if (typeof reqHeaders === 'string' && reqHeaders.length > 0) {
        res.header('Access-Control-Allow-Headers', reqHeaders);
      }
      res.status(204).send();
      return;
    }

    next();
  });

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedOrigin(origin)) {
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

  if (process.env.DEV_SEED_ADMIN === 'true' && !process.env.AZURE_TABLES_CONNECTION_STRING) {
    const email = process.env.DEV_ADMIN_EMAIL ?? 'admin@keepit.dev';
    const password = process.env.DEV_ADMIN_PASSWORD ?? 'admin1234';
    const displayName = process.env.DEV_ADMIN_DISPLAY_NAME ?? '운영자';
    try {
      const authService = app.get(AuthService);
      await authService.signUpLocal({ email, password, displayName });
    } catch {
      // Dev admin already exists on restart
    }
  }
}

void bootstrap();
