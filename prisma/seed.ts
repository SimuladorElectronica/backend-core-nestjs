/**
 * Seed de la base de datos.
 *
 * Uso:
 *   npm run db:seed          (equivale a `npx prisma db seed`)
 *
 * Es idempotente: se puede ejecutar tantas veces como haga falta sin
 * duplicar usuarios ni librerías (los existentes no se modifican).
 *
 * Variables de entorno opcionales:
 *   SEED_PASSWORD, SEED_TEACHER_EMAIL, SEED_STUDENT_EMAIL
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const TEACHER_EMAIL = process.env.SEED_TEACHER_EMAIL ?? 'profe@demo.com';
const STUDENT_EMAIL = process.env.SEED_STUDENT_EMAIL ?? 'alumno@demo.com';

/** Ejemplos de la biblioteca curada (gestión manual desde POST /libraries) */
const LIBRARIES = [
  {
    name: 'LiquidCrystal_I2C',
    headerFile: 'LiquidCrystal_I2C.h',
    author: 'Marcos Breuer',
    description: 'Pantallas LCD con interface I2C (PCF8574)',
    version: '1.1.2',
  },
  {
    name: 'Servo',
    headerFile: 'Servo.h',
    author: 'Arduino',
    description: 'Control de servomotores de 180° y 360°',
    version: '1.0.0',
  },
  {
    name: 'DHT',
    headerFile: 'DHT.h',
    author: 'Adafruit',
    description: 'Sensores de temperatura y humedad DHT11/DHT22',
    version: '1.4.6',
  },
];

async function upsertUser(email: string, name: string, role: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`= ${role} ${email} ya existe, se omite`);
    return existing;
  }

  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
  });

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash },
  });

  console.log(`+ ${role} ${email} creado`);
  return user;
}

async function main() {
  console.log('Seedando usuarios de prueba...');

  await upsertUser(TEACHER_EMAIL, 'Docente demo', Role.TEACHER);
  await upsertUser(STUDENT_EMAIL, 'Alumno demo', Role.STUDENT);

  console.log('Seedando librerías curadas...');
  for (const library of LIBRARIES) {
    const existing = await prisma.curatedLibrary.findUnique({
      where: { name: library.name },
    });

    await prisma.curatedLibrary.upsert({
      where: { name: library.name },
      update: {},
      create: library,
    });
    console.log(
      `${existing ? '=' : '+'} librería ${library.name}${existing ? ' ya existe, se omite' : ''}`,
    );
  }

  console.log('\nSeed completado.');
  console.log(`  Teacher: ${TEACHER_EMAIL} / ${PASSWORD}`);
  console.log(`  Student: ${STUDENT_EMAIL} / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Error durante el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
