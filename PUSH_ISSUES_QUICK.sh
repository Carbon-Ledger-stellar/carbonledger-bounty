#!/bin/bash
#
# Quick script to push 50 GitHub issues to CarbonLedger repository
# Usage: ./PUSH_ISSUES_QUICK.sh
#

set -e

echo "=================================="
echo "GitHub Issues Batch Creator"
echo "CarbonLedger Bounty Project"
echo "=================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ ERROR: Python 3 not found"
    echo "Please install Python 3.7+ and try again"
    exit 1
fi

# Check if requests module is installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "📦 Installing required Python package: requests"
    pip install requests
fi

echo ""
echo "=================================="
echo "Configuration"
echo "=================================="
echo ""

# Check for GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not set"
    echo ""
    echo "Get your token from: https://github.com/settings/tokens"
    echo ""
    echo "Set it with:"
    echo "  export GITHUB_TOKEN='ghp_xxxxxxxxxxxxxxxxxxxx'"
    echo ""
    read -p "Enter your GitHub token (or press Ctrl+C to exit): " token
    export GITHUB_TOKEN="$token"
fi

# Optional: Override repository
GITHUB_REPO="${GITHUB_REPO:-carbon-ledger-stellar/carbonledger-bounty}"

echo "Repository: $GITHUB_REPO"
echo "Token: ${GITHUB_TOKEN:0:10}..." (hidden)"
echo ""

# Confirm before proceeding
read -p "Ready to create 50 GitHub issues? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

echo ""
echo "=================================="
echo "Creating Issues..."
echo "=================================="
echo ""

# Export variables for Python script
export GITHUB_REPO

# Run the Python script
python3 scripts/create_issues_graphql.py

echo ""
echo "=================================="
echo "✅ Done!"
echo "=================================="
echo ""
echo "View your issues at:"
echo "https://github.com/$GITHUB_REPO/issues"
echo ""
