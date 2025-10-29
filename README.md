
# Flota QR (Next.js + MongoDB + Cloudinary)

App base para gestionar equipos (grúas, ramplas, camionetas, etc.), registrar uso/consumo vía QR y ver reportes básicos.

## Stack
- Next.js (App Router, React 18, Suspense + `loading.tsx`)
- MongoDB (Atlas)
- JWT simple (cookies httpOnly) con roles: `admin` y `tecnico`
- Cloudinary (subida de fotos de comprobantes)
- Mongoose

## Variables de entorno
Crea `.env.local` copiando desde `.env.example` y completa tus datos (Atlas, Cloudinary, etc.).

## Desarrollo
```bash
pnpm i # o npm i / yarn
pnpm dev
```

## Seed (usuario admin)
```bash
pnpm run seed
```
Crea (si no existe) un usuario admin con `ADMIN_DEFAULT_EMAIL` y `ADMIN_DEFAULT_PASSWORD`.

## Despliegue en Vercel
- Sube el repo a GitHub (o importa carpeta).
- En Vercel, crea un proyecto y setea todas las variables del `.env.example`.
- Construcción: `next build` (por defecto).
- Recuerda configurar Cloudinary y la URI de MongoDB Atlas.
