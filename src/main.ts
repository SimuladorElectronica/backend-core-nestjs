import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

/** Tags de Swagger, agrupados para no inflar `buildSwaggerConfig`. */
const SWAGGER_TAGS: Array<[string, string]> = [
  ['Auth', 'Registro e inicio de sesión con JWT'],
  [
    'Projects',
    'Guardado de esquemáticos en JSONB y enlaces de compartir (shareSlug)',
  ],
  ['Libraries', 'Librerías C++ curadas (lectura pública, escritura solo rol ADMIN)'],
  ['Users', 'Directorio de usuarios, promoción de roles y gestión de cuentas'],
  ['Guides', 'Guías didácticas (lectura pública, creación solo rol TEACHER)'],
  ['Submissions', 'Entregas de proyectos de alumnos a una guía (requiere sesión)'],
];

function configureCors(app: INestApplication) {
  // CORS: orígenes permitidos vía CORS_ORIGINS (lista separada por comas).
  // Sin la variable se refleja el origin solicitante (fallback de desarrollo),
  // para que el simulador y el dashboard puedan consumir los endpoints públicos.
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  });
}

function buildSwaggerConfig() {
  const builder = new DocumentBuilder()
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
    );

  for (const [name, description] of SWAGGER_TAGS) {
    builder.addTag(name, description);
  }

  return builder.build();
}

function configureSwagger(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup('api/docs', app, document);
}

function configureValidation(app: INestApplication) {
  // `transform` permite convertir los query params (?take=20) a number
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureCors(app);
  configureValidation(app);
  configureSwagger(app);

  await app.listen(3000);
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
