# Nutriment Portal

Poultry health management portal for Australian broiler operations. Built on Next.js 15, Supabase, Vercel.

---

## What's in this iteration (v0.1)

| Pantalla | Estado |
|---|---|
| Login (email + Google SSO) | ✅ Funcional |
| Dashboard | ✅ Funcional con datos reales de Supabase |
| Farms | ⏳ Placeholder navegable |
| Visits | ⏳ Placeholder navegable |
| Scoring | ⏳ Placeholder navegable |
| Reports | ⏳ Placeholder navegable |

Las pantallas pendientes se construyen en iteraciones siguientes manteniendo el mismo design system.

---

## Setup paso a paso

### 1. Crear proyecto Supabase

1. Ir a https://supabase.com → **New project**.
2. Elegir región **Sydney** (más cerca de VIC).
3. Anotar la **Database password** que generes (la vas a necesitar para migrations).
4. Cuando esté listo (1–2 min), ir a **Settings → API** y copiar:
   - **Project URL** (ej: `https://xxxxxxxx.supabase.co`)
   - **anon / public key**
   - **service_role key** (solo para servidor — nunca exponer al cliente)

### 2. Aplicar el schema

Tenés dos opciones:

**Opción A — Supabase CLI (recomendado para producción):**
```bash
npm install -g supabase
supabase login
supabase link --project-ref xxxxxxxx        # tu project ref
supabase db push                             # aplica todo lo de supabase/migrations
```

**Opción B — SQL Editor (más rápido para empezar):**
1. En Supabase → **SQL Editor → New query**.
2. Pegar y correr `supabase/migrations/0001_init.sql`.
3. Pegar y correr `supabase/migrations/0002_rls.sql`.
4. Pegar y correr `supabase/seed.sql` (datos de ejemplo: cliente Hazeldenes, granjas, lotes, visitas, alertas).

### 3. Configurar auth en Supabase

En **Authentication → Providers**:
- **Email**: dejar habilitado, desactivar "Confirm email" mientras desarrollas.
- **Google** (opcional, para SSO): seguir https://supabase.com/docs/guides/auth/social-login/auth-google.

En **Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000` (luego cambiar a la URL de Vercel).
- **Redirect URLs**: agregar `http://localhost:3000/auth/callback` y `https://*.vercel.app/auth/callback`.

### 4. Crear el primer usuario y asociarlo al cliente

En **Authentication → Users → Add user**:
- Email: `diaz@nutriment.com.au`, password lo que quieras.
- Anotar el `user.id` (UUID) que se genera.

En **SQL Editor**, correr:
```sql
insert into client_members (client_id, user_id, role)
select id, '<EL-UUID-QUE-COPIASTE>', 'admin' from clients where slug = 'hazeldenes';
```

### 5. Setup local del proyecto

```bash
pnpm install                                 # o npm install
cp .env.example .env.local
```

Editar `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

```bash
pnpm dev
```

Abrir http://localhost:3000 → te redirige a `/login` → entrás con `diaz@nutriment.com.au` → caés en el dashboard con datos reales.

### 6. Deploy a Vercel

```bash
git init && git add . && git commit -m "init"
gh repo create nutriment-portal --private --push       # o crear el repo a mano
```

En Vercel:
1. **Import Git Repository** → seleccionar el repo.
2. Configurar las mismas env vars de `.env.local`.
3. Deploy. Tarda ~1 minuto.
4. Volver a Supabase → **URL Configuration** y agregar la URL de Vercel a Site URL y Redirect URLs.

### 7. Pipedream (más adelante)

Cuando lleguemos a las pantallas de scoring (foto + IA) y reports (APVMA), levantamos los workflows en Pipedream:
- Webhook desde Supabase Storage cuando se sube una foto → corre modelo de visión → escribe `ai_suggested_score` en `visit_scores`.
- Cron mensual que arma el reporte APVMA en PDF y lo deposita en Storage.

---

## Estructura del proyecto

```
nutriment-portal/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # email + SSO
│   │   └── auth/callback/route.ts   # OAuth callback
│   ├── (app)/
│   │   ├── layout.tsx               # sidebar + topbar shell
│   │   ├── dashboard/page.tsx       # ✅ implementada
│   │   ├── farms/page.tsx           # ⏳ placeholder
│   │   ├── visits/page.tsx          # ⏳ placeholder
│   │   ├── scoring/page.tsx         # ⏳ placeholder
│   │   └── reports/page.tsx         # ⏳ placeholder
│   ├── globals.css                  # tokens del design system
│   ├── layout.tsx                   # root layout, fonts
│   └── page.tsx                     # redirect → /dashboard o /login
│
├── components/
│   ├── ui/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── pill.tsx
│   │   └── icons.tsx
│   └── dashboard/
│       ├── ai-insight.tsx
│       ├── kpi-stats.tsx
│       ├── alerts-panel.tsx
│       ├── today-visits.tsx
│       ├── mortality-chart.tsx
│       └── scoring-trends.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # browser client
│   │   ├── server.ts                # server client
│   │   └── middleware.ts            # session refresh
│   ├── types.ts                     # tipos compartidos
│   └── utils.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql            # schema
│   │   └── 0002_rls.sql             # row-level security
│   └── seed.sql                     # datos demo
│
├── middleware.ts                    # auth en cada request
├── tailwind.config.ts
└── package.json
```

---

## Stack y por qué

| Pieza | Versión | Razón |
|---|---|---|
| Next.js | 15.x app router | Server Components reducen JS al cliente, mejor para tablets en galpón |
| Supabase | latest | Auth + Postgres + Storage + RLS multi-tenant en una sola pieza |
| Tailwind | 3.4 | Tokens del design system mapeados directo de los mockups HTML |
| TypeScript | 5.x | Tipos generados de Supabase = un solo source of truth |
| @supabase/ssr | 0.5+ | SSR-safe auth, recomendado para app router |
| Vercel | — | Despliegue cero-config + edge functions cuando hagan falta |
| Pipedream | — | Workflows visuales para integraciones (lab, matadero, IA de fotos) sin escribir endpoints custom |

---

## Comandos útiles

```bash
pnpm dev                             # dev server
pnpm build && pnpm start             # build de producción local
pnpm lint                            # eslint
supabase gen types typescript --project-ref xxx > lib/database.types.ts   # regenerar tipos cuando cambia el schema
supabase db push                     # aplicar migrations nuevas
```
