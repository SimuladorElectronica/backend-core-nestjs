import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { AuthModule } from './auth/auth.module.js';
import { GuidesModule } from './guides/guides.module.js';
import { LibrariesModule } from './libraries/libraries.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { UsersModule } from './users/users.module.js';

/**
 * No levanta Nest: sólo garantiza que cada módulo compila sus imports y
 * providers (la wiring completa la valida main.spec.ts con el mock de
 * NestFactory).
 */
describe('app modules', () => {
  it.each([
    ['AppModule', AppModule],
    ['AuthModule', AuthModule],
    ['GuidesModule', GuidesModule],
    ['LibrariesModule', LibrariesModule],
    ['PrismaModule', PrismaModule],
    ['ProjectsModule', ProjectsModule],
    ['SubmissionsModule', SubmissionsModule],
    ['UsersModule', UsersModule],
  ])('%s es un módulo Nest válido', (_name, mod) => {
    const keys = ['imports', 'controllers', 'providers', 'exports'];
    const found = keys.some((k) => Reflect.getMetadata(k, mod) !== undefined);

    expect(found).toBe(true);
  });
});
