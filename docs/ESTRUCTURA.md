# Estructura del Backend — Simulador ESP32 (NestJS)

Resumen de la arquitectura y de todos los endpoints de la API.

- **Stack:** NestJS 12 · Prisma ORM 5 · PostgreSQL · JWT (Passport) + Argon2id · Swagger UI · Vitest (unit + e2e con Supertest)
- **Documentación interactiva:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Validación global:** `ValidationPipe({ whitelist: true })` en `src/main.ts` (los campos no declarados en el DTO se descartan; la falla de validación retorna **400**).

---

## Árbol de directorios

```
src/
├── main.ts                  # Bootstrap, ValidationPipe, documento Swagger (/api/docs)
├── app.module.ts            # Registro de todos los módulos
├── auth/                    # Registro, login y perfil (JWT)
│   └── dto/                 # register.dto, login.dto
├── projects/                # CRUD de esquemáticos (JSONB + shareSlug)
│   └── dto/                 # create-project.dto, update-project.dto
├── libraries/               # Librerías C++ curadas
│   └── dto/                 # create-library.dto, update-library.dto
├── guides/                  # Guías didácticas (Issue 3.4)
│   └── dto/                 # create-guide.dto
├── submissions/             # Entregas de alumnos (Issue 3.4)
│   └── dto/                 # create-submission.dto
├── users/                   # Promoción de roles (solo ADMIN)
│   └── dto/                 # update-role.dto
├── prisma/                  # PrismaService (conexión) + PrismaModule global
├── guards/                  # JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard
├── strategies/              # JwtStrategy (valida el token y carga el usuario)
├── decorators/              # @Roles(...) → metadata para RolesGuard
└── common/utils/            # generateShareSlug (slugs de 6 caracteres)

prisma/
├── schema.prisma            # Modelos y enums
├── seed.ts                  # Usuarios demo (ADMIN/TEACHER/STUDENT) + librerías
└── migrations/              # Migraciones de PostgreSQL

test/                        # Pruebas e2e (Supertest contra la DB real)
docs/                        # EVALUACION.md, ESTRUCTURA.md (este archivo)
```

---

## Modelos (Prisma)

| Modelo | Campos clave | Relaciones |
| :--- | :--- | :--- |
| **User** | `email` único, `passwordHash` (Argon2id), `role` (`ADMIN` \| `TEACHER` \| `STUDENT`, por defecto `STUDENT`) | dueño de `projects`, `guides` (docente) y `submissions` (alumno) |
| **Project** | `shareSlug` único (6 chars, enlace público), `circuitData` (JSONB), `code` (C++), `isPublic`, `userId` **nullable** (permite guardado anónimo) | puede ser plantilla de guías y entrega de alumnos |
| **Guide** | `title`, `instructions`, `teacherId`, `starterProjectId` | `teacher` → User, `starterProject` → Project, tiene muchas `submissions` |
| **Submission** | `guideId`, `studentId`, `projectId`, `submittedAt` | entrega de un proyecto propio a una guía |
| **CuratedLibrary** | `name` único, `headerFile`, `author`, `description`, `version` | catálogo de librerías Arduino/C++ |

**Nota de integridad:** `Project` → `Guide`/`Submission` usan FK `RESTRICT`: eliminar un proyecto vinculado a guías o entregas retorna **409**. Borrar una guía elimina sus entregas en cascada.

---

## Autenticación y roles

| Guard | Comportamiento |
| :--- | :--- |
| `JwtAuthGuard` | Exige `Authorization: Bearer <token>` → si falta o es inválido: **401** |
| `RolesGuard` + `@Roles(Role.X)` | Si el rol del token no está permitido: **403** |
| `OptionalJwtAuthGuard` | Acepta anónimo; si hay token, popula `req.user` |

- El token se genera en `POST /auth/register` y `POST /auth/login` (payload: `sub` = id, `email`). El rol **no** viaja en el JWT: `JwtStrategy` lo carga desde la DB en cada request, por lo que una promoción vía `PATCH /users/:id/role` surte efecto sin volver a loguearse.
- El registro crea usuarios `STUDENT` por defecto (`RegisterDto` no acepta `role`; con `ValidationPipe({ whitelist: true })` el campo se descarta); el `prisma/seed.ts` crea además un docente (`profe@demo.com`) y un administrador (`admin@demo.com`).
- Roles: `ADMIN` gestiona librerías y promueve usuarios · `TEACHER` gestiona guías · `STUDENT` (por defecto) solo consume y entrega.

---

## Endpoints

Leyenda: 🔓 público · 🔒 JWT requerido · 🎓 solo rol `TEACHER` · 👑 solo rol `ADMIN`

