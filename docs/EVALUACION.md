<!-- evaluacion:inicio -->
# Evaluación — SimuladorElectronica/backend-core-nestjs

> Documento **generado automáticamente** por la cátedra de Programación III (RepoSense + análisis de calidad + constancia). **No editar a mano**: se regenera en cada evaluación.
> Rama evaluada: `main`. Análisis **heurístico** (regex + métricas): es una criba para orientar la revisión, **no una nota**.
> Generado: 2026-11-06.

## 1. Veredicto

| Aspecto | Resultado |
|---|---|
| Tipo de proyecto | backend |
| Índice de calidad de servicios | **65/100** (mínimo 50) |
| Criterios cumplidos | **11/15** |
| Aprobado (semáforo) | **NO** |
| Código (LOC) | 270 |
| Archivos de código | 15 |
| Tests (archivos) | 2 |
| Cobertura de líneas | 11.7% (mínimo 80%) |
| Capas detectadas | ninguna |
| Pushes directos a `main` (sin PR) | 0 |

> **Aprobado** exige las compuertas críticas (**SEC**, **SQL**, **capas**, **índice ≥ 50** y **cobertura ≥ 80 %** cuando aplica) y tolera hasta **3 criterios en rojo** (12/15). No es una nota: sirve para ordenar y priorizar la revisión.

## 2. Autoría (RepoSense)

| Autor | Commits | Código (LOC) | Tests (LOC) | Docs (LOC) | Días activos | % del código |
|---|---:|---:|---:|---:|---:|---:|
| IvoGiovarruscio | 3 | 432 | 22 | 43 | 4 | 100% |

> _El LOC de autoría lo calcula RepoSense sobre el historial y puede diferir del LOC de código del análisis de calidad (que mira solo el estado de `main`)._

## 3. Constancia (IC) — todas las ramas

> El IC mide **cuándo** se trabajó (sesiones por semana, pausas y recencia), no cuánto ni con qué calidad. Se calcula sobre **todas las ramas** de todos los repositorios del alumno, no sólo `main`.

| Alumno | Sesiones | Cumplimiento | Pausa | Recencia | IC | Nivel | Para subir de nivel |
|---|--:|--:|--:|--:|--:|--|--|
| IvoGiovarruscio | 8 | 35% | 14 d | 43% | **29** | No aprueba | Cumplimiento 35% (mín. 50%); Recencia 43% (mín. 50%) |

> Para aprobar el IC: **2 sesiones por semana** sostenidas, sin pausas mayores a **10 días** y con actividad en las **últimas 2 semanas**. Se excluyen merges, bots y al docente. Zona horaria UTC-3.

## 4. Aspectos evaluados

Cada aspecto indica **qué mide**, **por qué importa** y **tu resultado**. Cuando el resultado está en rojo, se agregan preguntas para **investigar la causa** (no hay recetas: entender el porqué es parte de la evaluación).

### 1. Índice de calidad de servicios (indice) — OK

- **Qué mide:** Un resumen numérico (0-100) que combina todas las señales y métricas del análisis, con topes duros por duplicación.
- **Por qué importa:** Ordena y prioriza la revisión: un índice bajo indica varias señales que conviene mirar juntas.
- **Tu resultado:** índice **65/100** _(mínimo 50)_

### 2. Duplicación (DRY) (duplicacion) — OK

- **Qué mide:** Porcentaje de bloques de código repetidos (similitud) en el repositorio.
- **Por qué importa:** Cada copia se mantiene por separado: un arreglo hay que repetirlo y los defectos se multiplican.
- **Tu resultado:** **7.6%** de duplicación _(máximo 15%)_

### 3. Secretos hardcodeados (SEC) — OK

- **Qué mide:** Credenciales, tokens o claves escritos directamente en el código en vez de leerse de variables de entorno.
- **Por qué importa:** Un secreto en el repositorio queda expuesto en el historial aunque luego se borre, y compromete al servicio y a sus usuarios.
- **Tu resultado:** **0** secreto(s) hardcodeado(s) _(máximo 0)_

### 4. Consultas SQL por concatenación (SQL) — OK

- **Qué mide:** Consultas SQL armadas concatenando o interpolando valores en vez de usar parámetros.
- **Por qué importa:** Es la puerta clásica a inyección: un valor que llega de afuera puede cambiar la consulta.
- **Tu resultado:** **0** consulta(s) SQL por concatenación _(máximo 0)_

### 5. Separación en capas (capas) — A REVISAR

- **Qué mide:** Si el código está separado en capas reconocibles (backend: presentación / lógica / datos; frontend: vistas / servicios / estado).
- **Por qué importa:** Sin separación, cada archivo hace de todo y cualquier cambio toca varios lugares a la vez.
- **Tu resultado:** **0** capa(s) detectada(s): ninguna _(mínimo 2 capas (a partir de 150 LOC))_
- **Para investigar la causa:**
    - ¿Se definió una arquitectura (carpetas y responsabilidades) antes de codificar, o se creó sobre la marcha?
    - ¿Hay archivos que resuelven varias cosas a la vez (ruta + lógica + acceso a datos en el mismo lugar)?
    - ¿La estructura de carpetas la propuso alguien y el resto la respetó?

