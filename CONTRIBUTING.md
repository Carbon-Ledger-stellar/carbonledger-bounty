# Contributing to Carbon Ledger Bounty

Thank you for your interest in contributing! This document outlines the process for participating in Carbon Ledger bounties and contributing to the platform.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Install dependencies**: `npm install` (or `yarn`)
3. **Create a branch**: `git checkout -b feat/your-feature-name`

## Bounty Workflow

### Claiming a Bounty
1. Find an open bounty issue labeled `bounty`
2. Comment `/claim` on the issue to reserve it
3. You have 72 hours to submit a PR once claimed

### Submitting Your Work
1. Ensure your code follows the existing style conventions
2. Write or update tests as needed
3. Run `npm test` to verify all tests pass
4. Submit a PR referencing the issue number (e.g., `Fixes #22`)

### PR Review Process
- All PRs require at least one reviewer approval
- CI checks must pass (linting, tests, build)
- Bounty PRs are reviewed within 48 hours

## Development Guidelines

### Code Style
- **TypeScript**: Follow the existing Prettier and ESLint configurations
- **Commits**: Use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`
- **Branch naming**: `feat/description`, `fix/description`, `docs/description`

### Testing
- Write unit tests for all new functionality
- Integration tests for bounty system features
- Run `npm test -- --coverage` before submitting

### Documentation
- Update relevant docs when adding or changing features
- Document new environment variables in `.env.example`
- Add JSDoc comments for public APIs

## Bounty Rewards

- Rewards are paid in XLM (Stellar Lumens) upon PR merge
- Payment is processed within 7 days of merge
- Bounty amounts are specified in each issue

## Community

- Be respectful and constructive in all interactions
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md)
- Ask questions in issues or discussions

## Questions?

Open a discussion or comment on the relevant issue. We're here to help!

---

*This contributing guide is part of the Carbon Ledger Bounty System.*
