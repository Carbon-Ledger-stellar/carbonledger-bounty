# CarbonLedger Quick Start Guide

## 5-Minute Setup

### 1. Prerequisites

- Node.js 18+
- Rust & Cargo
- PostgreSQL 14+
- Freighter wallet extension

### 2. Clone & Setup

```bash
cd carbonledger-bounty
cp .env.example .env

# Edit .env with Stellar testnet details:
# ADMIN_SECRET_KEY=your_stellar_secret
# ORACLE_PUBLIC_KEY=your_oracle_address
```

### 3. Deploy Contracts

```bash
cd contracts

# Install Stellar CLI
cargo install stellar-cli

# Build & deploy
cargo build --release --target wasm32-unknown-unknown

stellar contract build --manifest-path carbon_credit/Cargo.toml
stellar contract deploy --network testnet --source <ADMIN_KEY> --wasm ...

# Save contract IDs to .env
```

### 4. Start Database

```bash
# Using Docker (recommended)
docker-compose up postgres

# Or local PostgreSQL
createdb carbonledger
psql carbonledger -c "CREATE USER carbonledger WITH PASSWORD 'changeme';"
psql carbonledger -c "GRANT ALL PRIVILEGES ON DATABASE carbonledger TO carbonledger;"
```

### 5. Start Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev

# Backend running: http://localhost:3001
```

### 6. Start Frontend

```bash
cd ../frontend
npm install
npm run dev

# Frontend running: http://localhost:3000
```

### 7. Test the System

1. Open `http://localhost:3000` in browser
2. Connect Freighter wallet (testnet)
3. Try:
   - Browse projects at `/projects`
   - View marketplace at `/marketplace`
   - Register a new project (POST to backend)
   - Purchase and retire credits

## Troubleshooting

### Port Already in Use

```bash
# Find process on port 3001 or 3000
lsof -i :3001
kill -9 <PID>
```

### Database Connection Error

```bash
# Check PostgreSQL is running
psql -U carbonledger -d carbonledger -c "SELECT 1"

# Check DATABASE_URL in .env is correct
```

### Freighter Connection Issues

1. Install Freighter from https://freighter.app
2. Switch to testnet in Freighter settings
3. Fund testnet account: https://developers.stellar.org/docs/build/apps-and-loans/stellar-test-network#fund-your-account

## Next Steps

- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design
- Check [DEPLOYMENT.md](docs/DEPLOYMENT.md) for production setup
- Review smart contracts in `contracts/*/src/lib.rs`
- Explore API endpoints in `backend/README.md`
- Customize frontend in `frontend/app/`

## Key Files

- **Contracts:** `contracts/carbon_*/src/lib.rs` (Rust/Soroban)
- **Backend:** `backend/src/*/` (NestJS)
- **Frontend:** `frontend/app/` (Next.js 15)
- **Database:** `backend/prisma/schema.prisma` (Prisma schema)
- **Config:** `.env.example` (environment variables)

## Support

- [Stellar Docs](https://developers.stellar.org)
- [Soroban Docs](https://soroban.stellar.org)
- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)

---

Built on Stellar. 🌍
