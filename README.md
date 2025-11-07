
# Flota QR (Next.js + MongoDB + Cloudinary)

Plataforma web para administrar flotas (grúas, ramplas, camionetas, etc.), asignar equipos a técnicos y registrar evaluaciones operativas vía códigos QR. El sistema ofrece paneles diferenciados (admin y técnico) con indicadores, reportes y respaldos visuales opcionales.

## ¿Qué hace el sistema?
- **Autenticación por roles** (`admin`, `tecnico`) con sesiones JWT almacenadas en cookies httpOnly.
- **Gestión de equipos**: creación, asignación a técnicos, generación de QR listos para imprimir y pegar en la máquina.
- **Registro de evaluaciones**:
  - Escaneo del QR desde desktop o móvil.
  - Checklists dinámicos por tipo de equipo y perfil del técnico.
  - Formularios adicionales configurables por el administrador, con subida opcional de fotos de respaldo.
  - Funcionamiento offline: cuando no hay red, las evaluaciones se encolan y se sincronizan luego.
- **Alertas y auditoría**: se loguean eventos críticos y se disparan notificaciones push para fallas con estado “crítico”.
- **Reportes y filtros avanzados**: historial con calendario multi-selección, posibilidad de exportar CSV/PDF y vista rápida de evidencias fotográficas.

## ¿Qué muestran los dashboards?

### Panel del administrador
- **Dashboard principal**: KPIs de equipos registrados, técnicos activos, formularios enviados, fallas críticas recientes y consumo (combustible, energía, AdBlue, kilómetros, horas) en los últimos 30 días. Incluye tarjetas de tendencias mensuales y alertas.
- **Gestor de equipos**: tabla paginada con orden cronológico inverso, asignaciones en línea, acceso directo a edición y QR.
- **Checklists**: creación/edición con versiones, perfiles permitidos y vista previa de la estructura.
- **Formularios operativos**: builder de plantillas con campos dinámicos, métricas y adjuntos opcionales.
- **Historial de evaluaciones**: calendario multi-select para elegir uno o varios días (o rangos concatenados), filtros por checklist/técnico/equipo/estado, columna con miniaturas de evidencias y modal ampliado. Exporta CSV o imprime PDF.
- **Usuarios**: gestión completa (crear, editar, desactivar) filtrada por rol.

### Panel del técnico
- **Vista “Mis equipos”**: lista de unidades asignadas con acceso directo al detalle y evaluaciones previas.
- **Escáner QR**: selección de cámara, tips de permisos, ingreso manual de códigos y pick rápido de equipos asignados. Tras un escaneo exitoso se abre el formulario correspondiente.
- **Formulario de evaluación**: checklist + formulario operativo (si aplica), registro de odómetro/horómetro, turno y supervisor (para perfil Candelaria) y subida opcional de fotos.
- **Sincronización offline**: banner y manager de tareas que indican cuándo hay evaluaciones pendientes por enviar.

## Stack
- **Next.js 14 (App Router)** con React 18, Suspense y rutas protegidas vía middleware.
- **MongoDB + Mongoose** (Atlas recomendado).
- **JWT** con cookies httpOnly para sesiones.
- **Cloudinary** para almacenamiento de fotos y evidencias.
- **Service Worker / PWA** (next-pwa) para soportar trabajo offline.

## Variables de entorno
Crea `.env.local` copiando desde `.env.example` y completa:
- URI de MongoDB (`MONGODB_URI`)
- Secretos JWT (`JWT_SECRET`)
- Configuración de Cloudinary (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- URLs públicas (`NEXT_PUBLIC_BASE_URL`, etc.)

## Desarrollo local
```bash
npm install   # o pnpm/yarn
npm run dev   # arranca Next.js en modo desarrollo
```
La app queda disponible en `http://localhost:3000`.

## Seed (usuario admin)
```bash
npm run seed
```
El script crea, si no existe, un usuario admin definido por `ADMIN_DEFAULT_EMAIL` y `ADMIN_DEFAULT_PASSWORD` (ver `.env.example`).

## Despliegue en Vercel
1. Repositorio en GitHub (o importar carpeta).
2. Crear proyecto en Vercel y definir **todas** las variables del `.env.example`.
3. Construcción por defecto (`next build`).
4. Configurar Cloudinary y MongoDB Atlas accesibles desde Vercel (IPs con acceso público o Vercel Managed).

## Contacto / soporte
Si necesitas ampliar funcionalidades (nuevos reportes, más métricas o integraciones externas), crea un issue o escribe al equipo técnico de Flota QR. وی
