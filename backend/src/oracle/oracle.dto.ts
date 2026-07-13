import { IsString, IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class SubmitMonitoringDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  period: string;

  @IsInt()
  @Min(1)
  tonnesVerified: number;

  @IsInt()
  @Min(0)
  @Max(100)
  methodologyScore: number;

  @IsString()
  @IsNotEmpty()
  satelliteCid: string;
}
