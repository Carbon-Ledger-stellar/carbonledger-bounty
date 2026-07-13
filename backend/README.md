# CarbonLedger Backend API

NestJS REST API for CarbonLedger carbon credit marketplace.

## Setup

```bash
npm install
npx prisma migrate deploy
npm run dev
```

API runs on `http://localhost:3001/api/v1`

## API Endpoints

### Authentication
- `POST /auth/login` - Login with wallet signature

### Projects
- `GET /projects` - List all projects
- `GET /projects/:id` - Get project details
- `POST /projects/register` - Register new project (protected)
- `PUT /projects/:id/verify` - Verify project (protected)

### Credits
- `GET /credits/batch/:id` - Get batch details
- `POST /credits/mint` - Mint new credits (protected)
- `POST /credits/retire` - Retire credits (protected)
- `GET /credits/serial/:serial` - Lookup serial number

### Marketplace
- `GET /marketplace/listings` - List all listings
- `GET /marketplace/listings/:id` - Get listing details
- `POST /marketplace/list` - Create listing (protected)
- `DELETE /marketplace/listings/:id` - Delist (protected)
- `POST /marketplace/purchase` - Purchase credits (protected)

### Retirements
- `GET /retirements` - List all retirements
- `GET /retirements/:id` - Get retirement details

### Oracle
- `POST /oracle/monitoring` - Submit monitoring data (protected)
- `GET /oracle/status/:projectId` - Get monitoring status

### Stats
- `GET /stats/platform` - Get platform statistics

## Authentication

All protected endpoints require JWT token in `Authorization: Bearer <token>` header.

Obtain token by calling `/auth/login` with Stellar keypair signature.

## Database

PostgreSQL with Prisma ORM. Schema in `prisma/schema.prisma`.

Migrations: `npx prisma migrate dev`
