import { IsString, IsInt, IsNotEmpty, Min } from 'class-validator';

export class MintCreditsDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  serialStart: string;

  @IsString()
  @IsNotEmpty()
  metadataCid: string;
}

export class RetireCreditsDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  beneficiary: string;

  @IsString()
  @IsNotEmpty()
  retirementReason: string;
}