### 6. Acceso a datos dentro del componente (HTTP) — OK

- **Qué mide:** Llamadas `fetch`/`axios` dentro de componentes de UI en vez de una capa de servicios/API.
- **Por qué importa:** Duplica la lógica de acceso a datos y acopla la vista al backend: un cambio de API toca muchos componentes.
- **Tu resultado:** **0** llamada(s) a la API dentro de componente(s) _(máximo 0)_

### 7. Depuración olvidada (DBG) — OK

- **Qué mide:** Mensajes de depuración olvidados (`console.log`, `print`, `debugger`).
- **Por qué importa:** Generan ruido en los registros, pueden filtrar datos y dan sensación de código sin terminar.
- **Tu resultado:** **0** mensaje(s) de depuración olvidado(s) _(máximo 0)_

### 8. Uso del tipo `any` (Any) — OK

- **Qué mide:** Uso de `any` en TypeScript, que desactiva la verificación de tipos.
- **Por qué importa:** Se pierde la ayuda del compilador justo donde los datos vienen de afuera (API, formularios).
- **Tu resultado:** **0** uso(s) de `any` _(máximo 2)_

### 9. Componente demasiado grande (BigC) — OK

- **Qué mide:** Componentes de UI muy extensos, que suelen mezclar render, estado y lógica.
- **Por qué importa:** Son difíciles de leer, probar y reutilizar, y sus cambios tienen efectos inesperados.
- **Tu resultado:** **0** componente(s) demasiado grande(s) _(máximo 1)_

### 10. Baja cohesión (Coh) — OK

- **Qué mide:** Una clase o unidad cuyos métodos y campos no están relacionados entre sí.
- **Por qué importa:** Una unidad que cambia por motivos distintos es frágil y cuesta entenderla.
- **Tu resultado:** **0** unidad(es) con baja cohesión _(máximo 0)_

### 11. Complejidad alta (Compl) — OK

- **Qué mide:** Complejidad ciclomática: cantidad de caminos posibles dentro de una función (condicionales, bucles, casos).
- **Por qué importa:** Muchos caminos = difícil de seguir y de probar; suelen esconderse casos sin cubrir.
- **Tu resultado:** **0** bloque(s) de complejidad alta _(máximo 5 por 1000 LOC (tenés 270 LOC))_

### 12. Funciones/métodos largos o con muchos parámetros (Tam) — OK

- **Qué mide:** Tamaño de las funciones/métodos y cantidad de parámetros.
- **Por qué importa:** Una función que hace varias cosas cuesta leerla, nombrarla y reutilizarla.
- **Tu resultado:** **0** función/método(s) largos o con muchos parámetros _(máximo 10 por 1000 LOC)_

### 13. Acoplamiento alto (Acop) — A REVISAR

- **Qué mide:** Cuánto depende una unidad de las partes internas de otra.
- **Por qué importa:** Piezas muy enlazadas hacen que un cambio se propague y que sea difícil reemplazar partes.
- **Tu resultado:** **2** unidad(es) con acoplamiento alto _(máximo 2 por 1000 LOC)_
- **Para investigar la causa:**
    - ¿Las piezas se conocen en detalle entre sí (acceden a campos o estructuras internas)?
    - ¿El acceso a datos ocurre desde lugares que no son los responsables?
    - ¿Se puede cambiar una parte sin tocar las demás?

### 14. Cobertura de tests (Cob) — A REVISAR

- **Qué mide:** Porcentaje de líneas de código ejecutadas por la suite de tests (cobertura real, no cantidad de archivos de test).
- **Por qué importa:** Un test que existe pero no ejecuta el código no protege de nada: la cobertura muestra qué partes quedan sin verificar.
- **Tu resultado:** **11.7%** de líneas cubiertas · fuente: ejecución: vitest _(mínimo 80% de líneas)_
- **Para investigar la causa:**
    - ¿Qué módulos o ramas del sistema nunca se ejecutan en los tests?
    - ¿Los tests prueban el camino principal y los errores, o solo el caso feliz?
    - ¿La suite se puede correr en CI sin base de datos ni servicios externos?

### 15. Endpoints del backend (EP) — A REVISAR

- **Qué mide:** Cantidad de endpoints (rutas HTTP) expuestos por el backend.
- **Por qué importa:** El backend se mide por lo que expone: pocos endpoints sugiere poca funcionalidad de servicio.
- **Tu resultado:** **4** endpoint(s) _(mínimo 5)_
- **Para investigar la causa:**
    - ¿Está claro el contrato del backend (qué operaciones ofrece)?
    - ¿Cuántas operaciones del enunciado resuelve la API?
    - ¿Hay operaciones que el frontend resuelve por fuera del backend?

## 5. Observaciones y qué falta

Criterios que hoy están en rojo y, para cada uno, una explicación breve de **cómo corregirlo** hasta alcanzar el nivel de aprobación (perfil `exigente`):

