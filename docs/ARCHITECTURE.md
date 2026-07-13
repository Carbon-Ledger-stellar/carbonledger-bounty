# CarbonLedger Architecture

## System Overview

CarbonLedger is a three-tier decentralized application:

```
┌─────────────────┐
│  Next.js 15     │  User interface (landing, marketplace, retire, audit)
│  Frontend       │  Freighter wallet integration, certificate generation
└────────┬────────┘
         │ HTTP (REST API)
┌────────▼──────────────────┐
│  NestJS Backend           │  Project registry, credit minting, marketplace
│  PostgreSQL Database      │  User auth, batch tracking, retirement records
└────────┬──────────────────┘
         │ Soroban SDK (invoke contracts)
┌────────▼──────────────────────────────────────────────┐
│  Stellar/Soroban Smart Contracts (Rust)              │
├──────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │ Registry     │ │ Credits      │ │ Marketplace  │  │
│ │ (Project &   │ │ (Mint,       │ │ (Buy, sell,  │  │
│ │ Verify)      │ │ Retire,      │ │ bulk trade)  │  │
│ │              │ │ Transfer)    │ │              │  │
│ └──────────────┘ └──────────────┘ └──────────────┘  │
│ ┌──────────────────────────────────┐                 │
│ │ Oracle (Monitoring & Prices)     │                 │
│ └──────────────────────────────────┘                 │
└──────────────────────────────────────────────────────┘
         │ USDC Token (Stellar native)
         └─ Pricing: stroops (1 USDC = 10^7 stroops)
```

## Smart Contract Layers

### 1. Carbon Registry Contract
**Purpose:** Central project registry with verification workflow

**Key Types:**
```rust
pub enum ProjectStatus {
  Pending,      // Awaiting verifier approval
  Verified,     // Approved; can mint credits
  Rejected,     // Failed verification
  Suspended,    // Fraud detected; credits frozen
  Completed,    // Project completed; no new credits
}

pub struct CarbonProject {
  pub project_id: String,
  pub name: String,
  pub methodology: String,        // "Verra VCS", "Gold Standard"
  pub country: String,
  pub project_type: String,       // "Reforestation", "DAC", "Biochar"
  pub verifier_address: Address,  // Trusted third party
  pub metadata_cid: String,       // IPFS link to project docs
  pub total_credits_issued: i128,
  pub total_credits_retired: i128,
  pub status: ProjectStatus,
  pub vintage_year: u32,          // e.g., 2024
  pub created_at: u64,
}
```

**Contract Functions:**

- `initialize(env, admin, oracle_address)` → Stores admin & oracle
- `register_project(env, developer, name, methodology, country, project_type, metadata_cid, vintage_year) -> String` → Returns project_id
- `verify_project(env, project_id)` → Requires verifier.require_auth(); updates status to Verified
- `reject_project(env, project_id, reason)` → Requires verifier; sets status to Rejected
- `suspend_project(env, project_id, reason)` → Requires admin; freezes credits
- `get_project(env, project_id) -> CarbonProject` → Read-only
- `list_projects(env) -> Vec<CarbonProject>` → Read-only; all projects

### 2. Carbon Credit Contract
**Purpose:** Mint, track, and irreversibly retire tokenized credits

**Key Types:**
```rust
pub enum CreditStatus {
  Active,           // Available for trading
  PartiallyRetired, // Some credits retired
  FullyRetired,     // All credits retired; immutable
  Suspended,        // Frozen due to fraud
}

pub struct CreditBatch {
  pub batch_id: String,
  pub project_id: String,
  pub vintage_year: u32,
  pub amount: i128,                    // Number of 1-tonne credits
  pub serial_start: u64,               // e.g., 1_000_000
  pub serial_end: u64,                 // e.g., 1_001_000 (inclusive)
  pub issued_at: u64,
  pub status: CreditStatus,
  pub metadata_cid: String,            // IPFS batch details
}

pub struct RetirementCertificate {
  pub retirement_id: String,
  pub credit_batch_id: String,
  pub project_id: String,
  pub amount: i128,                    // Tonnes retired
  pub retired_by: Address,
  pub benefactor: String,              // "Google Inc", "UK Gov"
  pub retired_at: u64,
  pub tx_hash: String,                 // Soroban tx proof
}
```

