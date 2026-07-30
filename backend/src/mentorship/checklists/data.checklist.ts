import { ReviewChecklistTemplate } from '../mentorship.types';

/**
 * Review checklist for data bounties (schema design, migrations, pipelines, analytics).
 * 10 items covering correctness, schema, tests, docs, style, and security.
 */
export const DATA_CHECKLIST: ReviewChecklistTemplate = {
  bountyType: 'data',
  version: '1.0.0',
  estimatedReviewMinutes: 50,
  minimumPassingScore: 75,
  items: [
    {
      id: 'dat-01',
      category: 'Correctness',
      criterion: 'Schema changes are backward compatible',
      description:
        'Migrations do not drop columns with existing data, rename columns without aliases, or change non-nullable constraints without defaults.',
      required: true,
      weight: 5,
    },
    {
      id: 'dat-02',
      category: 'Correctness',
      criterion: 'Data pipeline produces correct output',
      description:
        'Sample input/output is included in the PR. Edge cases (null values, empty datasets, duplicates) are handled.',
      required: true,
      weight: 5,
    },
    {
      id: 'dat-03',
      category: 'Schema',
      criterion: 'Schema is documented (field descriptions)',
      description:
        'Every new model/table and field has a comment explaining its purpose, units, and valid range where applicable.',
      required: true,
      weight: 4,
    },
    {
      id: 'dat-04',
      category: 'Schema',
      criterion: 'Appropriate indexes added',
      description:
        'Columns used in WHERE, ORDER BY, or JOIN conditions have indexes. Over-indexing (every column) is avoided.',
      required: true,
      weight: 4,
    },
    {
      id: 'dat-05',
      category: 'Tests',
      criterion: 'Migration tested on a copy of production-like data',
      description:
        'Evidence of a successful migration dry-run (logs or output) is included. Rollback was also tested.',
      required: true,
      weight: 4,
    },
    {
      id: 'dat-06',
      category: 'Tests',
      criterion: 'Query performance verified (EXPLAIN ANALYZE)',
      description:
        'For new or modified queries, EXPLAIN ANALYZE output is included showing acceptable execution time.',
      required: false,
      weight: 3,
    },
    {
      id: 'dat-07',
      category: 'Security',
      criterion: 'PII / sensitive fields are identified and protected',
      description:
        'Fields containing personal data are flagged. Appropriate encryption, hashing, or access controls are applied.',
      required: true,
      weight: 5,
    },
    {
      id: 'dat-08',
      category: 'Security',
      criterion: 'No raw user input in queries',
      description:
        'All queries use Prisma query builder or parameterised statements. String concatenation in SQL is absent.',
      required: true,
      weight: 5,
    },
    {
      id: 'dat-09',
      category: 'Documentation',
      criterion: 'Prisma schema updated and migration generated',
      description:
        'Changes to the data model are reflected in schema.prisma. A Prisma migration file is committed.',
      required: true,
      weight: 4,
    },
    {
      id: 'dat-10',
      category: 'Style',
      criterion: 'Naming conventions consistent with existing schema',
      description:
        'Table names are PascalCase, fields are camelCase, matching the existing Prisma schema conventions.',
      required: false,
      weight: 2,
    },
  ],
};