| Criterio | Resultado actual | Meta | Brecha | Cómo alcanzarlo |
|---|---|---|---|---|
| Separación en capas (capas) | **0** capa(s) detectada(s): ninguna | mínimo 2 capas (a partir de 150 LOC) | hoy 0; el mínimo es 2 | Separá el código en al menos 2 capas con responsabilidades claras: presentación (`routes/`, `controllers/`), lógica (`services/`, `domain/`) y datos (`models/`, `repositories/`). Mové cada archivo a la capa que le corresponde en vez de dejar todo en la raíz. |
| Acoplamiento alto (Acop) | **2** unidad(es) con acoplamiento alto | máximo 2 por 1000 LOC | 2 hallazgo(s); el máximo para 270 LOC es 0.5 | Hacé que cada unidad dependa de una interfaz o de un módulo de servicio, no de los detalles internos de otra; evitá acceder a campos ajenos. Meta: ≤2 por 1000 LOC. |
| Cobertura de tests (Cob) | **11.7%** de líneas cubiertas · fuente: ejecución: vitest | mínimo 80% de líneas | faltan 68.3 pts | Agregá o ampliá tests que ejecuten los módulos sin cubrir (camino principal y errores) y publicá el artefacto (`coverage/lcov.info`, `coverage-summary.json`, `coverage.xml` o `coverage.json`) o corré la suite con coverage. Meta: ≥80% de líneas. |
| Endpoints del backend (EP) | **4** endpoint(s) | mínimo 5 | faltan 1 endpoint(s) | Implementá y exponé las operaciones del contrato que faltan (CRUD y consultas del enunciado) hasta llegar a 5 endpoints. |

> Empezá por las señales de seguridad (**SEC**, **SQL**) y por la **duplicación**: son las que más pesan en el índice y las más rápidas de verificar a ojo. Después de corregir, volvé a correr la medición: el semáforo se recalcula sobre `main`.

> **Tests (informativo):** hoy tenés **2** archivo(s) de test; la meta es **5**, pero **no** es una compuerta del semáforo. Para acercarte, agregá tests de los flujos principales (servicios y endpoints) y corré la suite con coverage.

## 6. Actividad en clase (miércoles y viernes)

> Se consideran las **23 clases** del período (miércoles y viernes; Nov 4 y 6 quedan afuera porque el calendario las marca sin clase). `Commits` = commits de trabajo (no-merge); `Merges` = merges de PR (también son push). Los días sin actividad dicen **sin actividad**.

### IvoGiovarruscio

**10/23 clases con actividad** · 18 commits · 7 merges

| Fecha | Marca | Repositorios | Commits / merges |
|---|:--:|---|--:|
| 2026-08-14 | No | sin actividad | 0 / 0 |
| 2026-08-19 | No | sin actividad | 0 / 0 |
| 2026-08-21 | No | sin actividad | 0 / 0 |
| 2026-08-26 | No | sin actividad | 0 / 0 |
| 2026-08-28 | No | sin actividad | 0 / 0 |
| 2026-09-02 | **Sí** | backend-core-nestjs, backend-iot-fastapi | 2 / 1 |
| 2026-09-04 | No | sin actividad | 0 / 0 |
| 2026-09-09 | **Sí** | backend-core-nestjs, backend-iot-fastapi | 2 / 1 |
| 2026-09-11 | No | sin actividad | 0 / 0 |
| 2026-09-16 | No | sin actividad | 0 / 0 |
| 2026-09-18 | No | sin actividad | 0 / 0 |
| 2026-09-23 | **Sí** | backend-core-nestjs, backend-iot-fastapi, dashboard-frontend-vue | 2 / 1 |
| 2026-09-25 | No | sin actividad | 0 / 0 |
| 2026-09-30 | **Sí** | simulador-frontend-react | 1 / 0 |
| 2026-10-02 | **Sí** | dashboard-frontend-vue, simulador-frontend-react | 0 / 2 |
| 2026-10-07 | **Sí** | simulador-frontend-react | 3 / 0 |
| 2026-10-09 | No | sin actividad | 0 / 0 |
| 2026-10-14 | **Sí** | backend-core-nestjs | 0 / 1 |
| 2026-10-16 | **Sí** | simulador-frontend-react | 3 / 0 |
| 2026-10-21 | **Sí** | backend-core-nestjs, simulador-frontend-react | 3 / 0 |
| 2026-10-23 | No | sin actividad | 0 / 0 |
| 2026-10-28 | **Sí** | backend-core-nestjs, simulador-frontend-react | 2 / 1 |
| 2026-10-30 | No | sin actividad | 0 / 0 |

## 7. Anexo: dónde mirar

Archivos donde el análisis encontró cada señal en rojo (sin número de línea, a propósito):

**Separación en capas (capas)** — 1 archivo(s):
- `-`

**Acoplamiento alto (Acop)** — 2 archivo(s):
- `src/auth/auth.controller.ts`
- `src/auth/auth.service.ts`

---
_Informe generado por la cátedra. Los umbrales corresponden al perfil `exigente`. Ante dudas, revisá el archivo señalado y el criterio en `CRITERIOS-CALIDAD.md`._
<!-- evaluacion:fin -->