**Contract Functions:**

- `initialize(env, admin, registry_contract, usdc_token)` → Store references
- `mint_credits(env, project_id, amount, serial_start, metadata_cid) -> String` → Returns batch_id
  - Requires: Project is Verified
  - Validates: serial_start doesn't overlap existing batches
  - Effects: Creates CreditBatch with status Active
- `verify_serial_range(env, project_id, serial_start, serial_end) -> bool` → Check no overlap
- `transfer_credits(env, from, to, batch_id, amount)` → Transfer batch ownership
  - Requires: from.require_auth()
  - Validates: batch not Suspended or FullyRetired
- `retire_credits(env, retiree, benefactor, project_id, batch_id, amount) -> String` → Returns retirement_id
  - Requires: retiree.require_auth()
  - Validates: batch has sufficient Active credits
  - Effects: 
    - Creates RetirementCertificate (permanent record)
    - Decrements Active amount; updates status to PartiallyRetired or FullyRetired
    - Emits CreditRetired event
  - **CRITICAL:** No reversal function exists; retirement immutable
- `get_credit_batch(env, batch_id) -> CreditBatch` → Read-only
- `get_retirement_history(env, benefactor) -> Vec<RetirementCertificate>` → Read-only

**Serial Number Format:**
- Stored as u64 range (e.g., 1_000_000 to 1_001_000)
- Display format: `{PROJECT_ID}-{VINTAGE}-{SERIAL:06d}` (e.g., "PROJ-2024-001-000042")

### 3. Carbon Marketplace Contract
**Purpose:** Secondary trading of credits; price discovery

**Key Types:**
```rust
pub enum ListingStatus {
  Active,          // Available for purchase
  PartiallyFilled, // Partially sold
  Sold,            // All sold
  Delisted,        // Seller removed
}

pub struct MarketListing {
  pub listing_id: String,
  pub seller: Address,
  pub batch_id: String,
  pub project_id: String,
  pub amount_available: i128,       // Tonnes available
  pub price_per_credit: i128,       // In stroops
  pub vintage_year: u32,
  pub methodology: String,
  pub country: String,
  pub created_at: u64,
  pub status: ListingStatus,
}
```

**Contract Functions:**

- `initialize(env, admin, credit_contract, usdc_token)` → Store references
- `list_credits(env, seller, batch_id, amount, price_per_credit) -> String` → Returns listing_id
  - Requires: seller.require_auth(); balance check
- `delist_credits(env, listing_id)` → Requires seller auth
  - Returns credits to seller; sets status to Delisted
- `purchase_credits(env, buyer, listing_id, amount) -> String` → Returns transaction_id
  - Requires: buyer.require_auth()
  - Validates: listing Active or PartiallyFilled; amount ≤ available; USDC balance ≥ cost
  - Effects:
    - Transfers `amount * price_per_credit` USDC from buyer → seller
    - Transfers `amount` credits from seller → buyer
    - Updates listing status (Sold if empty, PartiallyFilled if remaining)
    - Emits CreditsTransferred event
  - Atomic: All-or-nothing (reverts if USDC transfer fails)
- `bulk_purchase(env, buyer, purchases: Vec<(listing_id, amount)>) -> String` → Returns transaction_id
  - Multi-listing purchase in single tx
  - Total USDC deducted once
- `get_active_listings(env) -> Vec<MarketListing>` → Read-only
- `get_listings_by_project(env, project_id) -> Vec<MarketListing>` → Read-only

