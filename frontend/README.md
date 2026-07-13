# CarbonLedger Frontend

Next.js 15 web application for CarbonLedger carbon credit marketplace.

## Setup

```bash
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`

## Pages

- `/` - Landing page with platform statistics
- `/projects` - Browse all carbon projects
- `/projects/[id]` - Project detail page
- `/marketplace` - Tradeable carbon credits marketplace
- `/buy?listing=<id>` - Purchase credits flow
- `/retire?batch=<id>` - Retire credits (generate certificate)
- `/retire/[id]` - Public retirement certificate view
- `/audit` - Public audit trail explorer
- `/verify` - Verifier dashboard (TBD)
- `/dashboard` - User portfolio (TBD)

## Components

- `CreditCard` - Listing/project card component
- `MarketplaceFilter` - Filtering controls
- `RetirementCertificate` - Certificate display
- `Toast` - Notification system
- `TransactionStatus` - Tx status tracker

## Configuration

Environment variables in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

## Wallet Integration

Freighter wallet required for transactions. Install from https://freighter.app
