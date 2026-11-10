import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
bootstrap();