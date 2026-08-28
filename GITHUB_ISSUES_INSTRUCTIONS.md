# GitHub Issues Batch Creation Guide

This guide explains how to create 50 GitHub issues for the CarbonLedger bounty project.

## Issues Overview

50 issues organized by area:
- **Smart Contracts (15 issues)**: Reentrancy guards, RBAC, escrow, pricing, batch operations
- **Backend (12 issues)**: JWT refresh, document upload, pagination, certificates, rate limiting
- **Frontend (12 issues)**: Project browser, marketplace, audit explorer, dashboard, wallet integration
- **UI/UX (8 issues)**: Glassmorphism design, education tooltips, dark mode, accessibility
- **Documentation (3 issues)**: API docs, smart contract guide, component documentation, deployment runbook

## Prerequisites

1. **GitHub Personal Access Token**
   - Go to https://github.com/settings/tokens
   - Create new token (classic)
   - Required scopes: `repo` (full control of private repositories)
   - Copy the token

2. **Python 3.7+** installed
   - Check: `python3 --version`

3. **Repository Access**
   - You must have write access to the GitHub repository
   - Default: `carbon-ledger-stellar/carbonledger-bounty`

## Method 1: Using GitHub Actions (Easiest)

### Steps:

1. **Create Repository Secret**
   - Go to: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GITHUB_TOKEN`
   - Value: (paste your PAT from prerequisites)
   - Click "Add secret"

2. **Trigger Workflow**
   - Go to: Actions → "Create GitHub Issues Batch"
   - Click "Run workflow"
   - Branch: `main`
   - Issue file: `GITHUB_ISSUES_BATCH.md` (default)
   - Click "Run workflow"

3. **Monitor Progress**
   - Watch the workflow run in real-time
   - Logs show each issue created

**Advantages:**
- No local setup needed
- Runs in cloud
- Automatic execution
- Can schedule recurring runs

---

## Method 2: Using Python Script (Local)

### Steps:

1. **Set Environment Variables**

   **On Linux/macOS:**
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
   export GITHUB_REPO="carbon-ledger-stellar/carbonledger-bounty"
   ```

   **On Windows (PowerShell):**
   ```powershell
   $env:GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
   $env:GITHUB_REPO = "carbon-ledger-stellar/carbonledger-bounty"
   ```

2. **Install Dependencies**
   ```bash
   pip install requests
   ```

3. **Run Script**
   ```bash
   cd carbonledger-bounty
   python3 scripts/create_issues_graphql.py
   ```

**Output:**
```
Creating 50 GitHub issues...
Repository: carbon-ledger-stellar/carbonledger-bounty
======================================================================
[1/50] Add Reentrancy Guard to Carbon Credit Contract... ✓ (#123)
[2/50] Implement Serial Number Uniqueness Validation... ✓ (#124)
[3/50] Add Batch Retirement with Burn Verification... ✓ (#125)
...
======================================================================

Summary:
  ✓ Successful: 50
  ✗ Failed: 0
  Total: 50
```

---

## Method 3: Manual via GitHub Web UI

For creating issues one-at-one:

1. **Go to Issues**
   - Navigate to: https://github.com/carbon-ledger-stellar/carbonledger-bounty/issues

2. **Click "New issue"**

3. **Fill in Details**
   - Title: (from GITHUB_ISSUES_BATCH.md)
   - Description: (copy body section)
   - Labels: (select from list)

4. **Click "Submit new issue"**

**Note:** This method is manual and tedious for 50 issues; only use for testing.

---

## Troubleshooting

### Error: "GITHUB_TOKEN environment variable not set"

**Solution:**
- Ensure token is exported to environment
- Verify token in GitHub settings (not revoked or expired)
- Check token has `repo` scope

### Error: "Repository not found"

**Solution:**
- Verify repository path: `owner/repo`
- Check you have access to the repository
- Ensure no typos in GITHUB_REPO

### Error: "401 Unauthorized"

**Solution:**
- Token may be revoked or expired
- Generate a new token at https://github.com/settings/tokens
- Ensure token has sufficient scopes