### App

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/` | 🔓 | Health check ("Hello World!") |

### Auth — tag `Auth`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | 🔓 | Registra un usuario (`name`, `email`, `password` ≥ 8) con hash Argon2id. Crea rol `STUDENT`. Retorna `access_token`. **409** si el email ya existe. |
| POST | `/auth/login` | 🔓 | Autentica con `email` + `password` y retorna `access_token`. **401** con credenciales inválidas. |
| GET | `/auth/me` | 🔒 | Retorna `{ id, email, role }` del usuario del token. **401** sin token. |

### Projects — tag `Projects`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/projects` | 🔒 opcional | Guarda un esquemático (`title`, `description`, `circuitData` JSONB, `code`, `isPublic`). Con token queda a nombre del usuario; sin token, **anónimo** (`userId` null). Genera un `shareSlug` de 6 caracteres (con reintento ante colisión) y retorna `shareUrl`. **201**. |
| GET | `/projects` | 🔒 opcional | Con token: lista hasta 20 proyectos **propios** (más recientes primero). Sin token: lista los **públicos** recientes. |
| GET | `/projects/:key` | 🔓 | Si `key` es un **shareSlug** (6 chars): retorna la vista pública (`circuitData` + `code`, sin `userId`); **404** si no existe o es privado. Si `key` es un **UUID**: detalle completo; los proyectos privados solo los ve su dueño (si no: **404**). Cualquier otro formato: **404**. |
| PUT | `/projects/:id` | 🔒 | Actualiza los campos enviados de un proyecto **propio**. **404** si no existe; **403** si es anónimo o de otro usuario. |
| DELETE | `/projects/:id` | 🔒 | Elimina un proyecto **propio**. **403** si es anónimo o ajeno. **409** si está vinculado a guías o entregas. |

### Libraries — tag `Libraries`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| GET | `/libraries` | 🔓 | Lista todas las librerías curadas (orden alfabético). |
| GET | `/libraries/:id` | 🔓 | Detalle de una librería por UUID. **404** si no existe. |
| POST | `/libraries` | 👑 | Crea una librería curada (`name`, `headerFile`, `author`, `description`, `version`). **401** sin token · **403** STUDENT y TEACHER · **409** nombre duplicado. |
| PUT | `/libraries/:id` | 👑 | Actualiza los campos enviados. **403** STUDENT y TEACHER · **404**. |
| DELETE | `/libraries/:id` | 👑 | Elimina la librería. **403** STUDENT y TEACHER · **404**. |

### Users — tag `Users`

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| PATCH | `/users/:id/role` | 👑 | Cambia el rol de un usuario (`role`: `ADMIN` \| `TEACHER` \| `STUDENT`). Retorna `{ id, email, name, role }` sin `passwordHash`. **401** sin token · **403** STUDENT/TEACHER · **403** si un admin intenta cambiar su propio rol · **400** UUID inválido o rol inválido · **404** usuario inexistente. |

### Guides — tag `Guides` (Issue 3.4)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/guides` | 🎓 | Crea una guía didáctica (`title`, `instructions`, `starterProjectId` UUID). Se asocia al docente del token y a un **proyecto plantilla** existente. **401** sin token · **403** STUDENT (criterio de aceptación) · **404** si el proyecto plantilla no existe · **400** si faltan campos o el UUID es inválido. |
| GET | `/guides` | 🔓 | Lista las guías de más reciente a más antigua, incluyendo `teacher` (`id`, `name`) y `starterProject` (`id`, `title`, `shareSlug`). |
| GET | `/guides/:id` | 🔓 | Detalle de la guía con instrucciones, docente y proyecto plantilla. **400** UUID inválido · **404** inexistente. |
| PUT | `/guides/:id` | 🎓 | Actualiza los campos enviados de una guía **propia** (`title`, `instructions`, `starterProjectId`). **401** sin token · **403** STUDENT · **403** si la guía es de otro docente (ownership) · **404** si la guía o el nuevo proyecto plantilla no existen. |
| DELETE | `/guides/:id` | 🎓 | Elimina una guía **propia** (sus entregas se borran en cascada). **401** sin token · **403** STUDENT · **403** si la guía es de otro docente (ownership) · **404**. |

### Submissions — tag `Submissions` (Issue 3.4)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| POST | `/submissions` | 🔒 | Registra la entrega de un proyecto a una guía (`guideId`, `projectId`). El proyecto debe **pertenecer al usuario autenticado**. **401** sin token · **404** si la guía o el proyecto no existen · **403** si el proyecto es ajeno o anónimo · **400** si faltan campos. **201**. |
| GET | `/submissions` | 🔒 | Lista entregas por rol: el **docente** ve las entregas de sus guías; el **alumno**, solo las suyas. Ordenadas de más reciente a más antigua. |
| GET | `/submissions/:id` | 🔒 | Detalle de una entrega. Visible solo para el **alumno que entregó** y para el **docente de la guía**; para terceros retorna **404** (no filtra su existencia). |
| PUT | `/submissions/:id` | 🔒 | Reemplaza el proyecto entregado (`projectId` nuevo). **403** si la entrega no es del solicitante o el proyecto nuevo no le pertenece · **404** si la entrega o el proyecto no existen. |
| DELETE | `/submissions/:id` | 🔒 | Retira una entrega **propia**. **403** si pertenece a otro alumno · **404**. |

---

## Códigos de error frecuentes

| Código | Cuándo |
| :--- | :--- |
| **400** | Validación de DTO (campo faltante, tipo inválido, UUID mal formado) |
| **401** | Sin token, token inválido o credenciales incorrectas |
| **403** | Rol no permitido (`@Roles`) o recurso de otro usuario |
| **404** | Recurso inexistente (o proyecto privado ajeno, para no filtrar su existencia) |
| **409** | Conflicto: email o nombre de librería duplicado, proyecto vinculado a guías |

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

**Requisitos de entorno:** archivo `.env` con `DATABASE_URL` (ver `.env.example`) y, opcionalmente, `JWT_SECRET` y `FRONTEND_URL` (para la URL de compartición). Si creás el `.env` después de instalar dependencias, corré `npm run prisma:generate` para que el cliente lo detecte.
