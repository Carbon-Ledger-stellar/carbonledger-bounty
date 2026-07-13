# CarbonLedger Smart Contracts

Soroban smart contracts (Rust) for carbon credit tokenization on Stellar.

## Contracts

### carbon_registry
Central project registry. Developers register projects, verifiers approve them.

**Functions:**
- `initialize(admin, oracle_address)`
- `register_project(...) -> project_id`
- `verify_project(project_id)`
- `reject_project(project_id)`
- `suspend_project(project_id)`
- `get_project(project_id) -> CarbonProject`

### carbon_credit
Mint, track, and retire tokenized credits with unique serial numbers.

**Functions:**
- `initialize(admin, registry_contract)`
- `mint_credits(project_id, amount, serial_start, metadata_cid) -> batch_id`
- `retire_credits(benefactor, project_id, batch_id, amount, tx_hash) -> retirement_id`
- `get_credit_batch(batch_id) -> CreditBatch`
- `get_retirement_certificate(retirement_id) -> RetirementCertificate`

### carbon_marketplace
Secondary trading of carbon credits for USDC.

**Functions:**
- `initialize(admin, credit_contract, usdc_token)`
- `list_credits(seller, batch_id, amount, price_per_credit) -> listing_id`
- `delist_credits(listing_id)`
- `purchase_credits(buyer, listing_id, amount) -> tx_id`
- `bulk_purchase(buyer, purchases: Vec) -> tx_id`
- `get_active_listings() -> Vec<MarketListing>`

### carbon_oracle
Satellite monitoring data integration and benchmark pricing.

**Functions:**
- `initialize(admin, oracle_address)`
- `submit_monitoring_data(project_id, period, tonnes_verified, methodology_score, satellite_cid) -> record_id`
- `update_benchmark_price(methodology, vintage_year, price_per_credit)`
- `is_monitoring_current(project_id) -> bool`
- `get_benchmark_price(methodology, vintage_year) -> i128`

## Build

```bash
cargo build --release --target wasm32-unknown-unknown
```

## Deploy

```bash
stellar contract deploy \
  --network testnet \
  --source <ADMIN_KEY> \
  --wasm target/wasm32-unknown-unknown/release/carbon_credit.wasm
```

## Test

```bash
cargo test
```

## Documentation

See ARCHITECTURE.md for detailed design.
