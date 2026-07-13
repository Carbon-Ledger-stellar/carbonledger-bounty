# CarbonLedger — Tokenized Carbon Credit Marketplace on Stellar

**A verified, decentralized carbon credit marketplace enabling carbon offset projects to mint tokenized RWAs on Soroban, with corporations purchasing and permanently retiring credits for carbon offset claims.**

## Tagline

> Tokenize, trade, and retire carbon credits with absolute provenance on Stellar.

## Quick Links

- **Architecture:** [See docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Smart Contracts:** [See contracts/README.md](contracts/README.md)
- **Backend API:** [See backend/README.md](backend/README.md)
- **Frontend:** [See frontend/README.md](frontend/README.md)

## Repo Structure

```
carbonledger-bounty/
├── contracts/                  # Soroban smart contracts (Rust)
│   ├── Cargo.toml
│   ├── carbon_registry/        # Project registry & verification
│   ├── carbon_credit/          # Credit minting & retirement
│   ├── carbon_marketplace/     # Secondary trading
│   └── carbon_oracle/          # Satellite monitoring & price feeds
├── backend/                    # NestJS API server
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma       # Database models
│   └── src/
│       ├── auth/               # JWT + wallet auth
│       ├── projects/           # Project registration
│       ├── credits/            # Batch minting & retirement
│       ├── marketplace/        # Listing management
│       ├── retirements/        # Retirement history
│       ├── oracle/             # Monitoring updates
│       └── stats/              # Platform metrics
├── frontend/                   # Next.js 15 application
│   ├── package.json
│   ├── app/
│   │   ├── page.tsx            # Landing & explorer
│   │   ├── projects/           # Projects directory
│   │   ├── marketplace/        # Trading interface
│   │   ├── buy/                # Purchase flow
│   │   ├── retire/             # Retirement UI
│   │   ├── audit/              # Public audit trail
│   │   ├── dashboard/          # User dashboard
│   │   └── verify/             # Verifier workspace
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Utilities (Freighter, Soroban, API)
│   └── styles/                 # Design system
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── API.md
└── scripts/                    # Build & deployment helpers
```

## Features

### ✅ Core Functionality

- **Project Registration:** Carbon developers register projects after third-party verification (Verra, Gold Standard)
- **Credit Minting:** Projects mint tokenized carbon credits with unique serial numbers (prevents double-counting)
- **Marketplace Trading:** Corporations and investors buy credits using USDC; prices determined by methodology + vintage year
- **Irreversible Retirement:** Credits permanently burned to claim carbon offsets; immutable on-chain record prevents re-selling
- **Provenance Trail:** Full audit history from mint → transfer → retirement with satellite-verified monitoring data
- **Oracle Integration:** Monitoring data from satellite sources validates credit claims; prices benchmarked against real-world carbon markets

### 🎯 Key Guarantees

- **No Double-Counting:** Serial number registry on-chain prevents same credit from being issued twice
- **Permanent Retirement:** Retirement is cryptographically irreversible; retired credits cannot be transferred or un-retired
- **Verified Projects:** Only third-party verifiers can approve projects; monitoring data refreshed annually
- **Full Transparency:** Public audit explorer shows every mint, trade, and retirement event

## Quick Start

### Prerequisites

- Node.js 18+ (backend & frontend)
- Rust & Cargo (smart contracts)
- PostgreSQL 14+ (database)
- Freighter wallet (browser extension)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Carbon-Ledger-stellar/carbonledger-bounty.git
cd carbonledger-bounty

# Setup environment
cp .env.example .env
# Edit .env with your keys and network settings

# 1. Deploy smart contracts to testnet
cd contracts
cargo install stellar-cli
stellar contract build
stellar contract deploy --network testnet  # (generates contract IDs)
# Update .env with contract addresses

# 2. Start backend
cd ../backend
npm install
npx prisma migrate deploy
npm run dev  # Runs on http://localhost:3001

# 3. Start frontend
cd ../frontend
npm install
npm run dev  # Runs on http://localhost:3000
```

### Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production deployment to Stellar testnet/mainnet.

## Smart Contract Modules

| Contract | Purpose | Key Functions |
|----------|---------|----------------|
| `carbon_registry` | Project registration & verification | `register_project()`, `verify_project()`, `get_project()` |
| `carbon_credit` | Mint, track, retire credits | `mint_credits()`, `retire_credits()`, `get_retirement_history()` |
| `carbon_marketplace` | List, buy, sell credits | `list_credits()`, `purchase_credits()`, `bulk_purchase()` |
| `carbon_oracle` | Monitoring data & price feeds | `submit_monitoring()`, `get_credit_price()` |

## API Endpoints

### Projects
- `GET /api/v1/projects` — Browse all projects
- `POST /api/v1/projects/register` — Register new project (developer only)
- `PUT /api/v1/projects/:id/verify` — Verify project (verifier only)

### Credits & Trading
- `GET /api/v1/marketplace/listings` — Browse marketplace
- `POST /api/v1/marketplace/purchase` — Buy credits
- `GET /api/v1/credits/batch/:id` — Get batch info
- `POST /api/v1/credits/retire` — Retire credits (irreversible)
- `GET /api/v1/credits/serial/:serial` — Lookup by serial number

### Auditing
- `GET /api/v1/retirements` — Retirement history
- `GET /api/v1/retirements/:id` — Get retirement certificate
- `GET /api/v1/stats/platform` — Platform metrics

### Oracle
- `POST /api/v1/oracle/monitoring` — Submit satellite data (verifier only)
- `GET /api/v1/oracle/status/:projectId` — Monitoring freshness

## Design

### Glassmorphism Dashboard
- Emerald/green accent colors (carbon theme)
- Charcoal backgrounds with frosted glass panels
- Real-time transaction status tracking
- Responsive grid layouts for mobile/desktop

### User Flows

**Project Developer:**
1. Register project (name, location, methodology, vintage year)
2. Await third-party verification
3. Mint credit batch (automatically gets serial numbers)
4. Option: List on marketplace or hold for retirement claims

**Corporate Buyer:**
1. Browse marketplace by methodology/vintage/price
2. Purchase credits using USDC (Freighter wallet)
3. Option: Trade on marketplace or retire immediately
4. Generate shareable retirement certificate with beneficiary name & QR code

**Public Auditor:**
1. Search any serial number → trace mint → retirement
2. Verify monitoring data freshness (satellite imagery links)
3. Export audit report (CSV)

## Key Dependencies

### Backend
- `@nestjs/core` (framework)
- `@prisma/client` (ORM)
- `@stellar/stellar-sdk` (Stellar integration)
- `jsonwebtoken` (JWT auth)

### Frontend
- `next` (framework)
- `@stellar/freighter-api` (wallet)
- `@stellar/stellar-sdk` (Stellar SDK)
- `swr` (data fetching)
- `jspdf` + `html2canvas` (PDF generation)

### Smart Contracts
- `soroban-sdk` (latest stable)

## Security & Compliance

- **Serial Number Uniqueness:** Enforced on-chain; overlap detection prevents double-counting
- **Irreversible Retirement:** Retirement state is cryptographically immutable
- **JWT Auth:** Backend uses RS256 signatures (Stellar keypair validation)
- **Role-Based Access:** Developers can only mint from their projects; verifiers can only approve assigned projects
- **Audit Trail:** All state transitions logged to PostgreSQL + on-chain storage

## Development Notes

### Adding a New Feature

1. **Contracts:** Add functions to `/contracts/carbon_*/src/lib.rs`; update types in types module
2. **Backend:** Add endpoint in `/backend/src/*/controller.ts`; logic in service; update Prisma schema if needed
3. **Frontend:** Add page or component; integrate via `/lib/api.ts` using SWR

### Testing

```bash
# Smart contracts
cd contracts
cargo test

# Backend
cd ../backend
npm run test

# Frontend
cd ../frontend
npm run test
```

## Contributing

This is a reference implementation for the Stellar Community Challenge. Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

---

**Built with ❤️ on Stellar.**
