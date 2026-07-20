/**
 * CarbonLedger Bounty Taxonomy
 *
 * Hierarchical classification for bounties: domain -> area -> component.
 * Task-type is a 4th, orthogonal level applied on top of the domain path
 * (e.g. "backend / api-development / rest-endpoints / bug-fix").
 *
 * Each node carries `keywords`: lower-case patterns matched against a
 * bounty's title + description to drive keyword-based auto-categorization.
 */

export type Domain =
  | 'smart-contracts'
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'documentation'
  | 'other';

export type Impact = 'critical' | 'high' | 'medium' | 'low';

export interface ComponentNode {
  label: string;
  keywords: string[];
}

export interface AreaNode {
  label: string;
  keywords: string[];
  components: Record<string, ComponentNode>;
}

export interface DomainNode {
  label: string;
  keywords: string[];
  areas: Record<string, AreaNode>;
}

export const BOUNTY_TAXONOMY: Record<Domain, DomainNode> = {
  'smart-contracts': {
    label: 'Smart Contracts',
    keywords: ['soroban', 'rust', 'wasm', 'stellar sdk', 'smart contract', 'contract'],
    areas: {
      'contract-development': {
        label: 'Contract Development',
        keywords: ['mint', 'token', 'contract logic', 'implement contract', 'serial'],
        components: {
          'token-contracts': {
            label: 'Token Contracts',
            keywords: ['minting', 'token', 'credit issuance', 'burn'],
          },
          'contract-core': {
            label: 'Core Contract Logic',
            keywords: ['registry', 'storage', 'state', 'invocation'],
          },
        },
      },
      'contract-security': {
        label: 'Contract Security & Testing',
        keywords: ['audit', 'security', 'vulnerability', 'duplicate prevention'],
        components: {
          auditing: {
            label: 'Security Auditing',
            keywords: ['audit', 'vulnerability', 'exploit'],
          },
          'contract-testing': {
            label: 'Contract Testing',
            keywords: ['unit test', 'test coverage', 'testnet'],
          },
        },
      },
    },
  },
  frontend: {
    label: 'Frontend',
    keywords: ['react', 'next.js', 'nextjs', 'frontend', 'ui', 'css', 'component'],
    areas: {
      'ui-development': {
        label: 'UI Development',
        keywords: ['component', 'responsive', 'accessibility', 'a11y', 'styling'],
        components: {
          'react-components': {
            label: 'React Components',
            keywords: ['react component', 'hook', 'jsx'],
          },
          'accessible-ui': {
            label: 'Accessible UI',
            keywords: ['accessibility', 'a11y', 'aria'],
          },
        },
      },
      'data-visualization': {
        label: 'Data Visualization & Reporting',
        keywords: ['pdf', 'chart', 'dashboard', 'qr code', 'report'],
        components: {
          'charts-dashboards': {
            label: 'Charts & Dashboards',
            keywords: ['chart', 'dashboard', 'graph'],
          },
          'pdf-reports': {
            label: 'PDF & Certificates',
            keywords: ['pdf', 'jspdf', 'certificate', 'qr code'],
          },
        },
      },
    },
  },
  backend: {
    label: 'Backend',
    keywords: ['nestjs', 'node.js', 'backend', 'api', 'prisma', 'postgres'],
    areas: {
      'api-development': {
        label: 'API Development',
        keywords: ['endpoint', 'rest', 'api', 'websocket', 'pagination'],
        components: {
          'rest-endpoints': {
            label: 'REST Endpoints',
            keywords: ['rest', 'endpoint', 'controller', 'pagination'],
          },
          'realtime-endpoints': {
            label: 'Realtime & WebSockets',
            keywords: ['websocket', 'socket.io', 'realtime', 'gateway'],
          },
        },
      },
      'data-layer': {
        label: 'Data Layer',
        keywords: ['database', 'query', 'cache', 'prisma', 'schema'],
        components: {
          'database-queries': {
            label: 'Database Queries',
            keywords: ['query', 'prisma', 'sql', 'index'],
          },
          caching: {
            label: 'Caching',
            keywords: ['cache', 'redis', 'memoization'],
          },
        },
      },
    },
  },
  devops: {
    label: 'DevOps',
    keywords: ['docker', 'ci/cd', 'deployment', 'kubernetes', 'infrastructure'],
    areas: {
      'ci-cd': {
        label: 'CI/CD',
        keywords: ['pipeline', 'github actions', 'ci', 'cd', 'build'],
        components: {
          pipelines: {
            label: 'Pipelines',
            keywords: ['pipeline', 'github actions', 'workflow'],
          },
          'release-deployment': {
            label: 'Release & Deployment',
            keywords: ['deploy', 'release', 'rollout'],
          },
        },
      },
      infrastructure: {
        label: 'Infrastructure',
        keywords: ['docker', 'kubernetes', 'nginx', 'monitoring', 'runbook'],
        components: {
          containers: {
            label: 'Containers & Orchestration',
            keywords: ['docker', 'kubernetes', 'container', 'compose'],
          },
          monitoring: {
            label: 'Monitoring & Observability',
            keywords: ['monitoring', 'prometheus', 'logging', 'health check'],
          },
        },
      },
    },
  },
  documentation: {
    label: 'Documentation',
    keywords: ['documentation', 'docs', 'guide', 'openapi', 'swagger'],
    areas: {
      'technical-writing': {
        label: 'Technical Writing',
        keywords: ['guide', 'reference', 'getting started', 'runbook'],
        components: {
          'api-docs': {
            label: 'API Documentation',
            keywords: ['openapi', 'swagger', 'api reference', 'endpoint documentation'],
          },
          guides: {
            label: 'Guides & Runbooks',
            keywords: ['guide', 'runbook', 'tutorial'],
          },
        },
      },
    },
  },
  other: {
    label: 'Other',
    keywords: [],
    areas: {
      general: {
        label: 'General',
        keywords: [],
        components: {
          miscellaneous: {
            label: 'Miscellaneous',
            keywords: [],
          },
        },
      },
    },
  },
};

