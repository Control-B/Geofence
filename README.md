# GateVerify — Warehouse Truck Geofence Check-In

Production-ready MVP for freight arrival automation with an ASP.NET Core trip API, secure SMS check-in links, live browser GPS geofencing, Mapbox tracking, Azure integration points, tokenized document upload, lightweight electronic signing, Clerk authentication, PostgreSQL, Redis, and independently containerized services.

## Features

- SaaS-style landing page with logistics/warehouse positioning.
- ASP.NET Core Web API for trip creation, public token validation, live location pings, audit events, and document upload URLs.
- Mobile-first `/checkin/:token` driver flow with browser Geolocation API and Mapbox GL JS.
- Radius-based geofence verification using the Haversine formula.
- Azure Communication Services SMS adapter for secure driver links.
- Azure Service Bus event publisher and hosted worker placeholder for Teams Bot notifications.
- Microsoft Teams Bot Adaptive Card payload for arrival alerts and warehouse actions.
- Copy-to-clipboard fallback for SMS messages.
- Secure tokenized document upload links expiring after 72 hours by default.
- PDF/JPG/PNG uploads with category selection and 10MB limit.
- Warehouse document view mode with private signed URL support for DigitalOcean Spaces.
- Self-serve signing flow with typed signature, optional canvas drawing, consent checkbox, IP, user-agent, and timestamp capture.
- Clerk-protected warehouse dashboard with filters, detail pages, approve manually, and reject actions.

## Stack

- Next.js App Router + TypeScript web app
- ASP.NET Core 8 Web API in `backend/FreightCheckIn.Api`
- Express microservices retained for legacy dashboard, documents, and signing flows during migration
- Clerk authentication for dashboard access
- PostgreSQL via Npgsql / `pg`
- Redis via `ioredis`
- Azure Communication Services SMS
- Azure Service Bus
- Azure Blob Storage private document containers with SAS upload URLs
- Application Insights-compatible structured logging
- Tailwind CSS

## Microservice Boundaries

- `web`: Next.js marketing, dispatcher, driver, and warehouse UI.
- `freight-api`: ASP.NET Core trip API, geofence engine, ACS SMS, Azure Service Bus publisher/consumer, Teams Bot action endpoints, Blob SAS upload URLs, and audit logging.
- `checkin-service`: legacy warehouse lookup/GPS check-in service kept for compatibility while the ASP.NET trip workflow becomes primary.
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
- ASP.NET Core freight API: `http://localhost:5000/health`
- Check-in service: `http://localhost:4001/health`
- Dashboard service: `http://localhost:4002/health`
- Documents service: `http://localhost:4003/health`
- Signing service: `http://localhost:4004/health`
- Postgres: `localhost:${POSTGRES_HOST_PORT:-15433}`
- Redis: `localhost:16379`

Primary local test flow:

1. Open `http://localhost:3000/dispatch`.
2. Create a trip. If ACS is not configured, the API logs that SMS was skipped and still returns the secure check-in URL for local testing.
3. Open the returned `/checkin/:token` link.
4. Allow location access. The browser sends GPS pings to `http://localhost:5000/api/trips/public/{token}/location`.
5. For desktop testing near a different location, create the trip with warehouse coordinates near your current browser GPS location.

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
- `NEXT_PUBLIC_API_BASE_URL`: Browser-facing URL for the ASP.NET Core freight API. Defaults to `http://localhost:5000`.
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Public Mapbox token used by `/checkin/:token`.
- `CORS_ORIGIN`: Comma-separated web origins allowed to call the services.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk frontend key.
- `CLERK_SECRET_KEY`: Clerk backend key.
- `DEV_AUTH_BYPASS`: Local-only dashboard auth bypass. Keep `false` or unset in production.
- `NEXT_PUBLIC_DEV_AUTH_BYPASS`: Shows local-only operations links when `true`. Keep `false` or unset in production.
- `DATABASE_URL`: DigitalOcean Managed PostgreSQL connection string with SSL.
- `REDIS_URL`: DigitalOcean Managed Redis connection string.
- `ACS_CONNECTION_STRING`: Azure Communication Services connection string.
- `ACS_FROM_NUMBER`: ACS sender number.
- `PUBLIC_APP_BASE_URL`: Public frontend base URL used in driver SMS links.
- `SERVICE_BUS_CONNECTION_STRING`: Azure Service Bus namespace connection string.
- `TRIP_EVENTS_QUEUE_NAME`: Queue for trip integration events.
- `AZURE_BLOB_STORAGE_CONNECTION_STRING`: Azure Blob Storage connection string.
- `AZURE_BLOB_STORAGE_CONTAINER_NAME`: Private delivery document container.
- `TEAMS_BOT_*`: Microsoft Teams Bot/Azure Bot Service settings.
- `TOKEN_TTL_HOURS`: Optional token expiration override; defaults to `72`.
- `DO_SPACES_*`: Optional DigitalOcean Spaces settings for private document storage.

