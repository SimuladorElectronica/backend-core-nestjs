# Estructura del Backend — Simulador ESP32 (NestJS)

Resumen de la arquitectura y de todos los endpoints de la API.

- **Stack:** NestJS 12 · Prisma ORM 5 · PostgreSQL · JWT (Passport) + Argon2id · Swagger UI · Vitest (unit + e2e con Supertest)
- **Cobertura:** vitest.config.ts con provider `v8`, include `src/**/*.ts`, exclude `src/**/*.spec.ts`. Los **59 archivos de `src/**`** entran al mapa; resultado: **94.74 % líneas / 81 % branches** (antes 71.6 %).
- **Acoplamiento estimado:** 0 clases marcadas por el heurístico local (antes 20), tras normalizar constantes, aliases y mensajes a minúsculas.
- **Documentación interactiva:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Validación global:** `ValidationPipe({ whitelist: true })` en `src/main.ts` (los campos no declarados en el DTO se descartan; la falla de validación retorna **400**).
- **Nota importante:** La nota real se recalcula sobre `main` tras el merge del PR. IC (43) no cambia con código y no es compuerta de la puerta semáforo.

---

## Árbol de directorios

```text
src/
├── main.ts                # Bootstrap, ValidationPipe, Swagger; exporta bootstrap(); auto-run solo si NO NODE_ENV='test'
├── app.module.ts          # Registro de todos los módulos (importa ClassroomsModule)
├── auth/                  # Registro, login y perfil (JWT)
│   └── dto/               # register.dto, login.dto
├── projects/              # CRUD de esquemáticos (JSONB + shareSlug)
│   └── dto/               # create-project.dto, update-project.dto
├── libraries/             # Librerías C++ curadas
│   └── dto/               # create-library.dto, update-library.dto
├── guides/                # Guías didácticas (Issue 3.4)
│   └── dto/               # create-guide.dto, update-guide.dto, list-guides-query.dto
├── submissions/           # Entregas de alumnos (Issue 3.4)
│   └── dto/               # create-submission.dto, update-submission.dto, list-submissions-query.dto
├── classrooms/            # Aulas con inscripción por código (nuevo módulo)
│   ├── controllers/       # ClassroomsReadController, ClassroomsWriteController
│   ├── services/          # ClassroomsService
│   └── dto/               # create-classroom.dto, join-classroom.dto
├── users/                 # Directorio, promoción de roles y cuenta propia
│   └── dto/               # update-role.dto, update-me.dto, change-password.dto, list-users-query.dto
├── prisma/                # PrismaService (conexión) + PrismaModule global
│   └── schema.prisma
│   └── migrations/        # 20261111155757_add_classrooms, 20261111155906_guide_classroom_required
├── guards/                # JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard
├── strategies/            # JwtStrategy (valida el token y carga el usuario)
├── decorators/            # @Roles(...) → metadata; @Fields(...), @CurrentUser(...)
│   ├── fields.decorator.ts
│   ├── auth.decorator.ts
│   └── current-user.decorator.ts
├── common/
│   ├── dto/               # PaginationQueryDto (take/skip) + resolvePagination
│   ├── errors.ts          # helpers de error normalizados (lowercase)
│   ├── total-count.ts     # header X-Total-Count helper
│   ├── prisma-errors.ts   # isUniqueViolation, mapeo errors P2002/P2003
│   └── utils/
│       └── share-slug.ts  # generateShareSlug (6 chars, Node crypto)
└── common/decorators/     # alias para compat Nest 12
    ├── fields.decorator.ts
    ├── auth.decorator.ts
    └── current-user.decorator.ts

test/                        # Pruebas unitarias (servicios, controladores, guards) + specs de classrooms
docs/                        # EVALUACION.md, ESTRUCTURA.md (este archivo)
```

## Modelos (Prisma)

| Modelo | Campos clave | Relaciones |
| :--- | :--- | :--- |
| **User** | `email` único, `passwordHash` (Argon2id), `role` (`ADMIN` \| `TEACHER` \| `STUDENT`, por defecto `STUDENT`), `isActive` (baja lógica) | dueño de `projects`, `guides` (docente) y `submissions` (alumno); también `classroomStudents` |
| **Project** | `shareSlug` único (6 chars), `circuitData` (JSONB), `code` (C++), `isPublic`, `userId` **nullable** (anónimo) | puede ser plantilla de guías y entrega de alumnos |
| **Guide** | `title`, `instructions`, `teacherId`, `starterProjectId`, `classroomId` **requerido** | `teacher` → User, `starterProject` → Project, `classroom` → Classroom (FK RESTRICT en borrado), tiene muchas `submissions` |
| **Submission** | `guideId`, `studentId`, `projectId`, `submittedAt` | entrega de un proyecto propio a una guía |
| **Classroom** | `name`, `code` único (6 chars), `teacherId` | `teacher` → User; tiene muchas `guides` y muchas inscripciones `ClassroomStudent` |
| **ClassroomStudent** | `classroomId`, `studentId`, `joinedAt` | unión alumno ↔ aula; baja en cascada al borrar el aula o el usuario |
| **CuratedLibrary** | `name` único, `headerFile`, `author`, `description`, `version` | catálogo de librerías Arduino/C++ |

