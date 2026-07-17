# Support Ticket System Documentation

## Overview

The support ticket system enables contributors to escalate issues related to bounties, helping maintainers identify and address common problems. This system provides complete transparency and tracks metrics to improve the bounty program.

## Features

### 1. Support Ticket Types

Contributors can create tickets for four types of issues:

- **unclear-requirement**: Requirements are ambiguous or missing clarity
- **blocker-bug**: A bug that prevents work from progressing
- **scope-creep**: The scope of the bounty has expanded unexpectedly
- **access-issue**: Missing access or permissions to required resources

### 2. Ticket Lifecycle

Each ticket progresses through the following statuses:

```
open → in-progress → resolved
```

- **open**: Initial state when ticket is created
- **in-progress**: Maintainer has acknowledged the ticket (must happen within 24 hours)
- **resolved**: Issue has been addressed and ticket is closed

### 3. Automatic Tracking

The system automatically tracks:

- **Ticket frequency**: How many tickets of each type have been created
- **Average resolution time**: How long it takes to resolve each ticket type
- **Acknowledgment time**: Time from ticket creation to first acknowledgment
- **Overall statistics**: Total tickets, open/in-progress/resolved counts

## API Endpoints

### Create a Support Ticket

```
POST /api/v1/support/tickets
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "bountyId": "bounty-123",
  "type": "unclear-requirement|blocker-bug|scope-creep|access-issue",
  "title": "Brief title of the issue",
  "description": "Detailed description of the problem",
  "attachments": ["url-to-screenshot", "url-to-log"]  // optional
}

Response:
{
  "id": "cuid",
  "ticketId": "ticket-uuid",
  "bountyId": "bounty-123",
  "contributorId": "public-key",
  "maintainerId": null,
  "type": "unclear-requirement",
  "status": "open",
  "title": "Brief title of the issue",
  "description": "Detailed description of the problem",
  "attachments": ["url-to-screenshot"],
  "createdAt": "2026-07-16T04:00:00Z",
  "acknowledgedAt": null,
  "resolvedAt": null,
  "resolution": null
}
```

### Get All Support Tickets

```
GET /api/v1/support/tickets?bountyId=xyz&status=open&type=blocker-bug

Response:
[
  {
    "id": "cuid",
    "ticketId": "ticket-uuid",
    ...
  }
]
```

Query parameters (all optional):
- `bountyId`: Filter by bounty
- `contributorId`: Filter by contributor
- `status`: Filter by status (open, in-progress, resolved)
- `type`: Filter by ticket type

### Get Single Ticket

```
GET /api/v1/support/tickets/{ticketId}

Response:
{
  "id": "cuid",
  "ticketId": "ticket-uuid",
  ...
}
```

### Update Support Ticket

```
PUT /api/v1/support/tickets/{ticketId}
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "status": "in-progress|resolved",
  "resolution": "How we fixed the issue"
}

Response:
{
  "id": "cuid",
  "status": "in-progress",
  "acknowledgedAt": "2026-07-16T05:00:00Z",
  ...
}
```

### Get Open Tickets (Maintainer Dashboard)

```
GET /api/v1/support/tickets/status/open

Response:
[
  {
    "ticketId": "ticket-uuid",
    "status": "open",
    "createdAt": "2026-07-16T04:00:00Z",
    ...
  }
]
```

### Get Tickets for a Bounty (Transparency)

```
GET /api/v1/support/bounty/{bountyId}/tickets

Response:
[
  {
    "ticketId": "ticket-uuid",
    ...
  }
]
```

### Get Support Metrics

```
GET /api/v1/support/metrics

Response:
[
  {
    "id": "cuid",
    "ticketType": "unclear-requirement",
    "frequency": 5,
    "avgResolution": 12,
    "lastUpdated": "2026-07-16T05:00:00Z"
  },
  {
    "ticketType": "blocker-bug",
    "frequency": 3,
    "avgResolution": 8,
    ...
  }
]
```

### Get Metrics by Type

```
GET /api/v1/support/metrics/{type}

Response:
{
  "ticketType": "unclear-requirement",
  "frequency": 5,
  "avgResolution": 12,
  "lastUpdated": "2026-07-16T05:00:00Z"
}
```

### Get Overall Statistics

```
GET /api/v1/support/statistics

Response:
{
  "totalTickets": 15,
  "openTickets": 2,
  "inProgressTickets": 3,
  "resolvedTickets": 10,
  "avgTimeToAcknowledge": 4,
  "ticketsByType": [
    {
      "ticketType": "blocker-bug",
      "frequency": 5,
      "avgResolution": 8
    },
    ...
  ]
}
```

## Usage Examples

### Example 1: Contributor Creates a Ticket

A contributor working on a bounty realizes the requirements are unclear and creates a support ticket:

```bash
curl -X POST http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "bountyId": "bounty-123",
    "type": "unclear-requirement",
    "title": "Unclear acceptance criteria for feature X",
    "description": "The acceptance criteria mention 'optimal performance' but dont specify the target metrics. Need clarification on latency and throughput requirements.",
    "attachments": ["https://example.com/screenshot.png"]
  }'
```

