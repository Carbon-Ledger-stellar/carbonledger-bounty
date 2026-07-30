import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for devops bounties (CI/CD, infrastructure, deployment).
 * 10 items covering correctness, runbook, tests, docs, style, and security.
 */
export const DEVOPS_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'devops',
  version: '1.0.0',
  estimatedReviewMinutes: 40,
  minimumPassingScore: 75,
  items: [
    {
      id: 'do-01',
      category: 'Correctness',
      criterion: 'Pipeline / infra changes deploy successfully',
      description:
        'CI pipeline passes end-to-end. Deployment is verified on the target environment (testnet, staging, or canary).',
      required: true,
      weight: 5,
    },
    {
      id: 'do-02',
      category: 'Correctness',
      criterion: 'Environment parity maintained',
      description:
        'Dev, staging, and production configs differ only in explicit env-var overrides. No hardcoded environment names.',
      required: true,
      weight: 4,
    },
    {
      id: 'do-03',
      category: 'Runbook',
      criterion: 'Runbook / operational guide present',
      description:
        'A runbook exists describing how to deploy, roll back, and monitor the change. Stored in docs/ or the PR.',
      required: true,
      weight: 5,
    },
    {
      id: 'do-04',
      category: 'Runbook',
      criterion: 'Rollback procedure documented',
      description:
        'The runbook explicitly states rollback steps and estimated time to recover from a failed deployment.',
      required: true,
      weight: 4,
    },
    {
      id: 'do-05',
      category: 'Security',
      criterion: 'Secrets managed via environment variables or secret store',
      description:
        'No secrets, API keys, or private keys are committed to the repository. `.env.example` documents required vars.',
      required: true,
      weight: 5,
    },
    {
      id: 'do-06',
      category: 'Security',
      criterion: 'Principle of least privilege for IAM / service accounts',
      description:
        'Service accounts, CI tokens, and IAM roles have only the permissions they need. No wildcard policies.',
      required: true,
      weight: 5,
    },
    {
      id: 'do-07',
      category: 'Tests',
      criterion: 'Infrastructure changes are tested in a non-production environment first',
      description:
        'Evidence of a successful testnet / staging deployment is linked in the PR (logs, screenshots, or URLs).',
      required: true,
      weight: 4,
    },
    {
      id: 'do-08',
      category: 'Tests',
      criterion: 'Smoke tests pass post-deployment',
      description:
        'A basic health check or smoke test confirms the service is reachable after deployment.',
      required: true,
      weight: 4,
    },
    {
      id: 'do-09',
      category: 'Documentation',
      criterion: 'DEPLOYMENT.md updated if deployment steps changed',
      description:
        'If the deployment procedure changed, docs/DEPLOYMENT.md reflects the new steps.',
      required: false,
      weight: 3,
    },
    {
      id: 'do-10',
      category: 'Style',
      criterion: 'Infrastructure-as-code follows DRY principles',
      description:
        'Repeated configuration is extracted into variables or modules. No copy-pasted blocks with minor edits.',
      required: false,
      weight: 2,
    },
  ],
};
