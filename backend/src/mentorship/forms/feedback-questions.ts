import { MentorFeedbackQuestion } from '../mentorship.types';

/**
 * Standard mentor feedback form questions — used when a mentor submits a review.
 * Questions are grouped by category and designed to elicit constructive, structured feedback.
 */
export const MENTOR_FEEDBACK_QUESTIONS: MentorFeedbackQuestion[] = [
  // ── Overall Assessment ──────────────────────────────────────────────────────
  {
    id: 'mfq-01',
    question: 'Overall, how would you rate the quality of this submission?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mfq-02',
    question: 'Does this submission meet the bounty\'s core acceptance criteria?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'mfq-03',
    question: 'What is your review decision?',
    type: 'multiple_choice',
    options: ['Approved', 'Approved with minor suggestions', 'Changes requested', 'Rejected'],
    required: true,
  },

  // ── Code / Deliverable Quality ──────────────────────────────────────────────
  {
    id: 'mfq-04',
    question: 'How would you rate the correctness and completeness of the implementation?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mfq-05',
    question: 'How would you rate the test coverage and test quality?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mfq-06',
    question: 'Are there any security concerns that must be addressed before approval?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'mfq-07',
    question: 'Describe the specific security concerns found (leave blank if none).',
    type: 'text',
    required: false,
  },

  // ── Constructive Feedback ───────────────────────────────────────────────────
  {
    id: 'mfq-08',
    question: 'What did the contributor do particularly well? (Celebrate wins — this builds confidence.)',
    type: 'text',
    required: true,
  },
  {
    id: 'mfq-09',
    question: 'What is the single most important improvement the contributor should make?',
    type: 'text',
    required: true,
  },
  {
    id: 'mfq-10',
    question: 'List any additional changes requested (one per line). Be specific — reference files/lines where possible.',
    type: 'text',
    required: false,
  },

  // ── Learning & Growth ───────────────────────────────────────────────────────
  {
    id: 'mfq-11',
    question: 'What resources (docs, articles, examples) would help this contributor improve?',
    type: 'text',
    required: false,
  },
  {
    id: 'mfq-12',
    question: 'How would you assess the contributor\'s growth potential in this area?',
    type: 'multiple_choice',
    options: [
      'Strong — ready for advanced bounties',
      'On track — continue at current level',
      'Needs more practice — suggest simpler bounties first',
      'Unclear — insufficient work to judge',
    ],
    required: true,
  },
  {
    id: 'mfq-13',
    question: 'Would you be willing to mentor this contributor again?',
    type: 'boolean',
    required: true,
  },
];

/**
 * Mentee feedback questions — used when a contributor rates their mentor after review.
 * Drives the mentor helpfulness score tracked in MentorshipMetrics.
 */
export const MENTEE_FEEDBACK_QUESTIONS: MentorFeedbackQuestion[] = [
  {
    id: 'mtfq-01',
    question: 'How helpful was the mentor\'s feedback in improving your submission?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mtfq-02',
    question: 'How clear and actionable were the requested changes?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mtfq-03',
    question: 'Was the review delivered within 48 hours of your submission?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'mtfq-04',
    question: 'How respectful and encouraging was the mentor\'s tone?',
    type: 'rating',
    required: true,
  },
  {
    id: 'mtfq-05',
    question: 'Did the mentor point you to useful learning resources?',
    type: 'boolean',
    required: false,
  },
  {
    id: 'mtfq-06',
    question: 'Would you work with this mentor again?',
    type: 'boolean',
    required: true,
  },
  {
    id: 'mtfq-07',
    question: 'Any additional comments about the review experience?',
    type: 'text',
    required: false,
  },
];
