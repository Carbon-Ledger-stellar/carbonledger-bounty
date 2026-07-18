import { IsEnum, IsOptional, IsString } from 'class-validator';

export type ActivityEventType =
  | 'bounty-created'
  | 'application-submitted'
  | 'reviewed'
  | 'approved'
  | 'rejected'
  | 'completed';

export type FeedSort = 'recent' | 'trending' | 'most-active';

const EVENT_TYPES: ActivityEventType[] = [
  'bounty-created',
  'application-submitted',
  'reviewed',
  'approved',
  'rejected',
  'completed',
];

export class RecordEventDto {
  @IsEnum(EVENT_TYPES)
  type: ActivityEventType;

  @IsString()
  bountyId: string;

  @IsString()
  actorId: string;

  /** User this event should trigger a notification for, if any (e.g. reviewer, applicant). */
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  message: string;
}

export interface FeedQuery {
  bountyId?: string;
  contributorId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  cursor?: string;
  limit?: number;
}