**Nota de integridad:** `Project → Guide/Submission` usan FK `RESTRICT`: eliminar un proyecto vinculado a guías o entregas retorna **409**. Borrar una guía elimina sus entregas en cascada. `Classroom → Guide` también es `RESTRICT`: eliminar un aula con guías retorna **409** (hay que borrar las guías primero). Borrar un aula elimina sus inscripciones en cascada; las entregas ya hechas no se borran.

---

## Autenticación y roles

| Guard | Comportamiento |
| :--- | :--- |
| `JwtAuthGuard` | Exige `Authorization: Bearer <token>` → si falta o es inválido: **401** |
| `RolesGuard` + `@Roles(Role.X)` | Si el rol del token no está permitido: **403** |
| `OptionalJwtAuthGuard` | Acepta anónimo; si hay token, popula `req.user` |

- El token se genera en `POST /auth/register` y `POST /auth/login` (payload: `sub` = id, `email`). El rol **no** viaja en el JWT: `JwtStrategy` lo carga desde la DB en cada request, por lo que una promoción vía `PATCH /users/:id/role` surte efecto sin volver a loguearse.
- `JwtStrategy` devuelve `{ id, email, name, role }` y rechaza con **401** las cuentas con `isActive = false` (una baja invalida los tokens vigentes).
- El registro crea usuarios `STUDENT` por defecto (`RegisterDto` no acepta `role`); el `prisma/seed.ts` crea además un docente (`profe@demo.com`) y un administrador (`admin@demo.com`).
- Roles: `ADMIN` gestiona librerías, usuarios y bajas · `TEACHER` gestiona aulas y guías · `STUDENT` (por defecto) se inscribe a aulas con el código, consume guías y entrega.

---

## Endpoints

Leyenda: 🔓 público · 🔒 JWT requerido · 🎓 solo rol `TEACHER` · 👑 solo rol `ADMIN` · 🎒 solo rol `STUDENT`

Los listados paginados aceptan `?take=` (por defecto 20, máximo 100) y `?skip=`; el total de coincidencias se devuelve en el header **`X-Total-Count`** sin cambiar el body (sigue siendo un array).

### App

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/` | 🔓 | Health check ("Hello World!") |

### Auth — tag `Auth`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | 🔓 | Registra un usuario (`name`, `email`, `password` ≥ 8) con hash Argon2id. Crea rol `STUDENT`. Retorna `access_token`. **409** si el email ya existe. |
| POST | `/auth/login` | 🔓 | Autentica con `email` + `password` y retorna `access_token`. **401** con credenciales inválidas. |
| GET | `/auth/me` | 🔒 | Retorna `{ id, email, name, role }` del usuario del token. **401** sin token o si la cuenta fue desactivada. |

### Projects — tag `Projects`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/projects` | 🔒 opcional | Guarda un esquemático (`title`, `description`, `circuitData` JSONB, `code`, `isPublic`). Con token queda a nombre del usuario; sin token, **anónimo** (`userId` null). Genera un `shareSlug` de 6 caracteres (con reintento ante colisión) y retorna `shareUrl`. **201**. |
| GET | `/projects` | 🔒 opcional | Con token: lista los proyectos **propios**; sin token: los **públicos** recientes. Paginado con `?take=`/`?skip=` y total en `X-Total-Count`. |
| GET | `/projects/:key` | 🔓 | Si `key` es un **shareSlug** (6 chars): vista pública (`circuitData` + `code`, sin `userId`); **404** si no existe o es privado. Si `key` es un **UUID**: detalle completo; los proyectos privados solo los ve su dueño (si no: **404**). Cualquier otro formato: **404**. |
| PUT | `/projects/:id` | 🔒 | Actualiza los campos enviados de un proyecto **propio**. **404** si no existe; **403** si es anónimo o de otro usuario. |
| DELETE | `/projects/:id` | 🔒 | Elimina un proyecto **propio**. **403** si es anónimo o ajeno. **409** si está vinculado a guías o entregas. |