### Error: "Rate limit exceeded"

**Solution:**
- GitHub limits API calls: 5,000 per hour per token
- Wait 1 hour and retry
- Script automatically throttles requests with 0.3s delay

### Issues created but labels missing

**Solution:**
- Labels must exist in the repository first
- Create labels manually in: Settings → Labels
- Required labels: `smart-contract`, `backend`, `frontend`, `ui/ux`, `design`, `documentation`, `security`, `auth`, `performance`, etc.

---

## Creating Labels in Bulk

### Script to Create Missing Labels

```bash
#!/bin/bash

GITHUB_TOKEN="your_token"
REPO="carbon-ledger-stellar/carbonledger-bounty"

labels=(
  "smart-contract"
  "security"
  "soroban"
  "carbon-registry"
  "validation"
  "carbon-credit"
  "batch-operations"
  "carbon-marketplace"
  "access-control"
  "audit"
  "logging"
  "transfer"
  "carbon-oracle"
  "pricing"
  "escrow"
  "deployment"
  "upgradability"
  "workflow"
  "expiration"
  "fractional"
  "emergency"
  "backend"
  "auth"
  "file-upload"
  "marketplace"
  "pagination"
  "credits"
  "certificates"
  "rate-limiting"
  "oracle"
  "data-pipeline"
  "search"
  "performance"
  "logging"
  "monitoring"
  "cors"
  "database"
  "migrations"
  "wallet"
  "frontend"
  "projects"
  "filtering"
  "trading"
  "pdf-export"
  "explorer"
  "dashboard"
  "user-profile"
  "realtime"
  "transactions"
  "mobile"
  "responsive"
  "design"
  "ui"
  "components"
  "ui/ux"
  "education"
  "onboarding"
  "theme"
  "accessibility"
  "calculator"
  "flow"
  "loading"
  "ux-improvement"
  "error-handling"
  "ux"
  "audit"
  "documentation"
  "api"
  "openapi"
  "guide"
)

for label in "${labels[@]}"; do
  curl -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$label\", \"color\": \"0366d6\"}" \
    "https://api.github.com/repos/$REPO/labels"
  sleep 0.2
done
```

---

## Verifying Issues Created

### Check via GitHub Web

1. Go to: https://github.com/carbon-ledger-stellar/carbonledger-bounty/issues
2. You should see 50 new issues with labels

### Check via API

```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/carbon-ledger-stellar/carbonledger-bounty/issues \
  | jq 'length'
```

---

## Modifying Issues Before Creation

To customize issues before creation:

1. **Edit GITHUB_ISSUES_BATCH.md**
   - Modify title, body, or labels
   - Save file

2. **Run script again**
   - New issues will be created with modifications
   - Existing issues won't be duplicated (handled by GitHub)

---

## Adding More Issues Later

To add additional issues:

1. **Append to ISSUES_DATA in create_issues_graphql.py**
   - Add new issue dictionary to the list
   - Follow same format as existing issues

2. **Run script**
   ```bash
   python3 scripts/create_issues_graphql.py
   ```

---

## Scheduling Recurring Issue Creation

### Using GitHub Actions Cron

Edit `.github/workflows/create-issues.yml`:

```yaml
on:
  schedule:
    - cron: '0 0 1 * *'  # First day of each month at midnight UTC
  workflow_dispatch:
```

---

## Best Practices

1. **Test with 1-2 issues first**
   - Modify script to create only 1-2 issues
   - Verify labels, format, and content correct

2. **Backup original file**
   ```bash
   cp GITHUB_ISSUES_BATCH.md GITHUB_ISSUES_BATCH.md.backup
   ```

3. **Review issues after creation**
   - Check titles, descriptions, and labels
   - Ensure no duplicates or formatting issues

4. **Archive old issues**
   - Once completed, issues can be closed/archived
   - Keep for reference in project history

---

## Questions or Issues?

If problems arise:

1. Check this troubleshooting section
2. Review GitHub API documentation: https://docs.github.com/en/rest
3. Check GitHub Actions documentation: https://docs.github.com/en/actions

---

**Happy issue creating!** 🚀
