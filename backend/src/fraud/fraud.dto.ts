export class CheckFraudDto {
  contributorId: string;
  stellarAddress: string;
  submissionCode?: string;
  submissionTime?: Date;
  bountyId?: string;
  payoutAmountUsd?: number;
}

export class LinkGithubDto {
  contributorId: string;
  githubUsername: string;
  githubUserId: string;
}

export class VerifyStellarDto {
  contributorId: string;
  stellarAddress: string;
  signature: string;
  challenge: string;
}

export class AppealDto {
  fraudLogId: string;
  contributorId: string;
  reason: string;
}

export class ReviewFraudDto {
  fraudLogId: string;
  reviewerId: string;
  decision: 'cleared' | 'confirmed';
  notes?: string;
}
