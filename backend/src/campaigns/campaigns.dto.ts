import { IsString, IsDate, IsInt, IsArray, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampaignDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  goal?: number; // default 50
}

export class UpdateCampaignDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  goal?: number;
}

export class AddBountiesCampaignDto {
  @IsString()
  campaignId: string;

  @IsArray()
  @IsString({ each: true })
  bountyIds: string[];
}

export class RemoveBountyFromCampaignDto {
  @IsString()
  campaignId: string;

  @IsString()
  bountyId: string;
}

export class SetFeaturedBountiesDto {
  @IsString()
  campaignId: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(5)
  featuredBountyIds: string[];
}

export class UpdateLeaderboardDto {
  @IsString()
  campaignId: string;

  @IsString()
  contributorId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  earnings?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  completions?: number;
}

export class CampaignResponse {
  id: string;
  campaignId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  goal: number;
  status: string;
  featuredBounties: string[];
  bountyCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class LeaderboardResponse {
  id: string;
  contributorId: string;
  earnings: number;
  completions: number;
  bonus: number;
  rank: number;
}
