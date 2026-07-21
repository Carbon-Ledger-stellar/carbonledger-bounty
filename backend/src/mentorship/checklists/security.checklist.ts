import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for security bounties (audits, pen-tests, hardening).
 * 10 items covering methodology, evidence, reporting, and responsible disclosure.
 */
export const SECURITY_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'security',
  version: '1.0.0',
  estimatedReviewMinutes: 90,
  minimumPassingScore: 80,
  items: [
    {
      id: 'sec-01',
      category: 'Correctness',
      criterion: 'Findings are reproducible',
      description:
        'Each reported vulnerability includes precise reproduction steps. The reviewer can independently confirm the issue.',
      required: true,
      weight: 5,
    },
    {
      id: 'sec-02',
      category: 'Correctness',
      criterion: 'Severity ratings follow CVSS or equivalent',
      description:
        'Each finding includes a severity (Critical / High / Medium / Low / Informational) with a brief CVSS justification.',
      required: true,
      weight: 4,
    },
    {
      id: 'sec-03',
      category: 'Correctness',
      criterion: 'No false positives without justification',
      description:
        'Every finding in the report is a genuine issue. Suspected-but-unconfirmed findings are labelled "informational".',
      required: true,
      weight: 4,
    },
    {
      id: 'sec-04',
      category: 'Security',
      criterion: 'Covers OWASP Top 10 / Soroban security checklist',
      description:
        'The audit demonstrates coverage of injection, broken auth, misconfigurations, and Soroban-specific pitfalls (reentrancy, auth bypass).',
      required: true,
      weight: 5,
    },
    {
      id: 'sec-05',
      category: 'Security',
      criterion: 'Smart-contract specific checks included',
      description:
        'Integer overflow, reentrancy, access control, and upgrade safety are explicitly addressed in scope.',
      required: true,
      weight: 5,
    },
    {
      id: 'sec-06',
      category: 'Security',
      criterion: 'Remediation recommendations provided',
      description:
        'Each finding includes at least one actionable remediation recommendation with a code example or reference.',
      required: true,
      weight: 4,
    },
    {
      id: 'sec-07',
      category: 'Documentation',
      criterion: 'Security report is structured (exec summary, findings, appendix)',
      description:
        'Report has an executive summary, a detailed findings section, and an appendix with tools/methodology used.',
      required: true,
      weight: 3,
    },
    {
      id: 'sec-08',
      category: 'Documentation',
      criterion: 'Scope and out-of-scope explicitly stated',
      description:
        'Report clearly states what was tested (contracts, endpoints, components) and what was explicitly excluded.',
      required: true,
      weight: 3,
    },
    {
      id: 'sec-09',
      category: 'Style',
      criterion: 'Responsible disclosure process followed',
      description:
        'Critical findings were reported privately before being included in the public-facing deliverable.',
      required: true,
      weight: 5,
    },
    {
      id: 'sec-10',
      category: 'Tests',
      criterion: 'Proof-of-concept code included for critical findings',
      description:
        'Critical and High severity findings include a PoC exploit script or test that demonstrates the vulnerability.',
      required: false,
      weight: 4,
    },
  ],
};
