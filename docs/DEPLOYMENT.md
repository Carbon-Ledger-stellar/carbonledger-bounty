# CarbonLedger Deployment Guide

## Prerequisites

- Stellar CLI (`stellar` command)
- Node.js 18+
- PostgreSQL 14+
- Rust & Cargo (for smart contracts)

## Local Development

### 1. Set Up Environment

```bash
cp .env.example .env
```

Fill in the required variables:

```bash
# Database
DATABASE_URL=postgresql://carbonledger:changeme@localhost:5432/carbonledger
POSTGRES_PASSWORD=changeme

# JWT
JWT_SECRET=your-long-random-secret-key-here
JWT_EXPIRY=7d

# Stellar (testnet)
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

### 2. Deploy Smart Contracts to Testnet

```bash
cd contracts

# Install Stellar CLI
cargo install stellar-cli

# Build contracts
cargo build --release --target wasm32-unknown-unknown

# Deploy each contract
stellar contract build --manifest-path carbon_credit/Cargo.toml
stellar contract deploy \
  --network testnet \
  --source <YOUR_ADMIN_KEY> \
  --wasm target/wasm32-unknown-unknown/release/carbon_credit.wasm

# Repeat for other contracts...
# Store contract IDs in .env:
CARBON_REGISTRY_CONTRACT_ID=CA...
CARBON_CREDIT_CONTRACT_ID=CA...
CARBON_MARKETPLACE_CONTRACT_ID=CA...
CARBON_ORACLE_CONTRACT_ID=CA...
```

### 3. Initialize Contracts

```bash
# Use soroban CLI to invoke initialize functions
stellar contract invoke \
  --network testnet \
  --id $CARBON_REGISTRY_CONTRACT_ID \
  --source <ADMIN_KEY> \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --oracle-address <ORACLE_ADDRESS>

# Repeat for other contracts...
```

### 4. Set Up PostgreSQL

```bash
# Create database
createdb carbonledger

# Run migrations
cd backend
npx prisma migrate deploy
npx prisma db seed  # (optional: seed with test data)
```

### 5. Start Backend

```bash
cd backend
npm install
npm run dev
# Backend runs on http://localhost:3001
```

### 6. Start Frontend

```bash
cd ../frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

## Testnet Deployment

### 1. Deploy Backend to Cloud (e.g., Fly.io, Railway, Heroku)

```bash
cd backend

# Using Fly.io:
flyctl launch
flyctl secrets set DATABASE_URL=... JWT_SECRET=... etc.
flyctl deploy
```

### 2. Deploy Frontend to Vercel

```bash
cd ../frontend

# Using Vercel CLI:
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard
NEXT_PUBLIC_API_URL=<your-backend-url>/api/v1
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

### 3. Verify Deployment

- Navigate to frontend URL
- Connect Freighter wallet (testnet)
- Try registering a project and minting credits

## Mainnet Deployment (Future)

1. **Security Audit**: Have contracts audited by professional team
2. **Contract Deployment**: Deploy contracts to Stellar mainnet
3. **Database Migration**: Run on production database with backups
4. **SSL/TLS**: Enable HTTPS on all endpoints
5. **Rate Limiting**: Implement rate limits on API endpoints
6. **Monitoring**: Set up alerts (Sentry, DataDog, etc.)
7. **Backup Strategy**: Daily database backups to S3 or similar

## Troubleshooting

### Soroban Tx Failures

Check ledger TTL and account sequence numbers:

```bash
stellar account info --network testnet <YOUR_ACCOUNT>
```

### Database Connection Issues

```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Contract Invocation Errors

Enable verbose logging:

```bash
export SOROBAN_LOG=debug
stellar contract invoke ...
```

## Monitoring & Logs

- **Backend**: Check server logs via cloud provider dashboard
- **Frontend**: Monitor Sentry or browser console errors
- **Database**: Enable query logging in PostgreSQL

```sql
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();
```

---

For production support, refer to [Stellar Docs](https://developers.stellar.org).
