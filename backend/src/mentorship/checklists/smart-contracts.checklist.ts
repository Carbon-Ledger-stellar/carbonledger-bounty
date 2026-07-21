import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for smart-contract bounties.
 * 10 items covering correctness, tests, docs, style, and security.
 */
export const SMART_CONTRACTS_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'smart-contracts',
  version: '1.0.0',
  estimatedReviewMinutes: 60,
  minimumPassingScore: 75,
  items: [
    {
      id: 'sc-01',
      category: 'Correctness',
      criterion: 'Logic correctness',
      description:
        'All on-chain logic matches the bounty specification. Edge cases (zero amounts, overflow, underflow) are handled.',
      required: true,
      weight: 5,
    },
    {
      id: 'sc-02',
      category: 'Correctness',
      criterion: 'No unintended state mutations',
      description:
        'Functions that should be read-only do not modify contract state. Storage writes are intentional and documented.',
      required: true,
      weight: 5,
    },
    {
      id: 'sc-03',
      category: 'Tests',
      criterion: 'Unit test coverage ≥ 90%',
      description:
        'All public entry points have unit tests. Coverage report is included or linked in the PR description.',
      required: true,
      weight: 5,
    },
    {
      id: 'sc-04',
      category: 'Tests',
      criterion: 'Integration / scenario tests',
      description:
        'At least one end-to-end scenario test covers the happy path and at least one failure path.',
      required: true,
      weight: 4,
    },
    {
      id: 'sc-05',
      category: 'Security',
      criterion: 'No reentrancy or cross-contract call vulnerabilities',
      description:
        'External calls are placed after state updates (checks-effects-interactions). Untrusted callers are validated.',
      required: true,
      weight: 5,
    },
    {
      id: 'sc-06',
      category: 'Security',
      criterion: 'Authorization checks on all privileged functions',
      description:
        'Minting, retiring, and admin operations verify the caller\'s address or role before proceeding.',
      required: true,
      weight: 5,
    },
    {
      id: 'sc-07',
      category: 'Security',
      criterion: 'Integer arithmetic safety',
      description:
        'All arithmetic uses checked or saturating operations. No silent overflow/underflow possible.',
      required: true,
      weight: 4,
    },
    {
      id: 'sc-08',
      category: 'Documentation',
      criterion: 'All public functions have doc comments',
      description:
        'Every pub fn includes a /// doc comment explaining purpose, parameters, return value, and errors.',
      required: true,
      weight: 3,
    },
    {
      id: 'sc-09',
      category: 'Style',
      criterion: 'Passes `cargo clippy` without warnings',
      description:
        '`cargo clippy -- -D warnings` exits 0. Idiomatic Rust patterns are used throughout.',
      required: true,
      weight: 3,
    },
    {
      id: 'sc-10',
      category: 'Style',
      criterion: 'Formatted with `cargo fmt`',
      description:
        '`cargo fmt --check` exits 0. No hand-formatted deviations from the project style.',
      required: false,
      weight: 2,
    },
  ],
};
