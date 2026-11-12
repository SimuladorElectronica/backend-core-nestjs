import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permite al frontend (Vite en localhost:5173+, verificado con Origin)
  // realizar peticiones con Authorization/Content-Type sin preflight bloqueado
  app.enableCors({
    origin: true, // refleja el origin solicitante (ej: http://localhost:5174)
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });

  // `transform` permite convertir los query params (?take=20) a number
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Simulador Web API')
    .setDescription(
      'Backend - Autenticación, proyectos de esquemáticos (JSONB + shareSlug), ' +
        'librerías C++ curadas, guías didácticas y entregas de alumnos',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Ingresa tu token JWT',
        in: 'header',
      },
      'bearer', // Este nombre debe coincidir con el utilizado en @ApiBearerAuth()
    )
    .addTag('Auth', 'Registro e inicio de sesión con JWT')
    .addTag(
      'Projects',
      'Guardado de esquemáticos en JSONB y enlaces de compartir (shareSlug)',
    )
    .addTag(
      'Libraries',
      'Librerías C++ curadas (lectura pública, escritura solo rol ADMIN)',
    )
    .addTag(
      'Users',
      'Directorio de usuarios, promoción de roles y gestión de cuentas',
    )
    .addTag(
      'Guides',
      'Guías didácticas (lectura pública, creación solo rol TEACHER)',
    )
    .addTag(
      'Submissions',
      'Entregas de proyectos de alumnos a una guía (requiere sesión)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}