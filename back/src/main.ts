import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Prefix API to alinear con el frontend (`/api/*`)
  app.setGlobalPrefix('api');

  // Habilitar CORS para permitir peticiones desde el frontend SPA con cookies
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',').map((o) => o.trim()) || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-XSRF-Token', 'Authorization', 'X-Role'],
  });

  // Cookies (access/refresh/CSRF)
  app.use(cookieParser());

  // Servir archivos estáticos desde la carpeta uploads
  // En desarrollo: __dirname = back/src, necesitamos subir un nivel
  // En producción: __dirname = back/dist/src, necesitamos subir dos niveles
  // Usamos process.cwd() para obtener la raíz del proyecto (back/)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true }
  }));
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