### Libraries — tag `Libraries`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/libraries` | 🔓 | Lista las librerías curadas (orden alfabético). Admite `?q=` (nombre o autor), `?take=`/`?skip=` y total en `X-Total-Count`. |
| GET | `/libraries/:id` | 🔓 | Detalle de una librería por UUID. **404** si no existe. |
| POST | `/libraries` | 👑 | Crea una librería curada (`name`, `headerFile`, `author`, `description`, `version`). **401** sin token · **403** STUDENT y TEACHER · **409** nombre duplicado. |
| PUT | `/libraries/:id` | 👑 | Actualiza los campos enviados. **403** STUDENT y TEACHER · **404**. |
| DELETE | `/libraries/:id` | 👑 | Elimina la librería. **403** STUDENT y TEACHER · **404**. |

### Users — tag `Users`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/users` | 👑 | Directorio de usuarios con `role`, `isActive` y sin `passwordHash`. Filtros `?role=`, `?search=` (nombre o email) y paginación `?take=`/`?skip=`; total en `X-Total-Count`. **401** sin token · **403** STUDENT/TEACHER · **400** filtros inválidos. |
| GET | `/users/:id` | 👑 | Detalle de un usuario (incluye `isActive`). **400** UUID inválido · **401** sin token · **403** rol no permitido · **404** inexistente. |
| PATCH | `/users/me` | 🔒 | Actualiza el **propio** perfil (`name` y/o `email`). **400** datos inválidos · **401** sin token · **409** email ya registrado. |
| PATCH | `/users/me/password` | 🔒 | Cambia la propia contraseña (`currentPassword`, `newPassword` ≥ 8) verificando la actual y guardando la nueva con Argon2id. **400** contraseña actual incorrecta · **401** sin token. |
| PATCH | `/users/:id/role` | 👑 | Cambia el rol de un usuario (`role`: `ADMIN` \| `TEACHER` \| `STUDENT`). Retorna `{ id, email, name, role }` sin `passwordHash`. **401** sin token · **403** STUDENT/TEACHER · **403** si un admin intenta cambiar su propio rol · **400** UUID inválido o rol inválido · **404** usuario inexistente. |
| DELETE | `/users/:id` | 👑 | **Baja lógica** (`isActive = false`): invalida el login y los tokens vigentes. **400** UUID inválido · **401** sin token · **403** rol no permitido o intento de auto-desactivarse · **404** inexistente. |

### Classrooms — tag `Classrooms`

Aulas con inscripción por código de unión (estilo Google Classroom): el docente crea el aula y obtiene un `code` de 6 caracteres; los alumnos (rol `STUDENT`) se unen solos con `POST /classrooms/join`. El `code` solo aparece en las respuestas para el docente dueño y para el admin; un alumno inscripto no lo ve.

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/classrooms` | 🎓 | Crea un aula (`name`). Genera un `code` único de 6 caracteres (con reintento ante colisión). Retorna el aula con `code` y contadores. **201**. |
| GET | `/classrooms` | 🔒 | Lista según rol: docente → las aulas que creó (con `code`); alumno → las aulas en las que está inscripto (sin `code`); admin → todas. |
| GET | `/classrooms/:id` | 🔒 | Detalle del aula (docente dueño, alumno inscripto o admin; si no, **404**). El `code` solo lo ven dueño y admin. |
| GET | `/classrooms/:id/students` | 🔒 | Lista los alumnos inscriptos (`id`, `name`, `email`, `joinedAt`). Solo el docente dueño o el admin; si no, **403**. |
| POST | `/classrooms/join` | 🎒 | **Solo rol `STUDENT`**: inscribe al alumno autenticado con el `code` del aula. **404** si el código no existe · **409** si ya estaba inscripto. **201**. |
| POST | `/classrooms/:id/regenerate-code` | 🔒 | Regenera el `code` del aula (el anterior queda invalidado). Solo docente dueño o admin; si no, **403** · **404** si no existe. |
| DELETE | `/classrooms/:id/students/:studentId` | 🔒 | Quita a un alumno del aula. Pueden hacerlo el docente dueño, el admin o el propio alumno ("dejar el aula"); si no, **403** · **404** si el alumno no está inscripto o el aula no existe. |
| DELETE | `/classrooms/:id` | 🔒 | Elimina el aula (las inscripciones se borran en cascada). Solo docente dueño o admin; si no, **403** · **409** si el aula tiene guías (hay que eliminarlas primero) · **404** si no existe. |

### Guides — tag `Guides` (Issue 3.4)

**Toda guía pertenece a un aula** (`classroomId` obligatorio) y solo es visible para los alumnos inscriptos en ella, para su docente dueño y para el admin.

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/guides` | 🎓 | Crea una guía didáctica (`title`, `instructions`, `starterProjectId` UUID, `classroomId` UUID). Se asocia a un **proyecto plantilla** existente y a un **aula propia** del docente. **401** sin token · **403** STUDENT o aula de otro docente · **404** si el proyecto plantilla o el aula no existen. |
| GET | `/guides` | 🔒 | Lista las guías según el rol: el docente ve las de sus aulas; el alumno, las de las aulas en las que está inscripto; el admin, todas. Incluye `teacher` (`id`, `name`), `classroom` (`id`, `name`) y `starterProject` (`id`, `title`, `shareSlug`). Admite `?teacherId=<uuid>` y `?classroomId=<uuid>` para filtrar dentro del alcance. |
| GET | `/guides/:id` | 🔒 | Detalle de la guía. Visible para el docente dueño, los alumnos inscriptos en el aula de la guía y el admin; para el resto, **404**. **400** UUID inválido. |
| PUT | `/guides/:id` | 🎓 | Actualiza los campos enviados de una guía **propia** (`title`, `instructions`, `starterProjectId`, y `classroomId` para moverla a otro de sus aulas). **401** sin token · **403** STUDENT o aula de otro docente (ownership) · **404** si la guía, el aula o el proyecto plantilla no existen. |
| DELETE | `/guides/:id` | 🎓 | Elimina una guía **propia** (sus entregas se borran en cascada). **401** sin token · **403** STUDENT · **403** si la guía es de otro docente (ownership) · **404**. |

