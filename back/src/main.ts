import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  // 1) TODAS LAS RUTAS DE API CON PREFIJO /api
  app.setGlobalPrefix('api');

  const rootPath = process.cwd();
  const uploadsPath = join(rootPath, 'uploads');
  const clientPath = join(rootPath, 'public');

  // Servir archivos subidos
  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  // Servir Frontend Angular (estáticos)
  app.useStaticAssets(clientPath);

  // Detectar archivo de entrada del frontend (Angular SSR/CSR)
  const indexCsrPath = join(clientPath, 'index.csr.html');
  const indexHtmlPath = join(clientPath, 'index.html');
  const indexToServe = existsSync(indexCsrPath) ? indexCsrPath : indexHtmlPath;

  // 2) Fallback para SPA Angular
  app.use((req, res, next) => {
    const url = req.url;

    // No interceptar API ni uploads
    if (url.startsWith('/api') || url.startsWith('/uploads')) return next();

    // Solo GET debe servir Angular (POST/PUT/DELETE → backend)
    if (req.method !== 'GET') return next();

    // Si por alguna razón no existe ningún index, deja pasar (te mostrará 404 real)
    if (!existsSync(indexToServe)) return next();

    return res.sendFile(indexToServe);
  });

  // Validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();