## Database

Schema and seed data are in `db/schema.sql` and `db/seed.sql`.

```bash
DATABASE_URL="postgresql://user:password@host:25060/defaultdb?sslmode=require" npm run db:schema
DATABASE_URL="postgresql://user:password@host:25060/defaultdb?sslmode=require" npm run db:seed
```

## ASP.NET API Examples

Create a trip:

```bash
curl -X POST http://localhost:5000/api/trips \
	-H 'Content-Type: application/json' \
	-d '{
		"tripReference":"LOAD-10029",
		"driverName":"John Smith",
		"driverPhone":"+15555550123",
		"warehouseName":"Tampa Distribution Center",
		"warehouseLat":27.9506,
		"warehouseLng":-82.4572,
		"geofenceRadiusMeters":250,
		"scheduledArrivalTime":"2026-05-28T15:00:00Z"
	}'
```

Send a location ping:

```bash
curl -X POST http://localhost:5000/api/trips/public/YOUR_TOKEN/location \
	-H 'Content-Type: application/json' \
	-d '{
		"latitude":27.9509,
		"longitude":-82.4575,
		"accuracyMeters":15,
		"speed":4.2,
		"heading":180,
		"timestamp":"2026-05-28T15:12:00Z"
	}'
```

## Driver Flow

1. Visit `/`.
2. Tap **Create Trip** or open `/dispatch`.
3. Create a trip and open the generated `/checkin/:token` link.
4. Allow browser location access.
5. Watch trip status update from tracking to arrived after the required inside-geofence pings.
6. Upload documents when requested.

## Warehouse Flow

1. Sign in through `/sign-in` with Clerk, or enable `DEV_AUTH_BYPASS=true` locally.
2. Open `/dashboard` for the operations board.
3. Track each freight record through geofence check-in, document exchange, signing, and geofence check-out.
4. Use **Driver docs**, **Review docs**, **Signing**, and **Geofence check-out** actions from the freight operations cards.
5. Review detail pages and use **Approve manually** or **Reject** for exceptions.

## Deployment Notes

- Azure Container Apps: deploy `Dockerfile.api` as the ASP.NET Core API container and `Dockerfile.web` as the Next.js web container. Attach Azure Database for PostgreSQL, Azure Cache for Redis, Azure Communication Services, Service Bus, Blob Storage, Application Insights, and Azure Bot Service settings as Container App secrets.
- Vercel/Netlify: deploy `web` as a Next.js app and point `NEXT_PUBLIC_API_BASE_URL` to the deployed ASP.NET API URL.
- Local Docker Compose: use `docker compose --env-file .env.local up --build` to run web, ASP.NET API, legacy services, Postgres, and Redis.

## Security Notes

- Dashboard and admin APIs are protected with Clerk.
- Driver check-in, document, and signing links use high-entropy random tokens.
- Token expiration is enforced server-side.
- Uploads validate MIME type and size.
- DigitalOcean Spaces uploads are private; warehouse read access uses short-lived signed URLs when Spaces is configured.
- Inputs are validated with `zod` and sanitized before SMS/signature storage.

## PDF Stub

Signed summary PDF generation is intentionally stubbed in `src/lib/pdf.ts` for a later release.