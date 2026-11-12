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
 *   SEED_PASSWORD, SEED_TEACHER_EMAIL, SEED_STUDENT_EMAIL, SEED_ADMIN_EMAIL
 */
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const TEACHER_EMAIL = process.env.SEED_TEACHER_EMAIL ?? 'profe@demo.com';
const STUDENT_EMAIL = process.env.SEED_STUDENT_EMAIL ?? 'alumno@demo.com';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@demo.com';

/** Aula demo con el alumno inscripto y una guía de ejemplo */
const DEMO_CLASSROOM = '5to Año - Demo';
const DEMO_STARTER_TITLE = 'Proyecto plantilla - LED parpadeante';
const DEMO_TEMPLATE_TITLE = 'Proyecto plantilla - Divisor de tensión';
const DEMO_GUIDE_TITLE = 'Práctica 1 - LED parpadeante';
const DEMO_GUIDE_INSTRUCTIONS =
  'Conectá un LED al pin 13 con una resistencia de 220 Ω en serie. El LED debe parpadear: 1 segundo encendido, 1 segundo apagado.';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const randomCode = (length: number) => {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
};

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

const starterProjectData = (teacherId: string) => ({
  title: DEMO_STARTER_TITLE,
  description: 'Proyecto plantilla para la guía demo',
  circuitData: { components: [{ id: 'r1', type: 'resistor' }], wires: [] },
  code:
    'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n',
  isPublic: false,
  isTemplate: true,
  userId: teacherId,
  shareSlug: randomCode(6),
});

const publicTemplateData = (teacherId: string) => ({
  title: DEMO_TEMPLATE_TITLE,
  description: 'Divisor de tensión con dos resistencias (ejemplo de plantilla)',
  circuitData: {
    components: [
      { id: 'v1', type: 'vcc', x: 40, y: 80, value: 5 },
      { id: 'r1', type: 'resistor', x: 120, y: 80, value: 1000 },
      { id: 'r2', type: 'resistor', x: 200, y: 80, value: 1000 },
      { id: 'g1', type: 'gnd', x: 280, y: 80, value: 0 },
    ],
    wires: [
      { from: 'v1:+', to: 'r1:1' },
      { from: 'r1:2', to: 'r2:1' },
      { from: 'r2:2', to: 'g1:1' },
    ],
  },
  code: '// divisor de tensión: Vout = Vin * R2 / (R1 + R2)\n',
  isPublic: false,
  isTemplate: true,
  userId: teacherId,
  shareSlug: randomCode(6),
});

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

async function seedUsers() {
  console.log('Seedando usuarios de prueba...');

  await upsertUser(ADMIN_EMAIL, 'Administrador demo', Role.ADMIN);
  const teacher = await upsertUser(TEACHER_EMAIL, 'Docente demo', Role.TEACHER);
  const student = await upsertUser(STUDENT_EMAIL, 'Alumno demo', Role.STUDENT);

  return { teacher, student };
}

async function seedClassroom(teacherId: string, studentId: string) {
  console.log('Seedando aula demo...');

  let classroom = await prisma.classroom.findFirst({
    where: { teacherId, name: DEMO_CLASSROOM },
  });

  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: { name: DEMO_CLASSROOM, code: randomCode(6), teacherId },
    });
    console.log(`+ aula "${classroom.name}" (código: ${classroom.code})`);
  } else {
    console.log(`= aula "${classroom.name}" ya existe (código: ${classroom.code})`);
  }

  await prisma.classroomStudent.upsert({
    where: {
      classroomId_studentId: { classroomId: classroom.id, studentId },
    },
    update: {},
    create: { classroomId: classroom.id, studentId },
  });
  console.log(`+ alumno ${STUDENT_EMAIL} inscripto en el aula demo`);

  return classroom;
}

async function seedStarterProject(teacherId: string) {
  let starter = await prisma.project.findFirst({
    where: { userId: teacherId, title: DEMO_STARTER_TITLE },
  });

  if (!starter) {
    starter = await prisma.project.create({
      data: starterProjectData(teacherId),
    });
    console.log('+ proyecto plantilla demo');
  } else if (!starter.isTemplate) {
    starter = await prisma.project.update({
      where: { id: starter.id },
      data: { isTemplate: true },
    });
    console.log('= proyecto plantilla demo marcado como plantilla pública');
  }

  return starter;
}

async function seedPublicTemplate(teacherId: string) {
  console.log('Seedando plantilla pública extra del simulador...');

  let template = await prisma.project.findFirst({
    where: { userId: teacherId, title: DEMO_TEMPLATE_TITLE },
  });

  if (!template) {
    template = await prisma.project.create({
      data: publicTemplateData(teacherId),
    });
    console.log(`+ plantilla pública "${template.title}"`);
  } else if (!template.isTemplate) {
    template = await prisma.project.update({
      where: { id: template.id },
      data: { isTemplate: true },
    });
    console.log(`= plantilla pública "${template.title}" marcada`);
  }
}

async function seedGuide(
  teacherId: string,
  classroomId: string,
  starterProjectId: string,
) {
  console.log('Seedando guía demo...');

  const existingGuide = await prisma.guide.findFirst({
    where: { classroomId, title: DEMO_GUIDE_TITLE },
  });

  if (!existingGuide) {
    await prisma.guide.create({
      data: {
        title: DEMO_GUIDE_TITLE,
        instructions: DEMO_GUIDE_INSTRUCTIONS,
        starterProjectId,
        teacherId,
        classroomId,
      },
    });
    console.log('+ guía demo');
  } else {
    console.log('= guía demo ya existe');
  }
}

async function seedLibraries() {
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
}

function printSummary(classroom: { name: string; code: string }) {
  console.log('\nSeed completado.');
  console.log(`  Admin: ${ADMIN_EMAIL} / ${PASSWORD}`);
  console.log(`  Teacher: ${TEACHER_EMAIL} / ${PASSWORD}`);
  console.log(`  Student: ${STUDENT_EMAIL} / ${PASSWORD}`);
  console.log(`  Aula demo: "${DEMO_CLASSROOM}" · código: ${classroom.code}`);
}

async function main() {
  const { teacher, student } = await seedUsers();
  const classroom = await seedClassroom(teacher.id, student.id);
  const starter = await seedStarterProject(teacher.id);

  await seedPublicTemplate(teacher.id);
  await seedGuide(teacher.id, classroom.id, starter.id);
  await seedLibraries();

  printSummary(classroom);
}

main()
  .catch((error) => {
    console.error('Error durante el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
