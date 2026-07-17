# Support Ticket System API Reference

## Overview

The Support Ticket System provides a REST API for managing contributor support tickets. It enables contributors to escalate issues and maintainers to track and resolve them efficiently.

## Base URL

```
http://localhost:3001/api/v1/support
```

## Authentication

Most endpoints (POST, PUT) require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints

### Tickets

#### Create Support Ticket

**POST** `/tickets`

Creates a new support ticket for a bounty escalation.

**Authentication**: Required

**Request Body**:

```json
{
  "bountyId": "string",
  "type": "unclear-requirement" | "blocker-bug" | "scope-creep" | "access-issue",
  "title": "string",
  "description": "string",
  "attachments": ["string"] // optional
}
```

**Response** (201 Created):

```json
{
  "id": "cuid",
  "ticketId": "ticket-uuid",
  "bountyId": "bounty-123",
  "contributorId": "public-key",
  "maintainerId": null,
  "type": "unclear-requirement",
  "status": "open",
  "title": "Brief title",
  "description": "Detailed description",
  "attachments": [],
  "createdAt": "2026-07-16T04:00:00Z",
  "acknowledgedAt": null,
  "resolvedAt": null,
  "resolution": null
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request body or ticket type
- `401 Unauthorized`: Missing or invalid JWT token

**Example**:

```bash
curl -X POST http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "bountyId": "bounty-123",
    "type": "unclear-requirement",
    "title": "Acceptance criteria unclear",
    "description": "Need clarification on performance requirements"
  }'
```

---

#### Get All Support Tickets

**GET** `/tickets`

Retrieves all support tickets with optional filtering.

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `bountyId` | string | Filter by bounty ID | No |
| `contributorId` | string | Filter by contributor public key | No |
| `status` | string | Filter by status (open, in-progress, resolved) | No |
| `type` | string | Filter by ticket type | No |

**Response** (200 OK):

```json
[
  {
    "id": "cuid",
    "ticketId": "ticket-uuid",
    "bountyId": "bounty-123",
    "contributorId": "public-key",
    "type": "unclear-requirement",
    "status": "open",
    "title": "Title",
    "description": "Description",
    "attachments": [],
    "createdAt": "2026-07-16T04:00:00Z",
    "acknowledgedAt": null,
    "resolvedAt": null,
    "resolution": null
  }
]
```

**Example**:

```bash
# Get all open tickets
curl "http://localhost:3001/api/v1/support/tickets?status=open"

# Get all blocker bugs
curl "http://localhost:3001/api/v1/support/tickets?type=blocker-bug"

# Get tickets for a specific bounty
curl "http://localhost:3001/api/v1/support/tickets?bountyId=bounty-123"
```

---

#### Get Single Support Ticket

**GET** `/tickets/{ticketId}`

Retrieves a specific support ticket by ID.

**Authentication**: Not required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | The ticket ID (e.g., ticket-uuid) |

**Response** (200 OK):

```json
{
  "id": "cuid",
  "ticketId": "ticket-uuid",
  "bountyId": "bounty-123",
  "contributorId": "public-key",
  "maintainerId": null,
  "type": "unclear-requirement",
  "status": "open",
  "title": "Title",
  "description": "Description",
  "attachments": [],
  "createdAt": "2026-07-16T04:00:00Z",
  "acknowledgedAt": null,
  "resolvedAt": null,
  "resolution": null
}
```

**Error Responses**:
- `404 Not Found`: Ticket does not exist

**Example**:

```bash
curl http://localhost:3001/api/v1/support/tickets/ticket-abc123
```

---

#### Update Support Ticket

**PUT** `/tickets/{ticketId}`

Updates a support ticket status or resolution (typically by maintainers).

**Authentication**: Required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | string | The ticket ID |

**Request Body**:

```json
{
  "status": "in-progress" | "resolved", // optional
  "resolution": "string", // optional, required if status is "resolved"
  "maintainerId": "string" // optional, auto-set to current user if not provided
}
```

**Response** (200 OK):

```json
{
  "id": "cuid",
  "ticketId": "ticket-uuid",
  "bountyId": "bounty-123",
  "contributorId": "public-key",
  "maintainerId": "maintainer-key",
  "type": "unclear-requirement",
  "status": "in-progress",
  "title": "Title",
  "description": "Description",
  "attachments": [],
  "createdAt": "2026-07-16T04:00:00Z",
  "acknowledgedAt": "2026-07-16T05:00:00Z",
  "resolvedAt": null,
  "resolution": null
}
```

**Error Responses**:
- `400 Bad Request`: Invalid status value
- `401 Unauthorized`: Missing or invalid JWT token
- `404 Not Found`: Ticket does not exist

**Example**:

```bash
# Acknowledge a ticket
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'

# Resolve a ticket
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution": "Updated requirements document with specific performance targets"
  }'
