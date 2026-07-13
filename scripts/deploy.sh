#!/bin/bash

# CarbonLedger Deployment Script
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}
ADMIN_KEY=${ADMIN_SECRET_KEY}
ORACLE_ADDRESS=${ORACLE_PUBLIC_KEY}
USDC_CONTRACT=${USDC_CONTRACT_ID}

if [ -z "$ADMIN_KEY" ] || [ -z "$ORACLE_ADDRESS" ]; then
  echo "Error: ADMIN_SECRET_KEY and ORACLE_PUBLIC_KEY must be set"
  exit 1
fi

echo "🚀 Deploying CarbonLedger to $NETWORK..."

# Step 1: Build contracts
echo "📦 Building smart contracts..."
cd contracts
cargo build --release --target wasm32-unknown-unknown
cd ..

# Step 2: Deploy each contract
echo "🛸 Deploying Carbon Registry..."
REGISTRY_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source $ADMIN_KEY \
  --wasm contracts/target/wasm32-unknown-unknown/release/carbon_registry.wasm | jq -r .id)

echo "  Registry ID: $REGISTRY_ID"

echo "🛸 Deploying Carbon Credit..."
CREDIT_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source $ADMIN_KEY \
  --wasm contracts/target/wasm32-unknown-unknown/release/carbon_credit.wasm | jq -r .id)

echo "  Credit ID: $CREDIT_ID"

echo "🛸 Deploying Carbon Marketplace..."
MARKETPLACE_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source $ADMIN_KEY \
  --wasm contracts/target/wasm32-unknown-unknown/release/carbon_marketplace.wasm | jq -r .id)

echo "  Marketplace ID: $MARKETPLACE_ID"

echo "🛸 Deploying Carbon Oracle..."
ORACLE_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source $ADMIN_KEY \
  --wasm contracts/target/wasm32-unknown-unknown/release/carbon_oracle.wasm | jq -r .id)

echo "  Oracle ID: $ORACLE_ID"

# Step 3: Initialize contracts
echo "⚙️  Initializing contracts..."

stellar contract invoke \
  --network $NETWORK \
  --id $REGISTRY_ID \
  --source $ADMIN_KEY \
  -- initialize \
  --admin $ADMIN_KEY \
  --oracle-address $ORACLE_ADDRESS

stellar contract invoke \
  --network $NETWORK \
  --id $CREDIT_ID \
  --source $ADMIN_KEY \
  -- initialize \
  --admin $ADMIN_KEY \
  --registry-contract $REGISTRY_ID

stellar contract invoke \
  --network $NETWORK \
  --id $MARKETPLACE_ID \
  --source $ADMIN_KEY \
  -- initialize \
  --admin $ADMIN_KEY \
  --credit-contract $CREDIT_ID \
  --usdc-token $USDC_CONTRACT

stellar contract invoke \
  --network $NETWORK \
  --id $ORACLE_ID \
  --source $ADMIN_KEY \
  -- initialize \
  --admin $ADMIN_KEY \
  --oracle-address $ORACLE_ADDRESS

# Step 4: Update .env
echo "📝 Updating .env..."
cat > .env.deployed << EOF
CARBON_REGISTRY_CONTRACT_ID=$REGISTRY_ID
CARBON_CREDIT_CONTRACT_ID=$CREDIT_ID
CARBON_MARKETPLACE_CONTRACT_ID=$MARKETPLACE_ID
CARBON_ORACLE_CONTRACT_ID=$ORACLE_ID
EOF

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Contract IDs:"
echo "  Registry:    $REGISTRY_ID"
echo "  Credit:      $CREDIT_ID"
echo "  Marketplace: $MARKETPLACE_ID"
echo "  Oracle:      $ORACLE_ID"
echo ""
echo "Add these to your .env file."
