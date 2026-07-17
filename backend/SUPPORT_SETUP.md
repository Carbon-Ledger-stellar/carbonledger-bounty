# Support System Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ running
- Prisma CLI installed (`npm install -g prisma`)

## Setup Steps

### 1. Install Dependencies

The support system uses the `uuid` package for generating unique ticket IDs. Install it if not already present:

```bash
cd backend
npm install uuid
npm install -D @types/uuid
```

### 2. Create Database Migration

Generate a new Prisma migration for the support ticket models:

```bash
cd backend
npx prisma migrate dev --name add_support_tickets
```

This will:
- Create the migration files
- Apply the migration to your local database
- Generate updated Prisma client types

### 3. Verify Models

Check that Prisma generated the models correctly:

```bash
npx prisma generate
```

### 4. Start Backend Server

The support module is now automatically loaded:

```bash
npm run dev
```

The server will start on http://localhost:3001, and the support endpoints will be available at:
- `http://localhost:3001/api/v1/support/tickets`
- `http://localhost:3001/api/v1/support/metrics`
- `http://localhost:3001/api/v1/support/statistics`

## Verifying Installation

### 1. Check Database

```bash
npx prisma studio
```

Navigate to the SupportTicket table to verify it was created.

### 2. Test API

Create a test ticket:

```bash
curl -X POST http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "bountyId": "test-bounty",
    "type": "unclear-requirement",
    "title": "Test ticket",
    "description": "This is a test support ticket"
  }'
```

Get all tickets:

```bash
curl http://localhost:3001/api/v1/support/tickets
```

Get statistics:

```bash
curl http://localhost:3001/api/v1/support/statistics
```

## Deployment Steps

### To Testnet/Mainnet:

1. Update `.env` with production database URL
2. Run migrations in production environment:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
3. Restart backend service
4. Verify endpoints are accessible

## Rollback (if needed)

To rollback to the previous state:

```bash
npx prisma migrate resolve --rolled-back add_support_tickets
# OR revert the migration file and run:
npx prisma migrate deploy
```

## JWT Token Setup

Ensure your `.env` file has JWT configuration:

```env
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d
```

## Common Issues

### Issue: "PrismaClientKnownRequestError: Unknown argument `ticketType` for field `id` on model `SupportMetrics`"

**Solution**: Run `npx prisma generate` to regenerate the Prisma client after updating the schema.

### Issue: "Database connection failed"

**Solution**: Verify the `DATABASE_URL` in `.env` is correct and the database server is running.

### Issue: "Cannot find module 'uuid'"

**Solution**: Run `npm install uuid` in the backend directory.

## Next Steps

1. Add email notifications when maintainers receive new tickets
2. Integrate with bounty system to link tickets to specific bounties
3. Add support ticket templates for common issue types
4. Create a dashboard to visualize support metrics
5. Set up automated alerts for critical blockers