```

---

#### Get Open Tickets (Dashboard)

**GET** `/tickets/status/open`

Retrieves all open tickets for maintainer dashboard.

**Authentication**: Not required

**Response** (200 OK):

```json
[
  {
    "ticketId": "ticket-xyz",
    "status": "open",
    "type": "blocker-bug",
    "title": "Application crashes on startup",
    "createdAt": "2026-07-16T04:00:00Z",
    ...
  }
]
```

**Example**:

```bash
curl http://localhost:3001/api/v1/support/tickets/status/open
```

---

### Bounty Tickets

#### Get Tickets for a Bounty

**GET** `/bounty/{bountyId}/tickets`

Retrieves all support tickets for a specific bounty (transparency for bounty creator).

**Authentication**: Not required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `bountyId` | string | The bounty ID |

**Response** (200 OK):

```json
[
  {
    "ticketId": "ticket-uuid",
    "bountyId": "bounty-123",
    "type": "unclear-requirement",
    "status": "open",
    "title": "Clarification needed",
    "createdAt": "2026-07-16T04:00:00Z",
    ...
  }
]
```

**Example**:

```bash
curl http://localhost:3001/api/v1/support/bounty/bounty-123/tickets
```

---

### Metrics

#### Get All Metrics

**GET** `/metrics`

Retrieves support ticket metrics for all ticket types.

**Authentication**: Not required

**Response** (200 OK):

```json
[
  {
    "id": "metrics-id",
    "ticketType": "unclear-requirement",
    "frequency": 8,
    "avgResolution": 6,
    "lastUpdated": "2026-07-16T05:00:00Z"
  },
  {
    "ticketType": "blocker-bug",
    "frequency": 3,
    "avgResolution": 4,
    "lastUpdated": "2026-07-16T05:00:00Z"
  }
]
```

**Example**:

```bash
curl http://localhost:3001/api/v1/support/metrics
```

---

#### Get Metrics by Type

**GET** `/metrics/{type}`

Retrieves metrics for a specific ticket type.

**Authentication**: Not required

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Ticket type (unclear-requirement, blocker-bug, scope-creep, access-issue) |

**Response** (200 OK):

```json
{
  "id": "metrics-id",
  "ticketType": "blocker-bug",
  "frequency": 3,
  "avgResolution": 4,
  "lastUpdated": "2026-07-16T05:00:00Z"
}
```

**Example**:

```bash
curl http://localhost:3001/api/v1/support/metrics/blocker-bug
```

---

### Statistics

#### Get Overall Statistics

**GET** `/statistics`

Retrieves comprehensive statistics about the support system.

**Authentication**: Not required

**Response** (200 OK):

```json
{
  "totalTickets": 15,
  "openTickets": 2,
  "inProgressTickets": 3,
  "resolvedTickets": 10,
  "avgTimeToAcknowledge": 4,
  "ticketsByType": [
    {
      "ticketType": "unclear-requirement",
      "frequency": 8,
      "avgResolution": 6
    },
    {
      "ticketType": "blocker-bug",
      "frequency": 3,
      "avgResolution": 4
    },
    {
      "ticketType": "scope-creep",
      "frequency": 3,
      "avgResolution": 7
    },
    {
      "ticketType": "access-issue",
      "frequency": 1,
      "avgResolution": 2
    }
  ]
}
```

**Example**:

```bash
curl http://localhost:3001/api/v1/support/statistics
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK - Request succeeded |
| `201` | Created - New resource created |
| `400` | Bad Request - Invalid input or parameters |
| `401` | Unauthorized - Missing or invalid authentication |
| `404` | Not Found - Resource does not exist |
| `500` | Internal Server Error - Server error |

## Data Types

### Ticket Types

- `unclear-requirement` - Requirements are ambiguous or missing
- `blocker-bug` - Critical bug blocking progress
- `scope-creep` - Scope expansion beyond original requirements
- `access-issue` - Missing access or permissions

### Ticket Status

- `open` - Newly created, awaiting maintainer acknowledgment
- `in-progress` - Acknowledged by maintainer, being worked on
- `resolved` - Issue resolved, ticket closed

## Rate Limiting

Currently no rate limiting is enforced. Future versions may implement:
- 100 requests per hour per contributor
- 1000 requests per hour per API key

## Versioning

The API follows semantic versioning. Current version: `v1`

Future versions may introduce breaking changes (e.g., `v2`)

## Common Use Cases

### Use Case 1: Contributor Reports Issue

```bash
# Step 1: Create support ticket
curl -X POST http://localhost:3001/api/v1/support/tickets \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "bountyId": "bounty-123",
    "type": "blocker-bug",
    "title": "Database connection fails",
    "description": "Getting connection timeout when running tests",
    "attachments": ["https://example.com/error-log.txt"]
  }'

# Step 2: Check ticket status (as contributor)
curl http://localhost:3001/api/v1/support/tickets/ticket-abc123
```

### Use Case 2: Maintainer Dashboard

```bash
# Step 1: Get all open tickets
curl http://localhost:3001/api/v1/support/tickets/status/open

# Step 2: Acknowledge a ticket
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc123 \
  -H "Authorization: Bearer $MAINTAINER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}'

# Step 3: Resolve the ticket
curl -X PUT http://localhost:3001/api/v1/support/tickets/ticket-abc123 \
  -H "Authorization: Bearer $MAINTAINER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution": "Fixed database connection pool settings in docs"
  }'
```

### Use Case 3: Program Manager Analysis

```bash
# Get support metrics
curl http://localhost:3001/api/v1/support/statistics

# Get specific issue type metrics
curl http://localhost:3001/api/v1/support/metrics/unclear-requirement
```

## Support

For issues or questions about the API, please create a GitHub issue or contact the development team.