export const DOMAINS = Object.keys(BOUNTY_TAXONOMY) as Domain[];

export type TaskType =
  | 'implementation'
  | 'bug-fix'
  | 'testing'
  | 'optimization'
  | 'security-audit'
  | 'documentation'
  | 'refactor';

/**
 * Task-type keywords are domain-agnostic — the same "bug-fix" language
 * applies whether the bounty is a smart contract or a frontend component.
 */
export const TASK_TYPES: Record<TaskType, { label: string; keywords: string[] }> = {
  implementation: {
    label: 'Implementation',
    keywords: ['implement', 'build', 'create', 'add support for', 'new feature'],
  },
  'bug-fix': {
    label: 'Bug Fix',
    keywords: ['fix', 'bug', 'broken', 'issue', 'incorrect', 'error'],
  },
  testing: {
    label: 'Testing',
    keywords: ['test', 'coverage', 'e2e', 'unit test', 'integration test'],
  },
  optimization: {
    label: 'Optimization',
    keywords: ['optimi', 'performance', 'speed up', 'reduce latency', 'efficient'],
  },
  'security-audit': {
    label: 'Security Audit',
    keywords: ['security', 'audit', 'vulnerability', 'exploit', 'penetration'],
  },
  documentation: {
    label: 'Documentation',
    keywords: ['document', 'guide', 'readme', 'reference'],
  },
  refactor: {
    label: 'Refactor',
    keywords: ['refactor', 'clean up', 'restructure', 'rewrite'],
  },
};

export const IMPACT_LEVELS: Impact[] = ['critical', 'high', 'medium', 'low'];

/**
 * Reward-based impact heuristic — CarbonLedger's `Bounty` model has no
 * dedicated impact field, so impact is derived deterministically from the
 * reward amount, mirroring the pricing tiers used elsewhere in the platform.
 */
export function deriveImpact(rewardUsd: number): Impact {
  if (rewardUsd >= 2000) return 'critical';
  if (rewardUsd >= 1000) return 'high';
  if (rewardUsd >= 400) return 'medium';
  return 'low';
}
