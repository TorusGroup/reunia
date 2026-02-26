# ReunIA — Missing Children AI Platform

Plataforma open source de busca de crianças desaparecidas usando inteligência artificial.
Unifies FBI, Interpol, NCMEC, and AMBER Alert data. Facial recognition with mandatory human review.
Real-time geo-targeted alerts. LGPD/GDPR compliant.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 15 (App Router, SSR/RSC) |
| Database | PostgreSQL 16 + pgvector + PostGIS + Prisma |
| Cache / Queues | Redis 7 + BullMQ |
| Auth | JWT RS256 + RBAC (6 roles) |
| Styling | Tailwind CSS 4 + CSS Design Tokens |
| Face Engine | Python 3.11 + FastAPI + DeepFace/ArcFace |
| Middleware | Next.js Edge Middleware (security headers, CORS, route protection) |

## Prerequisites

- **Node.js** 20+ (`node --version`)
- **Docker Desktop** 4.x+ (for PostgreSQL + Redis)
- **Python 3.11+** (for face service, optional in dev)

## Quick Start (< 10 minutes)

### 1. Install dependencies

```bash
cd apps/reunia
npm install
```

### 2. Start databases

```bash
# From the apps/reunia directory (or aios-core root)
docker compose up -d postgres redis
# Wait ~30 seconds for health checks
docker compose ps
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`. **Minimum required** to run locally:

```env
DATABASE_URL=postgresql://reunia:reunia_dev@localhost:5432/reunia
DIRECT_DATABASE_URL=postgresql://reunia:reunia_dev@localhost:5432/reunia
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=<32+ char random string>
```

**Generate JWT RS256 keys** (required for auth):

```bash
# Generate private key
openssl genrsa -out dev-private.pem 2048

# Extract public key
openssl rsa -in dev-private.pem -pubout -out dev-public.pem

# Get .env format (replaces newlines with \n)
# Linux/macOS:
export JWT_PRIVATE_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' dev-private.pem)
export JWT_PUBLIC_KEY=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' dev-public.pem)

# Then add to .env.local:
# JWT_PRIVATE_KEY="<output from above>"
# JWT_PUBLIC_KEY="<output from above>"
```

### 4. Run database migrations

```bash
# Create all tables
npm run db:migrate

# Seed with test data (9 data sources, 5 fake cases, 4 test users)
npm run db:seed
```

### 5. Start the app

```bash
npm run dev
# App: http://localhost:3000
# API: http://localhost:3000/api/v1
# Health: http://localhost:3000/api/health
```

### 6. (Optional) Start face service

```bash
cd face-service
pip install -r requirements.txt
python main.py
# Face service: http://localhost:8001
```

## Development Accounts (after seed)

| Role              | Email                               | Password           |
|-------------------|-------------------------------------|--------------------|
| Admin             | admin@reunia.org                    | Admin@ReunIA2026!  |
| Family            | renata.silva@example.com            | Family@ReunIA2026! |
| Law Enforcement   | delegado.teste@pcsp.sp.gov.br       | LawEnf@ReunIA2026! |
| Developer         | dev@reunia.org                      | Dev@ReunIA2026!    |

## Sprint Progress

| Sprint | Description                        | Status   |
|--------|------------------------------------|----------|
| 1      | Foundation & Infrastructure        | Done     |
| 2      | Data Ingestion Pipeline (FBI/Interpol/NCMEC/AMBER) | Done |
| 3      | Search Engine (FTS + Trigram + Geo)| Done     |
| 4      | Web Portal (Public search + Case registration) | Done |
| 5      | Face Match Engine + HITL Queue     | Done     |
| 6      | Alert System + Law Enforcement Dashboard | Done |
| 7      | Security Hardening, Polish & Launch Prep | Done |

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 15 App                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Public Portal│  │ Family Portal│  │ LE Dashboard│ │
│  └──────────────┘  └──────────────┘  └────────────┘ │
│         │                 │                 │         │
│  ┌──────────────────────────────────────────────┐    │
│  │              API Routes (/api/v1/*)           │    │
│  └──────────────────────────────────────────────┘    │
│         │                 │                 │         │
│  ┌──────┴──────┐  ┌───────┴───────┐  ┌─────┴─────┐  │
│  │  Search     │  │  Ingestion    │  │  Alerts   │  │
│  │  Engine     │  │  Pipeline     │  │  System   │  │
│  └──────┬──────┘  └───────┬───────┘  └─────┬─────┘  │
└─────────┼─────────────────┼────────────────┼─────────┘
          │                 │                │
   ┌──────▼──────┐  ┌───────▼──────┐  ┌─────▼──────┐
   │ PostgreSQL  │  │    Redis     │  │  Python    │
   │ + pgvector  │  │  + BullMQ   │  │ Face Svc   │
   │ + PostGIS   │  │             │  │ (ArcFace)  │
   └─────────────┘  └─────────────┘  └────────────┘
```

## Key API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | System health (DB + Redis + Face) |
| POST | `/api/v1/auth/register` | None | Register user |
| POST | `/api/v1/auth/login` | None | Login (JWT RS256) |
| GET | `/api/v1/auth/me` | Bearer | Current user |
| GET | `/api/v1/search?q=nome` | None | Full-text + fuzzy + geo search |
| POST | `/api/v1/cases` | family+ | Register new case |
| POST | `/api/v1/face/match` | volunteer+ | Face match upload |
| GET | `/api/v1/alerts/subscribe` | None | Subscribe to geo alerts |
| POST | `/api/v1/sightings` | None | Report sighting (rate limited) |
| GET | `/api/v1/ingestion` | ngo+ | Data source status |
| POST | `/api/v1/alerts/broadcast` | le+ | AMBER alert broadcast |

## Environment Variables

See `.env.example` for all variables with documentation.

**Critical required vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` — RS256 key pair
- `ENCRYPTION_KEY` — 32+ character random string
- `CLOUDINARY_*` — Photo storage (sign up at cloudinary.com)

## Security

Sprint 7 security hardening includes:
- Security headers on all responses (CSP, HSTS, X-Frame-Options, etc.)
- Route protection via Next.js middleware
- Granular rate limiting per endpoint per user role
- Input sanitization library (SQL injection, XSS, path traversal prevention)
- IP reputation tracking and abuse pattern detection
- Content moderation for sighting reports
- Magic bytes validation for image uploads

## Ethical Guidelines (NON-NEGOTIABLE)

1. **Human-in-the-Loop is mandatory** — No face match result triggers any action without human review
2. **LGPD/GDPR compliant** — Privacy by design, data minimization, right to erasure
3. **Bias monitoring** — Disaggregated metrics by Fitzpatrick skin tone, age, gender
4. **No training on missing children photos** — Embeddings are for search only
5. **Audit trail** — Every access to sensitive data is logged immutably
6. **CVV 188 visible on all error pages** — Crisis support always accessible

## Contributing

Open source under Apache 2.0. See `projects/missing-children/docs/` for full documentation.

For legal and ethical guidelines: `projects/missing-children/docs/architecture/legal-framework.md`
