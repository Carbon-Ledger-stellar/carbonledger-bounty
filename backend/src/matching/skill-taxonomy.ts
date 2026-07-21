/**
 * CarbonLedger Skill Taxonomy
 * Maps skill categories to their constituent skills.
 * Used by the skill-matching engine to compute compatibility scores.
 */

export const SKILL_TAXONOMY: Record<string, string[]> = {
  'smart-contracts': [
    'Soroban',
    'Rust',
    'WASM',
    'Stellar SDK',
    'smart contract testing',
    'token minting',
    'DeFi protocols',
    'contract security',
  ],
  frontend: [
    'React',
    'Next.js',
    'TypeScript',
    'CSS',
    'responsive design',
    'accessibility',
    'SWR',
    'React Query',
    'jsPDF',
    'html2canvas',
  ],
  backend: [
    'NestJS',
    'Node.js',
    'PostgreSQL',
    'Prisma',
    'REST API',
    'JWT auth',
    'WebSockets',
    'microservices',
  ],
  devops: [
    'Docker',
    'GitHub Actions',
    'CI/CD',
    'Kubernetes',
    'AWS',
    'Nginx',
    'monitoring',
    'Prometheus',
  ],
  testing: [
    'Jest',
    'Playwright',
    'unit testing',
    'integration testing',
    'load testing',
    'test coverage',
    'TDD',
    'E2E testing',
  ],
  documentation: [
    'OpenAPI',
    'Swagger',
    'technical writing',
    'API documentation',
    'Markdown',
    'Docusaurus',
  ],
  security: [
    'JWT',
    'OAuth2',
    'input validation',
    'SQL injection prevention',
    'rate limiting',
    'CORS',
  ],
};

/**
 * Flat list of all skills across every category.
 */
export const SKILL_LIST: string[] = Object.values(SKILL_TAXONOMY).flat();

/**
 * Reverse lookup: skill name → category.
 */
export const SKILL_TO_CATEGORY: Record<string, string> = Object.entries(
  SKILL_TAXONOMY,
).reduce<Record<string, string>>((acc, [category, skills]) => {
  skills.forEach(skill => {
    acc[skill] = category;
  });
  return acc;
}, {});
