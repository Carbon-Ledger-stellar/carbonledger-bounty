# Mentorship Framework

> A structured peer review and mentorship system for CarbonLedger bounty contributors, enabling senior contributors (reputation >80) to provide constructive feedback on bounty submissions with defined SLAs, quality checklists, and feedback metrics.

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Becoming a Mentor](#becoming-a-mentor)
- [Review Checklist Templates](#review-checklist-templates)
- [SLA & Turnaround Times](#sla--turnaround-times)
- [Feedback Forms](#feedback-forms)
- [Metrics & Scoring](#metrics--scoring)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)

---

## Overview

The mentorship system provides:

- **Opt-in senior mentorship:** Contributors with reputation ≥80 can volunteer as mentors.
- **Structured review checklists:** 8 bounty-type-specific checklists (10 items each) covering correctness, tests, docs, style, and security.
- **48-hour review SLA:** Mentors commit to deliver reviews within 48 hours of submission.
- **Feedback loops:** Structured mentor→contributor and contributor→mentor feedback forms.
- **Metrics tracking:** Helpfulness scores, SLA compliance, turnaround times, and mentor leaderboards.

### Out of Scope

- **Mentor-mentee matching:** Auto-assignment is based on availability and specialisation, not manual matching.
- **Mentor compensation:** Mentors are volunteers; compensation is not part of this system.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Contributor submits bounty deliverable (PR, design, report)  │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Contributor creates review request via API                   │
│    POST /api/v1/mentorship/reviews                              │
│    { bountyId, bountyType, submissionUrl }                      │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. System auto-assigns mentor                                   │
│    - Filters: active status, specialises in bounty type,        │
│      has capacity (currentReviewCount < reviewCapacityPerWeek)  │
│    - Prefers: lowest current load, highest reputation           │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Mentor reviews submission                                    │
│    - Fetches checklist: GET /api/v1/mentorship/checklists/:type │
│    - Evaluates each item (passed/failed, score 0-5, notes)      │
│    - Writes constructive feedback using mentor form questions   │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Mentor submits review within 48 hours                        │
│    POST /api/v1/mentorship/reviews/submit                       │
│    { reviewRequestId, checklistResults[], overallScore,         │
│      mentorFeedback, decision: approved | changes_requested }   │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Contributor receives feedback                                │
│    - If approved: bounty proceeds to payment                    │
│    - If changes requested: contributor revises & re-submits     │
│    - Revision turnaround: 24 hours per round                    │
└────────────────────────────────┬────────────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Contributor submits mentee feedback                          │
│    POST /api/v1/mentorship/feedback/mentee                      │
│    { reviewRequestId, helpfulnessScore, timelinessScore, ... }  │
│    → Updates mentor's avgHelpfulnessScore                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Becoming a Mentor

### Eligibility

- **Reputation score ≥ 80** (derived from past bounty completions, quality, and community contributions).
- Good standing in the community (no active disputes or fraud flags).

### Opt-In

```bash
POST /api/v1/mentorship/mentors/opt-in
Authorization: Bearer <JWT>

{
  "publicKey": "GCXXXXX...",
  "specializations": ["smart-contracts", "backend"],
  "reviewCapacityPerWeek": 5
}
```

**Response:**
```json
{
  "userId": "GCXXXXX...",
  "status": "active",
  "reputation": 87,
  "specializations": ["smart-contracts", "backend"],
  "totalReviews": 0,
  "avgTurnaroundHours": 0,
  "avgHelpfulnessScore": 0,
  "reviewCapacityPerWeek": 5,
  "currentReviewCount": 0,
  "joinedAt": "2026-07-21T06:00:00.000Z",
  "lastActiveAt": "2026-07-21T06:00:00.000Z"
}
```

### Setting Availability

Mentors must update their status when going on break:

```bash
PATCH /api/v1/mentorship/mentors/GCXXXXX.../status
Authorization: Bearer <JWT>

{
  "status": "on_break"
}
```

| Status | Meaning | Accepts reviews? |
|--------|---------|------------------|
| `active` | Available for reviews | ✅ Yes |
| `on_break` | Temporarily unavailable | ❌ No |
| `inactive` | Opted out | ❌ No |

---

## Review Checklist Templates

Each bounty type has a dedicated checklist with 10 items covering:

- **Correctness** — does it meet the spec?
- **Tests** — is it adequately tested?
- **Documentation** — is it documented?
- **Style** — does it follow project conventions?
- **Security** — are there vulnerabilities?

### Bounty Types

| Type | Items | Min passing score | Est. review time |
|------|-------|-------------------|------------------|
| `smart-contracts` | 10 | 75% | 60 min |
| `frontend` | 10 | 75% | 45 min |
| `backend` | 10 | 75% | 45 min |
| `devops` | 10 | 75% | 40 min |
| `documentation` | 10 | 75% | 30 min |
| `security` | 10 | 80% | 90 min |
| `design` | 10 | 75% | 40 min |
| `data` | 10 | 75% | 50 min |

### Example: Smart Contracts Checklist

```json
{
  "bountyType": "smart-contracts",
  "version": "1.0.0",
  "estimatedReviewMinutes": 60,
  "minimumPassingScore": 75,
  "items": [
    {
      "id": "sc-01",
      "category": "Correctness",
      "criterion": "Logic correctness",
      "description": "All on-chain logic matches the bounty specification...",
      "required": true,
      "weight": 5
    },
    // ... 9 more items
  ]
}
```

Fetch all templates:

```bash
GET /api/v1/mentorship/checklists
```

Fetch one template:

```bash
GET /api/v1/mentorship/checklists/smart-contracts
```

---

## SLA & Turnaround Times

See [REVIEW_SLA.md](./REVIEW_SLA.md) for full details.

### Key Commitments

| Milestone | Deadline |
|-----------|----------|
| Initial acknowledgement | 8 hours |
| Full review delivered | **48 hours** |
| Revision review | 24 hours |
| Escalation trigger | 12 hours (if unacknowledged) |

### SLA Compliance Scoring

```
SLA Compliance % = (reviews within 48h) / (total reviews) × 100
```

- **≥ 90%:** Excellent standing
- **80-89%:** Good standing
- **< 80%:** Warning issued; capacity reduced
- **< 80% for 60 days:** Auto-set to `inactive`

---

## Feedback Forms

### Mentor Review Form (13 Questions)

Used when submitting a completed review. Covers:

- Overall quality rating (1-5)
- Correctness, test quality, security concerns
- What the contributor did well
- The single most important improvement
- Additional requested changes
- Resources to help the contributor improve
- Growth potential assessment
- Willingness to mentor again

Fetch the form:

```bash
GET /api/v1/mentorship/forms/mentor/smart-contracts
```

### Mentee Satisfaction Survey (7 Questions)

Used by contributors to rate their mentor. Drives the `avgHelpfulnessScore`:

- Helpfulness (1-5)
- Clarity (1-5)
- Timeliness (1-5)
- Respectfulness (1-5)
- Learning resources provided (yes/no)
- Would work with again (yes/no)
- Additional comments (text)

Fetch the form:

```bash
GET /api/v1/mentorship/forms/mentee
```

Submit mentee feedback:

```bash
POST /api/v1/mentorship/feedback/mentee
Authorization: Bearer <JWT>

{
  "reviewRequestId": "rev-1234...",
  "mentorId": "GCXXXXX...",
  "helpfulnessScore": 5,
  "timelinessScore": 5,
  "clarityScore": 4,
  "wouldWorkWithAgain": true,
  "comments": "Very thorough and encouraging!"
}
```

---

## Metrics & Scoring

### Mentor Metrics

Available at:

```bash
GET /api/v1/mentorship/metrics
Authorization: Bearer <JWT>
Role: maintainer
```

**Response:**
```json
{
  "totalMentors": 12,
  "activeMentors": 9,
  "totalReviews": 87,
  "avgHelpfulnessScore": 4.3,
  "slaMetrics": {
    "totalReviews": 87,
    "reviewsWithinSLA": 82,
    "reviewsBreachedSLA": 5,
    "slaCompliancePct": 94.25,
    "avgTurnaroundHours": 31.2,
    "medianTurnaroundHours": 28.0,
    "p95TurnaroundHours": 46.5,
    "byBountyType": [
      {
        "bountyType": "smart-contracts",
        "avgTurnaroundHours": 38.4,
        "slaCompliancePct": 91.7
      }
    ]
  },
  "topMentors": [
    {
      "mentorId": "GCXXXXX...",
      "publicKey": "GCXXXXX...",
      "totalReviews": 23,
      "avgHelpfulnessScore": 4.8,
      "slaCompliancePct": 100.0
    }
  ]
}
```

### SLA Metrics

Detailed turnaround analysis:

```bash
GET /api/v1/mentorship/metrics/sla
Authorization: Bearer <JWT>
Role: maintainer
```

---

## API Reference

### Mentor Profiles

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mentorship/mentors/opt-in` | POST | JWT | Opt in as mentor |
| `/mentorship/mentors/:publicKey/status` | PATCH | JWT | Update availability |
| `/mentorship/mentors` | GET | JWT | List all mentors |
| `/mentorship/mentors/:publicKey` | GET | JWT | Get one mentor |
| `/mentorship/mentors/:publicKey/feedback` | GET | JWT | Get mentee feedback for mentor |

### Review Requests

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mentorship/reviews` | POST | JWT | Submit review request |
| `/mentorship/reviews` | GET | JWT | List reviews (filterable) |
| `/mentorship/reviews/:reviewId` | GET | JWT | Get one review |
| `/mentorship/reviews/submit` | POST | JWT | Submit completed review |

### Feedback Forms

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mentorship/forms/mentor/:bountyType` | GET | JWT | Get mentor form + checklist |
| `/mentorship/forms/mentee` | GET | JWT | Get mentee survey |
| `/mentorship/feedback/mentee` | POST | JWT | Submit mentee feedback |

### Checklists

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mentorship/checklists` | GET | JWT | List all templates |
| `/mentorship/checklists/:bountyType` | GET | JWT | Get one template |

### Metrics

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/mentorship/metrics` | GET | JWT (maintainer) | Overall metrics + top mentors |
| `/mentorship/metrics/sla` | GET | JWT (maintainer) | SLA compliance details |

---

## Best Practices

### For Mentors

1. **Set realistic capacity:** Better to accept fewer reviews and deliver on time than to over-commit.
2. **Use the "on_break" status:** Going on holiday? Update your status before leaving.
3. **Be specific in feedback:** Instead of "this needs work," say "extract this 50-line function into a reusable utility at `src/utils/helpers.ts`."
4. **Celebrate wins:** Always start with what the contributor did well. Positive reinforcement builds confidence.
5. **Link to resources:** Point contributors to official docs, style guides, or example code.
6. **Escalate blockers:** If a contributor is stuck on something beyond the bounty scope, escalate to a maintainer.

### For Contributors

1. **Self-review first:** Run all lints, tests, and checklist items yourself before submitting for review.
2. **Provide context:** In your review request, link to the bounty, your PR, and any relevant screenshots or logs.
3. **Respond quickly to feedback:** Aim to address requested changes within 72 hours.
4. **Ask questions:** If feedback is unclear, ask the mentor for clarification — don't guess.
5. **Submit mentee feedback:** Your feedback helps mentors improve and keeps the programme healthy.

### For Maintainers

1. **Monitor the escalation queue:** Check daily for reviews that have breached the 48-hour SLA.
2. **Coach underperforming mentors:** If a mentor's SLA compliance drops below 80%, reach out and offer support.
3. **Recognise top mentors:** Publicly thank mentors with high helpfulness scores and 100% SLA compliance.
4. **Iterate on checklists:** As the project evolves, update the checklist templates to reflect new standards.

---

## Future Enhancements (Out of Scope for v1)

- Mentor compensation (reputation boosts, badges, or token rewards).
- Manual mentor-mentee matching (contributor selects preferred mentor).
- Recurring mentorship pairings (same mentor for a contributor's sequence of bounties).
- Integration with GitHub PR comments (automated checklist annotations).
- Slack/Discord notifications for review assignments and SLA reminders.

---

**Questions?** Open an issue or ping the maintainer team in the #mentorship Discord channel.
