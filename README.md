# GateVerify — Warehouse Truck Geofence Check-In

Production-ready MVP for warehouse truck check-ins with browser GPS, driver-owned SMS handoff, tokenized document upload, lightweight electronic signing, Clerk authentication, DigitalOcean Managed PostgreSQL, Redis, and independently containerized microservices.

## Features

- SaaS-style landing page with logistics/warehouse positioning.
- Mobile-first driver check-in flow with browser Geolocation API.
- Radius-based geofence verification using the Haversine formula.
- Prefilled SMS link: drivers must tap to send from their own phone.
- Copy-to-clipboard fallback for SMS messages.
- Secure tokenized document upload links expiring after 72 hours by default.
- PDF/JPG/PNG uploads with category selection and 10MB limit.
- Warehouse document view mode with private signed URL support for DigitalOcean Spaces.
- Self-serve signing flow with typed signature, optional canvas drawing, consent checkbox, IP, user-agent, and timestamp capture.
- Clerk-protected warehouse dashboard with filters, detail pages, approve manually, and reject actions.

## Stack

- Next.js App Router + TypeScript web app
- Express microservices for check-in, dashboard, documents, and signing
- Clerk authentication for dashboard access
- DigitalOcean Managed PostgreSQL via `pg`
- DigitalOcean Managed Redis via `ioredis`
- Optional DigitalOcean Spaces for private document storage
- Tailwind CSS

## Microservice Boundaries

- `web`: Next.js marketing and driver/warehouse UI only.
- `checkin-service`: warehouse lookup, GPS/geofence check-in creation, token generation, Redis rate limiting, and SMS message generation.
- `docs-service`: tokenized document upload/listing, MIME/size validation, and private DigitalOcean Spaces storage integration.
- `signing-service`: tokenized electronic signature capture, consent, IP address, user agent, timestamp, and PDF stub response.
- `dashboard-service`: Clerk-protected check-in tables, filters, detail views, and manual approve/reject actions.
- `postgres`: local development Postgres replacement for DigitalOcean Managed PostgreSQL.
- `redis`: local development Redis replacement for DigitalOcean Managed Redis.

The services communicate through stable HTTP contracts and share only the database schema plus small TypeScript utility modules in `services/shared`. This lets you deploy or change one feature service without rebuilding every other feature container.

## Local Setup

```bash
npm install
cp .env.example .env.local
```

Fill in Clerk keys and DigitalOcean connection strings in `.env.local`.

```bash
npm run db:schema
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Microservice Local Setup

Run the full isolated stack with Docker Compose:

```bash
docker compose --env-file .env.local up --build
```

Service ports:

- Web: `http://localhost:3000`
- Check-in service: `http://localhost:4001/health`
- Dashboard service: `http://localhost:4002/health`
- Documents service: `http://localhost:4003/health`
- Signing service: `http://localhost:4004/health`
- Postgres: `localhost:15432`
- Redis: `localhost:16379`

Run a single service during focused development:

```bash
npm run dev:checkin
npm run dev:dashboard
npm run dev:docs
npm run dev:signing
```

## Environment Variables

- `NEXT_PUBLIC_APP_URL`: Public app URL used in SMS document/signing links.
- `NEXT_PUBLIC_CHECKIN_API_URL`: Browser-facing URL for `checkin-service`.
- `NEXT_PUBLIC_DASHBOARD_API_URL`: Browser-facing URL for `dashboard-service`.
- `NEXT_PUBLIC_DOCS_API_URL`: Browser-facing URL for `docs-service`.
- `NEXT_PUBLIC_SIGNING_API_URL`: Browser-facing URL for `signing-service`.
- `CORS_ORIGIN`: Comma-separated web origins allowed to call the services.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk frontend key.
- `CLERK_SECRET_KEY`: Clerk backend key.
- `DEV_AUTH_BYPASS`: Local-only dashboard auth bypass. Keep `false` or unset in production.
- `NEXT_PUBLIC_DEV_AUTH_BYPASS`: Shows local-only operations links when `true`. Keep `false` or unset in production.
- `DATABASE_URL`: DigitalOcean Managed PostgreSQL connection string with SSL.
- `REDIS_URL`: DigitalOcean Managed Redis connection string.
- `TOKEN_TTL_HOURS`: Optional token expiration override; defaults to `72`.
- `DO_SPACES_*`: Optional DigitalOcean Spaces settings for private document storage.

## Database

Schema and seed data are in `db/schema.sql` and `db/seed.sql`.

```bash
DATABASE_URL="postgresql://user:password@host:25060/defaultdb?sslmode=require" npm run db:schema
DATABASE_URL="postgresql://user:password@host:25060/defaultdb?sslmode=require" npm run db:seed
```

## Driver Flow

1. Visit `/`.
2. Tap **Get Started**.
3. Complete `/check-in`.
4. Tap **Verify GPS Location**.
5. Create the check-in.
6. Tap **Send Verified SMS to Warehouse** or **Copy SMS Message**.
7. Upload documents at `/docs/:token`.
8. Sign at `/sign/:token`.

## Warehouse Flow

1. Sign in through `/sign-in` with Clerk, or enable `DEV_AUTH_BYPASS=true` locally.
2. Open `/dashboard` for the operations board.
3. Track each freight record through geofence check-in, document exchange, signing, and geofence check-out.
4. Use **Driver docs**, **Review docs**, **Signing**, and **Geofence check-out** actions from the freight operations cards.
5. Review detail pages and use **Approve manually** or **Reject** for exceptions.

## Deployment Notes

- Vercel/Netlify: deploy `web` as a Next.js app and point `NEXT_PUBLIC_*_API_URL` to deployed service URLs.
- DigitalOcean App Platform: deploy one component per Dockerfile command and attach managed Postgres/Redis environment variables.
- DigitalOcean Managed Database/Redis: set each service's `DATABASE_URL` and `REDIS_URL` to managed service connection strings.

## Security Notes

- Dashboard and admin APIs are protected with Clerk.
- Driver check-in, document, and signing links use high-entropy random tokens.
- Token expiration is enforced server-side.
- Uploads validate MIME type and size.
- DigitalOcean Spaces uploads are private; warehouse read access uses short-lived signed URLs when Spaces is configured.
- Inputs are validated with `zod` and sanitized before SMS/signature storage.

## PDF Stub

Signed summary PDF generation is intentionally stubbed in `src/lib/pdf.ts` for a later release.