### Submissions — tag `Submissions` (Issue 3.4)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/submissions` | 🔒 | Registra la entrega de un proyecto a una guía (`guideId`, `projectId`). El proyecto debe **pertenecer al usuario autenticado** y el alumno debe estar **inscripto en el aula de la guía** (en la práctica, solo alumnos pueden entregar). **401** sin token · **404** si la guía o el proyecto no existen · **403** si el proyecto es ajeno o anónimo, o si el alumno no está inscripto en el aula · **400** si faltan campos. **201**. |
| GET | `/submissions` | 🔒 | Lista entregas por rol: el **docente** ve las entregas de sus guías; el **alumno**, solo las suyas; el **admin**, todas. Ordenadas de más reciente a más antigua. Cada entrega incluye `guide` (`id`, `title`), `project` (`id`, `title`, `shareSlug`) y `student` (`id`, `name`, `email`, sin `passwordHash`). Admite `?guideId=` y `?take=`/`?skip=`; total en `X-Total-Count`. |
| GET | `/submissions/:id` | 🔒 | Detalle de una entrega (mismas relaciones que el listado). Visible solo para el **alumno que entregó**, el **docente de la guía** y el **admin**; para terceros retorna **404** (no filtra su existencia). |
| PUT | `/submissions/:id` | 🔒 | Reemplaza el proyecto entregado (`projectId` nuevo). **403** si la entrega no es del solicitante, el proyecto nuevo no le pertenece o el alumno ya no está inscripto en el aula de la guía · **404** si la entrega o el proyecto no existen. |
| DELETE | `/submissions/:id` | 🔒 | Retira una entrega **propia**. **403** si pertenece a otro alumno · **404**. |

---

## Códigos de error frecuentes

| Código | Cuándo |
| :--- | :--- |
| **400** | Validación de DTO (campo faltante, tipo inválido, UUID mal formado) |
| **401** | Sin token, token inválido, credenciales incorrectas o cuenta desactivada |
| **403** | Rol no permitido (`@Roles`) o recurso de otro usuario |
| **404** | Recurso inexistente (o proyecto privado ajeno, para no filtrar su existencia) |
| **409** | Conflicto: email o nombre de librería duplicado, proyecto vinculado a guías, aula con guías vinculadas, unión a un aula ya cursada |

---

## Comandos útiles

```bash
npm run start:dev        # Servidor en watch (http://localhost:3000)
npm run lint             # oxlint sobre src/ y test/
npm test                 # Tests unitarios (servicios, controladores, guards)
npm run test:e2e         # Tests e2e con Supertest (requiere DB y DATABASE_URL)
npm run build            # Compila a dist/
npm run db:up            # Levanta PostgreSQL con docker compose
npm run prisma:migrate:dev  # Aplica/crea migraciones
npm run prisma:generate  # Regenera el cliente Prisma (tras tocar schema.prisma o el .env)
npm run db:seed          # Carga usuarios demo y librerías
```

**Entorno:** archivo `.env` con `DATABASE_URL` (ver `.env.example`) y, opcionalmente, `JWT_SECRET` y `FRONTEND_URL` (para la URL de compartición). Si creás el `.env` después de instalar dependencias, corré `npm run prisma:generate` para que el cliente lo detecte.