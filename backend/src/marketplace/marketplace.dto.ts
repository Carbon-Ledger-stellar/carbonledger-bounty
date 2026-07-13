import { IsString, IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  pricePerCredit: string;
}

export class PurchaseDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  buyerKey: string;
}
