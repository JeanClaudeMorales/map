# Mapas Libertador (Mérida) — Localhost

## Requisitos
- Node.js 18+ (recomendado 20+)
- API Key de MapTiler (https://cloud.maptiler.com)

## 1) Instalar
```bash
npm install
```

## 2) Configurar MapTiler Key
Crea un archivo `.env.local` en la raíz (mira `.env.local.example`) y coloca:
```env
NEXT_PUBLIC_MAPTILER_KEY=TU_KEY
```

## 3) Ejecutar
```bash
npm run dev
```
Abre: http://localhost:3000

## Datos
- Parroquias (14 por ahora): `public/data/parroquias_libertador_14.geojson`
- Marcadores: se guardan en `localStorage` (MVP). Luego lo conectamos a PostGIS.

## Nota
Domingo Peña se agrega luego como Feature extra (dibujada en la app) y se une al GeoJSON.
