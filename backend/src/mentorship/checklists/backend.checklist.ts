import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for backend bounties (NestJS / API endpoints).
 * 10 items covering correctness, tests, docs, style, and security.
 */
export const BACKEND_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'backend',
  version: '1.0.0',
  estimatedReviewMinutes: 45,
  minimumPassingScore: 75,
  items: [
    {
      id: 'be-01',
      category: 'Correctness',
      criterion: 'API contract matches spec',
      description:
        'Request/response shapes, HTTP status codes, and error payloads match the documented API contract.',
      required: true,
      weight: 5,
    },
    {
      id: 'be-02',
      category: 'Correctness',
      criterion: 'Database operations are transactionally safe',
      description:
        'Multi-step writes use Prisma transactions. Partial failure leaves DB in a consistent state.',
      required: true,
      weight: 5,
    },
    {
      id: 'be-03',
      category: 'Tests',
      criterion: 'Unit test coverage ≥ 80%',
      description:
        'Service logic is tested with mocked Prisma. `npm run test -- --coverage` shows ≥ 80% on changed files.',
      required: true,
      weight: 4,
    },
    {
      id: 'be-04',
      category: 'Tests',
      criterion: 'Integration / controller tests present',
      description:
        'At least one controller test uses a real NestJS test module and validates request validation (DTOs, pipes).',
      required: true,
      weight: 4,
    },
    {
      id: 'be-05',
      category: 'Security',
      criterion: 'All routes are appropriately guarded',
      description:
        'Sensitive endpoints use @UseGuards(JwtAuthGuard, RolesGuard) and @Roles(). Public endpoints are intentionally public.',
      required: true,
      weight: 5,
    },
    {
      id: 'be-06',
      category: 'Security',
      criterion: 'Input validation on all DTOs',
      description:
        'Every DTO uses class-validator decorators. The controller uses ValidationPipe with whitelist: true.',
      required: true,
      weight: 5,
    },
    {
      id: 'be-07',
      category: 'Security',
      criterion: 'No SQL injection via raw Prisma queries',
      description:
        'Raw SQL (if used) parameterises all user-supplied values. Prisma query builder is preferred.',
      required: true,
      weight: 4,
    },
    {
      id: 'be-08',
      category: 'Documentation',
      criterion: 'Service methods and endpoints have JSDoc',
      description:
        'Every public service method and controller handler has a JSDoc comment explaining behaviour, params, and errors.',
      required: true,
      weight: 3,
    },
    {
      id: 'be-09',
      category: 'Style',
      criterion: 'Follows NestJS module / service / controller pattern',
      description:
        'New features are encapsulated in a module. Services are @Injectable(). No business logic in controllers.',
      required: true,
      weight: 3,
    },
    {
      id: 'be-10',
      category: 'Style',
      criterion: 'No ESLint / TypeScript errors',
      description:
        '`npm run lint` and `npm run build` exit 0. No `any` types without explicit justification.',
      required: false,
      weight: 2,
    },
  ],
};
