export class CreateSupportTicketDto {
  bountyId: string;
  type: 'unclear-requirement' | 'blocker-bug' | 'scope-creep' | 'access-issue';
  title: string;
  description: string;
  attachments?: string[];
}

export class UpdateSupportTicketDto {
  status?: 'open' | 'in-progress' | 'resolved';
  resolution?: string;
  maintainerId?: string;
}

export class SupportTicketResponseDto {
  id: string;
  ticketId: string;
  bountyId: string;
  contributorId: string;
  maintainerId: string | null;
  type: string;
  status: string;
  title: string;
  description: string;
  attachments: string[];
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolution: string | null;
}