**Pricing:**
- Prices stored in stroops (1 USDC = 10,000,000 stroops)
- Frontends display as: `price_stroops / 10_000_000` = USDC per tonne

### 4. Carbon Oracle Contract
**Purpose:** Monitoring data integration; price benchmarking; fraud detection

**Key Types:**
```rust
pub struct MonitoringData {
  pub project_id: String,
  pub period: String,              // "2024-Q1"
  pub tonnes_verified: i128,       // Via satellite imagery
  pub methodology_score: u32,      // 0-100 (quality rating)
  pub satellite_cid: String,       // IPFS link to imagery
  pub submitted_by: Address,       // Verifier
  pub submitted_at: u64,
}

pub struct BenchmarkPrice {
  pub methodology: String,          // "Verra VCS"
  pub vintage_year: u32,
  pub price_per_credit: i128,      // In stroops (avg market rate)
  pub updated_at: u64,
}
```

**Contract Functions:**

- `initialize(env, admin, oracle_address)` → Stores authorized oracle
- `submit_monitoring_data(env, project_id, period, tonnes_verified, methodology_score, satellite_cid) -> String` → Returns record_id
  - Requires: oracle.require_auth()
  - Validates: methodology_score ≤ 100; tonnes_verified > 0
  - Effects: Stores MonitoringData; updates latest_submission timestamp
- `update_benchmark_price(env, methodology, vintage_year, price_per_credit)` → Returns updated_at
  - Requires: oracle.require_auth()
  - Effects: Stores price with TTL (24 hours in ledger)
- `is_monitoring_current(env, project_id) -> bool` → Checks if monitoring ≤ 365 days old
- `get_benchmark_price(env, methodology, vintage_year) -> i128` → Read-only; returns stroops or error
- `flag_project(env, project_id, reason)` → Admin-only; triggers investigation
- `get_monitoring_data(env, project_id) -> Vec<MonitoringData>` → Read-only; history

**Freshness & Validation:**
- Monitoring data older than 365 days marked "stale"
- Methodology score < 70 triggers fraud warning
- Oracle can flag projects for manual review

---

## Backend (NestJS) Architecture

### Module Structure

```
src/
├── auth/              # JWT + wallet signature auth
├── projects/          # Project CRUD + verification workflow
├── credits/           # Batch minting + retirement
├── marketplace/       # Listing + purchase logic
├── retirements/       # Retirement history + certificates
├── oracle/            # Monitoring data ingestion
├── stats/             # Platform metrics aggregation
├── prisma.service.ts  # Database abstraction
└── app.module.ts
```

### Key Services

**AuthService:**
- JWT token generation (RS256 using Stellar keypair)
- Wallet signature verification
- Role enforcement (developer, corporation, verifier)

**ProjectsService:**
- `registerProject(dto)` → Validates metadata CID; calls contract; saves to DB
- `verifyProject(projectId)` → Calls registry contract; updates status
- `getProject(projectId)` → Reads from DB + contract for live balance
- `listProjects(filters)` → Query by methodology, country, status

**CreditsService:**
- `mintCredits(dto)` → Calls carbon_credit contract; prevents serial overlap
- `retireCredits(dto)` → Irreversible; creates RetirementRecord in DB
- `getBatch(batchId)` → Fetch from DB
- `getRetirementHistory(benefactor)` → List all retirements by benefactor

**MarketplaceService:**
- `createListing(dto)` → Calls marketplace contract; tracks in DB
- `purchaseCredits(dto)` → Validates USDC balance; calls contract atomically
- `bulkPurchase(dto)` → Multi-listing purchase
- `getListings(filters)` → Query by methodology, price range, vintage

**OracleService:**
- `submitMonitoring(dto)` → Calls oracle contract; stores in DB
- `getProjectStatus(projectId)` → Freshness check

**StatsService:**
- `getPlatformStats()` → Aggregates: total issued, retired, active projects, marketplace listings

### Database Models (Prisma)

