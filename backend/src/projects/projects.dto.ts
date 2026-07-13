import { IsString, IsInt, IsNotEmpty, Min, Max } from 'class-validator';

export class RegisterProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  methodology: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  projectType: string;

  @IsString()
  @IsNotEmpty()
  metadataCid: string;

  @IsString()
  @IsNotEmpty()
  verifierAddress: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  vintageYear: number;
}

export class VerifyProjectDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;
}
