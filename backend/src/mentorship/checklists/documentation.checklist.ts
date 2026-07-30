import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for documentation bounties.
 * 10 items covering correctness, completeness, style, and accessibility.
 */
export const DOCUMENTATION_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'documentation',
  version: '1.0.0',
  estimatedReviewMinutes: 30,
  minimumPassingScore: 75,
  items: [
    {
      id: 'doc-01',
      category: 'Correctness',
      criterion: 'All technical claims are accurate',
      description:
        'Code snippets compile/run as shown. API endpoints, contract functions, and CLI commands match the actual implementation.',
      required: true,
      weight: 5,
    },
    {
      id: 'doc-02',
      category: 'Correctness',
      criterion: 'No broken links',
      description:
        'All internal and external links resolve. Run a link checker (e.g., `markdown-link-check`) or manually verify each one.',
      required: true,
      weight: 4,
    },
    {
      id: 'doc-03',
      category: 'Completeness',
      criterion: 'Covers all acceptance criteria from the bounty',
      description:
        'Each item in the bounty\'s acceptance criteria is addressed. Nothing is left as a TODO or placeholder.',
      required: true,
      weight: 5,
    },
    {
      id: 'doc-04',
      category: 'Completeness',
      criterion: 'Includes at least one worked example',
      description:
        'Conceptual explanations are supported by a practical example (code snippet, screenshot, or step-by-step walkthrough).',
      required: true,
      weight: 4,
    },
    {
      id: 'doc-05',
      category: 'Completeness',
      criterion: 'Word count meets minimum (≥ 500 words for guides)',
      description:
        'For guides and tutorials, total word count ≥ 500. Reference docs are exempt but must be exhaustive.',
      required: false,
      weight: 3,
    },
    {
      id: 'doc-06',
      category: 'Style',
      criterion: 'Clear, concise prose with correct grammar',
      description:
        'No run-on sentences, passive-voice overuse, or jargon without definition. Target audience (developer) is kept in mind.',
      required: true,
      weight: 3,
    },
    {
      id: 'doc-07',
      category: 'Style',
      criterion: 'Consistent heading hierarchy',
      description:
        'H1 used once as the document title. H2 for sections, H3 for subsections. No skipped levels.',
      required: true,
      weight: 2,
    },
    {
      id: 'doc-08',
      category: 'Style',
      criterion: 'Code blocks specify language for syntax highlighting',
      description:
        'All fenced code blocks include the language identifier (```rust, ```ts, ```bash, etc.).',
      required: false,
      weight: 2,
    },
    {
      id: 'doc-09',
      category: 'Accessibility',
      criterion: 'Images have descriptive alt text',
      description:
        'Every image has meaningful alt text. Decorative images use alt="".',
      required: true,
      weight: 3,
    },
    {
      id: 'doc-10',
      category: 'Correctness',
      criterion: 'Version / date information is current',
      description:
        'If the doc references a specific version, it matches the current release. "Last updated" dates are present where applicable.',
      required: false,
      weight: 2,
    },
  ],
};