```prisma
model CarbonProject {
  id String @id @default(cuid())
  projectId String @unique
  name String
  methodology String       // "Verra VCS", "Gold Standard"
  country String
  projectType String
  status String @default("Pending")
  vintageYear Int
  totalCreditsIssued Int @default(0)
  totalCreditsRetired Int @default(0)
  metadataCid String
  verifierAddress String
  ownerAddress String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  batches CreditBatch[]
  retirements RetirementRecord[]
  listings MarketListing[]
  monitoring MonitoringData[]
}

model CreditBatch {
  id String @id @default(cuid())
  batchId String @unique
  projectId String
  vintageYear Int
  amount Int                    // Total tonnes
  serialStart String            // "1_000_000"
  serialEnd String              // "1_001_000"
  status String @default("Active")
  metadataCid String
  issuedAt DateTime @default(now())

  project CarbonProject @relation(fields: [projectId], references: [projectId])
  retirements RetirementRecord[]
  listings MarketListing[]
}

model RetirementRecord {
  id String @id @default(cuid())
  retirementId String @unique
  batchId String
  projectId String
  amount Int
  retiredBy String              // Wallet address
  beneficiary String            // "Google Inc"
  retirementReason String
  vintageYear Int
  serialNumbers String[]
  txHash String
  retiredAt DateTime @default(now())

  batch CreditBatch @relation(fields: [batchId], references: [batchId])
  project CarbonProject @relation(fields: [projectId], references: [projectId])
}

model MarketListing {
  id String @id @default(cuid())
  listingId String @unique
  projectId String
  batchId String
  seller String
  amountAvailable Int
  pricePerCredit String          // In stroops
  vintageYear Int
  methodology String
  country String
  status String @default("Active")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project CarbonProject @relation(fields: [projectId], references: [projectId])
  batch CreditBatch @relation(fields: [batchId], references: [batchId])
}

model MonitoringData {
  id String @id @default(cuid())
  projectId String
  period String
  tonnesVerified Int
  methodologyScore Int
  satelliteCid String
  submittedBy String
  submittedAt DateTime @default(now())

  project CarbonProject @relation(fields: [projectId], references: [projectId])

  @@unique([projectId, period])
}

model User {
  id String @id @default(cuid())
  publicKey String @unique
  role String @default("corporation")  // "developer", "corporation", "verifier"
  createdAt DateTime @default(now())
}
```

---

## Frontend (Next.js 15) Architecture

### Page Structure

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Landing | Hero, platform stats, recent retirements feed |
| `/projects` | Projects Browser | Grid of all projects; filter by methodology/country/vintage |
| `/projects/[id]` | Project Detail | Full project info, credit batches, monitoring status |
| `/marketplace` | Marketplace | Listings grid; filter by price/vintage/methodology; search |
| `/buy` | Purchase Flow | Select credits, enter amount, review cost, confirm via Freighter |
| `/retire` | Retirement Form | Select credits, enter beneficiary, reason, generate certificate |
| `/retire/[id]` | Retirement Certificate | Public, shareable retirement proof with QR code |
| `/audit` | Audit Explorer | Public audit trail (no wallet required); serial lookup |
| `/dashboard` | User Portfolio | User's credits, history, balance |
| `/verify` | Verifier Workspace | Project verification queue (verifier only) |

### Component Hierarchy

```
App (Layout)
├── Header
│   ├── Logo
│   ├── Navigation
│   └── WalletButton (Freighter)
├── Page Content
│   ├── CreditCard (reusable)
│   ├── MarketplaceFilter
│   ├── RetirementCertificate
│   ├── ProvenanceTrail
│   ├── AuditExplorer
│   └── ...
└── Toast (notifications)
```

### Data Fetching Pattern (SWR)

```typescript
// useListings hook
const { data: listings, isLoading, error } = useSWR(
  `/api/v1/marketplace/listings?${qs.stringify(filters)}`,
  fetcher,
  { revalidateOnFocus: false, dedupingInterval: 60000 }
);
```

