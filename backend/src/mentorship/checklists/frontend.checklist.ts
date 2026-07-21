import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for frontend bounties.
 * 10 items covering correctness, accessibility, tests, docs, style, and security.
 */
export const FRONTEND_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'frontend',
  version: '1.0.0',
  estimatedReviewMinutes: 45,
  minimumPassingScore: 75,
  items: [
    {
      id: 'fe-01',
      category: 'Correctness',
      criterion: 'Matches design / acceptance criteria',
      description:
        'UI matches the provided mockup or written spec. All user-facing text, labels, and flows are correct.',
      required: true,
      weight: 5,
    },
    {
      id: 'fe-02',
      category: 'Correctness',
      criterion: 'Responsive layout on mobile and desktop',
      description:
        'Layout is verified at 375 px (mobile), 768 px (tablet), and 1280 px (desktop). No overflow or truncation.',
      required: true,
      weight: 4,
    },
    {
      id: 'fe-03',
      category: 'Accessibility',
      criterion: 'Lighthouse accessibility score ≥ 90',
      description:
        'Run `next build && npx lighthouse`. Score must be ≥ 90. Include screenshot in PR.',
      required: true,
      weight: 4,
    },
    {
      id: 'fe-04',
      category: 'Accessibility',
      criterion: 'Keyboard navigability and ARIA labels',
      description:
        'All interactive elements are reachable by Tab key. Images have alt text. Form fields have associated labels.',
      required: true,
      weight: 4,
    },
    {
      id: 'fe-05',
      category: 'Tests',
      criterion: 'Component unit tests present',
      description:
        'New/modified components have at least one unit test using the project\'s test runner (Jest / RTL).',
      required: true,
      weight: 4,
    },
    {
      id: 'fe-06',
      category: 'Tests',
      criterion: 'No broken E2E flows',
      description:
        'Manually verified: the primary user flow (wallet connect → action → success state) completes without errors.',
      required: true,
      weight: 5,
    },
    {
      id: 'fe-07',
      category: 'Security',
      criterion: 'No XSS vectors (no dangerouslySetInnerHTML with unsanitized input)',
      description:
        'User-supplied data is never injected as raw HTML. External URLs are validated before rendering.',
      required: true,
      weight: 5,
    },
    {
      id: 'fe-08',
      category: 'Security',
      criterion: 'Wallet interaction uses Freighter API correctly',
      description:
        'Private keys are never logged or stored. Freighter API calls are wrapped in try/catch with user feedback.',
      required: true,
      weight: 5,
    },
    {
      id: 'fe-09',
      category: 'Documentation',
      criterion: 'Component props documented (JSDoc or TypeScript types)',
      description:
        'All exported components have typed props. Non-obvious props include a JSDoc description.',
      required: true,
      weight: 3,
    },
    {
      id: 'fe-10',
      category: 'Style',
      criterion: 'No ESLint errors; follows project conventions',
      description:
        '`npm run lint` exits 0. Follows the glassmorphism design system (emerald/green accents, charcoal backgrounds).',
      required: false,
      weight: 2,
    },
  ],
};