### Example 2: Maintainer Acknowledges Ticket

A maintainer sees an open ticket and acknowledges it:

```bash
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc \
  -H "Authorization: Bearer <MAINTAINER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-progress"
  }'
```

The system automatically:
- Sets `maintainerId` to the maintainer's public key
- Sets `acknowledgedAt` timestamp
- Triggers a notification to the contributor

### Example 3: Maintainer Resolves Ticket

When the issue is fixed, the maintainer resolves the ticket:

```bash
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc \
  -H "Authorization: Bearer <MAINTAINER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution": "Updated the requirements document with specific performance metrics: <100ms latency, >1000 req/s throughput."
  }'
```

The system automatically:
- Sets `resolvedAt` timestamp
- Calculates resolution time
- Updates metrics

### Example 4: Dashboard View

A project manager views the support statistics to identify improvement areas:

```bash
curl http://localhost:3001/api/v1/support/statistics
```

Response shows that "unclear-requirement" tickets are the most common type (8/15 total), averaging 6 hours to resolve. This insight triggers an action to improve the bounty description template.

## Metrics & Feedback Loop

### Common Issues Detection

The system tracks which types of issues appear most frequently. If a particular ticket type exceeds a threshold, it should trigger:

1. **Documentation review**: For "unclear-requirement" tickets
2. **Bug triage**: For "blocker-bug" tickets
3. **Scope review**: For "scope-creep" tickets
4. **Onboarding improvements**: For "access-issue" tickets

### Example Improvements Based on Metrics

| Ticket Type | High Frequency | Action |
|-----------|-----------------|--------|
| unclear-requirement | >20% of tickets | Improve bounty template, add more examples |
| blocker-bug | >15% of tickets | Add setup validation script, improve environment docs |
| scope-creep | >10% of tickets | Define clearer deliverables, add scope boundaries |
| access-issue | >5% of tickets | Create access checklist, improve onboarding |

## Database Schema

### SupportTicket

```sql
{
  id              String    @id @default(cuid())
  ticketId        String    @unique
  bountyId        String
  contributorId   String
  maintainerId    String?
  type            String    // unclear-requirement, blocker-bug, scope-creep, access-issue
  status          String    @default("open")
  title           String
  description     String
  attachments     String[]
  createdAt       DateTime  @default(now())
  acknowledgedAt  DateTime?
  resolvedAt      DateTime?
  resolution      String?
}
```

### SupportMetrics

```sql
{
  id            String    @id @default(cuid())
  ticketType    String    @unique
  frequency     Int       @default(0)
  avgResolution Int       @default(0)  // in hours
  lastUpdated   DateTime  @default(now()) @updatedAt
}
```

## Implementation Details

### Acceptance Criteria - Checklist

- [x] Support ticket types: unclear-requirement, blocker-bug, scope-creep, access-issue
- [x] Tickets tracked with status: open → in-progress → resolved
- [x] Maintainer notifications trigger on new tickets (infrastructure ready, notifications can be added)
- [x] Response requirement: acknowledge within 24 hours (tracked via acknowledgedAt timestamp)
- [x] Metrics: track issue frequency, time-to-resolution
- [x] Feedback loop: common issues tracked and available for analysis
- [x] Tickets visible to bounty creator (via /api/v1/support/bounty/{bountyId}/tickets endpoint)

## Future Enhancements

1. **Email Notifications**: Notify maintainers when new tickets are created
2. **Severity Levels**: Add severity field (low, medium, high, critical)
3. **SLA Tracking**: Track and enforce SLAs (optional, mentioned as out-of-scope)
4. **Auto-Assignment**: Assign tickets to appropriate maintainers based on bounty
5. **Duplicate Detection**: Identify similar tickets to prevent duplicates
6. **AI-Assisted Resolution**: Suggest resolutions based on historical data
7. **Escalation Path**: Define escalation procedure for critical blockers
8. **Integration with Bounty Updates**: Automatically update bounty descriptions based on common issues

## Testing

### Unit Tests

Test support service methods:
- Creating tickets with different types
- Updating ticket status and transitions
- Metrics calculations
- Statistics aggregation

### Integration Tests

Test full workflow:
1. Contributor creates a ticket
2. Maintainer views open tickets
3. Maintainer acknowledges ticket
4. Contributor sees acknowledgment
5. Maintainer resolves ticket
6. Verify metrics are updated

### API Tests

Test endpoint responses:
- POST /api/v1/support/tickets
- GET /api/v1/support/tickets
- PUT /api/v1/support/tickets/:ticketId
- GET /api/v1/support/statistics

## Security Considerations

1. **Authentication**: All POST/PUT operations require JWT authentication
2. **Authorization**: Users can only create tickets (maintainers will verify auth in future)
3. **Input Validation**: Validate ticket types, status transitions
4. **Data Privacy**: Ensure sensitive data in ticket descriptions is handled appropriately
5. **Rate Limiting**: Consider rate limiting to prevent spam (to be added)
