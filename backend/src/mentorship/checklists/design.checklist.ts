import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for design bounties (UI/UX, visual design, prototypes).
 * 10 items covering correctness, accessibility, assets, and style.
 */
export const DESIGN_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'design',
  version: '1.0.0',
  estimatedReviewMinutes: 40,
  minimumPassingScore: 75,
  items: [
    {
      id: 'des-01',
      category: 'Correctness',
      criterion: 'Design matches acceptance criteria',
      description:
        'All screens, states, and interactions specified in the bounty are present in the deliverable.',
      required: true,
      weight: 5,
    },
    {
      id: 'des-02',
      category: 'Correctness',
      criterion: 'Responsive / adaptive layouts provided',
      description:
        'Designs cover at least mobile (375 px), tablet (768 px), and desktop (1280 px) breakpoints.',
      required: true,
      weight: 4,
    },
    {
      id: 'des-03',
      category: 'Correctness',
      criterion: 'Interactive states are designed (hover, focus, disabled, error)',
      description:
        'Buttons, inputs, and links show all relevant states. Loading and empty states are included.',
      required: true,
      weight: 4,
    },
    {
      id: 'des-04',
      category: 'Accessibility',
      criterion: 'Colour contrast ratio ≥ 4.5:1 (WCAG AA)',
      description:
        'Text and interactive element foreground/background contrast is verified with a contrast checker.',
      required: true,
      weight: 4,
    },
    {
      id: 'des-05',
      category: 'Accessibility',
      criterion: 'Focus order and tab flow documented',
      description:
        'A numbered overlay or annotation shows the expected keyboard tab order for each screen.',
      required: false,
      weight: 3,
    },
    {
      id: 'des-06',
      category: 'Style',
      criterion: 'Follows CarbonLedger design system',
      description:
        'Uses the glassmorphism style: emerald/green accents, charcoal backgrounds, frosted glass panels. No off-brand colours or fonts.',
      required: true,
      weight: 4,
    },
    {
      id: 'des-07',
      category: 'Style',
      criterion: 'Consistent spacing and grid usage',
      description:
        'Spacing follows an 8 px base grid. Component alignment is consistent across screens.',
      required: true,
      weight: 3,
    },
    {
      id: 'des-08',
      category: 'Assets',
      criterion: 'Exportable assets provided at correct resolutions',
      description:
        'Icons and images are provided in SVG (preferred) or @1x/@2x PNG. Figma components use Auto Layout.',
      required: true,
      weight: 3,
    },
    {
      id: 'des-09',
      category: 'Assets',
      criterion: 'Design file is well-organised (named layers and frames)',
      description:
        'All layers and frames are named meaningfully. Components are used instead of duplicated shapes.',
      required: false,
      weight: 2,
    },
    {
      id: 'des-10',
      category: 'Documentation',
      criterion: 'Design decisions and rationale documented',
      description:
        'Key design choices (colour, layout, interaction pattern) are briefly annotated in the file or PR description.',
      required: false,
      weight: 2,
    },
  ],
};