### Freighter Wallet Integration

```typescript
// Connect wallet
const walletKey = await connectFreighter();

// Sign transaction
const signedXdr = await signTransaction(unsignedXdr, "TESTNET");

// Invoke contract
const result = await invokeContract({
  contractId: MARKETPLACE_CONTRACT,
  method: "purchase_credits",
  args: [buyer, listingId, amount],
  signers: [walletKey],
});
```

### Design System

**Colors (Emerald/Charcoal):**
- Primary: `#10b981` (emerald)
- Dark: `#1f2937` (charcoal)
- Accent: `#06b6d4` (cyan)
- Neutral: `#6b7280` (gray)

**Typography:**
- Headings: Inter, 800 weight
- Body: Inter, 400 weight
- Mono: Courier New (for serial numbers)

---

## Data Flow: Purchase Flow Example

```
User clicks "Buy" on listing
  ↓
Frontend: /buy page loads listing details via GET /api/v1/marketplace/listings/:id
  ↓
User enters amount, clicks "Connect Wallet"
  ↓
Frontend: Calls connectFreighter() → returns wallet public key
  ↓
User clicks "Purchase"
  ↓
Frontend: Calls POST /api/v1/marketplace/purchase {listingId, amount, buyerKey}
  ↓
Backend: 
  - Validates listing exists & Active
  - Validates amount ≤ available
  - Constructs Soroban tx: carbon_marketplace::purchase_credits()
  - Returns unsigned XDR
  ↓
Frontend: Signs XDR with Freighter wallet
  ↓
Frontend: Submits signed XDR to Stellar network
  ↓
Backend: Polls for tx confirmation
  ↓
Backend: Parses tx result; updates DB (MarketListing status, creates User balance entry)
  ↓
Backend: Returns success + txHash
  ↓
Frontend: Shows confirmation toast; redirects to /retire?batch={batchId}
```

---

## Security Model

### On-Chain Guarantees
1. **Serial Uniqueness:** Enforced by serial_start/serial_end non-overlap check
2. **Retirement Immutability:** No reversal function exists in contract code
3. **Double-Spending Prevention:** Credits transferred atomically with USDC payment
4. **Access Control:** All state-changing functions require .require_auth() on appropriate signer

### Backend Safeguards
1. **JWT Validation:** All protected endpoints verify token against Stellar keypair
2. **Role Enforcement:** Middleware checks role (developer, corporation, verifier)
3. **Idempotency:** Critical operations (retire, purchase) check for duplicates via retirementId
4. **Audit Logging:** All state changes logged to PostgreSQL with timestamp + actor

### Frontend Protections
1. **Wallet Validation:** Freighter signature verification before signing tx
2. **Network Mismatch Detection:** Check Freighter network matches config
3. **Amount Validation:** User input validated client-side before submission
4. **Public Pages:** Audit & lookup pages work without wallet (no private data exposed)

---

## Deployment Strategy

### Testnet Flow
1. Deploy contracts via `stellar contract build && stellar contract deploy` → get IDs
2. Update `.env` with contract addresses
3. Seed contracts with mock data (projects, batches, listings)
4. Backend runs migrations: `npx prisma migrate deploy`
5. Backend & frontend start; users connect Freighter to testnet

### Mainnet Flow (Future)
1. Security audit of contracts + backend
2. Deploy contracts to mainnet
3. Run database migration with production-grade backup
4. Scale to multi-region deployment (load balancer, read replicas)
5. Enable rate limiting, DDoS protection

---

## References

- [Stellar Docs](https://developers.stellar.org)
- [Soroban Docs](https://soroban.stellar.org)
- [Freighter Docs](https://www.freighter.app)
- [NestJS Docs](https://docs.nestjs.com)
- [Next.js Docs](https://nextjs.org/docs)
