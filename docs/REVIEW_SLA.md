# Review SLA & Turnaround Guidelines

> **Version:** 1.0.0  
> **Effective:** 2026-07-21

---

## Commitment

Every mentor who opts in to the CarbonLedger mentorship programme commits to a **48-hour review turnaround** measured from the moment a review request is submitted.

This SLA exists to keep contributors unblocked, maintain momentum on bounties, and ensure the platform's reputation for timely, high-quality reviews.

---

## SLA Definition

| Metric | Target |
|--------|--------|
| **Initial response** | Acknowledge the review request within **8 hours** |
| **Full review delivered** | Within **48 hours** of submission |
| **Revision turnaround** | Within **24 hours** of contributor re-submission |
| **Escalation window** | If unacknowledged after **12 hours**, auto-escalate to maintainer |

All timestamps are in UTC. Weekends and public holidays do **not** pause the SLA clock — mentors are expected to set their status to `on_break` when unavailable.

---

## Mentor Availability Statuses

| Status | Meaning | SLA applies? |
|--------|---------|--------------|
| `active` | Available and accepting reviews | ✅ Yes |
| `on_break` | Temporarily unavailable (holiday, personal time) | ❌ No new assignments |
| `inactive` | Opted out of mentoring | ❌ No new assignments |

Mentors **must** update their status before going on break. Failing to do so and missing the SLA will negatively affect their compliance score.

---

## How the 48-Hour Clock Works

```
Contributor submits PR / deliverable
          │
          ▼
   Review request created (T=0)
          │
          ├─── T+8h ──► Mentor acknowledges (status → in_review)
          │
          ├─── T+48h ─► SLA deadline
          │              Review must be DELIVERED by this point
          │              (approved, changes_requested, or rejected)
          │
          └─── T+12h ─► If still "pending" (no mentor acknowledged),
                         auto-escalate notification sent to maintainers
```

---

## What Counts as "Delivered"

A review is considered delivered when the mentor submits via `POST /api/v1/mentorship/reviews/submit` with one of:

- **`approved`** — submission meets all required checklist criteria
- **`changes_requested`** — specific, actionable changes listed in feedback
- **`rejected`** — submission does not meet minimum criteria (rare; must include explanation)

Leaving a comment without formally submitting the review does **not** stop the SLA clock.

---

## Escalation Process

1. **T+12h, no acknowledgement:** System sends a notification to all active mentors specialised in the bounty type.
2. **T+24h, still pending:** Maintainers are notified; they may manually assign a mentor.
3. **T+48h, SLA breached:** Marked as `sla_breached` in metrics; contributor notified; escalation ticket opened.
4. **T+72h, no review:** Maintainer takes over the review directly or reassigns to a different mentor.

---

## SLA Compliance Scoring

Each mentor's SLA compliance percentage is tracked and displayed publicly:

```
SLA Compliance % = (reviews delivered within 48h) / (total completed reviews) × 100
```

Mentors falling below **80% compliance** over a rolling 30-day window will:

1. Receive an automated warning notification.
2. Have their `reviewCapacityPerWeek` temporarily reduced by 50%.
3. If compliance remains below 80% for 60 days, their status is automatically set to `inactive`.

---

## Revision Turnarounds

After a contributor addresses requested changes and re-submits:

| Revision number | Expected turnaround |
|-----------------|---------------------|
| 1st revision | 24 hours |
| 2nd revision | 24 hours |
| 3rd+ revision | Maintainer review recommended |

Three or more revision rounds often indicate a scope or communication issue. Mentors should escalate to a maintainer after the 2nd revision.

---

## Mentor Capacity

Mentors self-declare their weekly review capacity during opt-in (1–20 reviews per week). The auto-assignment system will not assign a mentor whose `currentReviewCount ≥ reviewCapacityPerWeek`.

Mentors should set realistic capacities — it is better to accept fewer reviews and meet the SLA than to over-commit and breach it.

---

## Metrics Tracked

The following metrics are available at `GET /api/v1/mentorship/metrics/sla` (maintainer role required):

| Field | Description |
|-------|-------------|
| `totalReviews` | Total completed reviews |
| `reviewsWithinSLA` | Reviews delivered within 48h |
| `reviewsBreachedSLA` | Reviews that exceeded 48h |
| `slaCompliancePct` | Platform-wide compliance % |
| `avgTurnaroundHours` | Mean turnaround time |
| `medianTurnaroundHours` | Median turnaround time |
| `p95TurnaroundHours` | 95th-percentile turnaround time |
| `byBountyType` | Per-type avg turnaround and compliance % |

---

## Responsibilities Summary

### Mentor responsibilities
- Set status to `on_break` before any absence longer than 24 hours.
- Acknowledge new review requests within 8 hours of assignment.
- Deliver complete, constructive reviews within 48 hours.
- Respond to revisions within 24 hours.
- Be specific and actionable in all feedback — vague comments delay contributors.

### Contributor responsibilities
- Submit a clean, complete submission before requesting a review.
- Address all requested changes within 72 hours of receiving feedback.
- Submit mentee feedback after each review to help the programme improve.

### Maintainer responsibilities
- Monitor the escalation queue daily.
- Step in on any review that reaches T+48h without delivery.
- Conduct monthly SLA compliance reviews and coach underperforming mentors.
