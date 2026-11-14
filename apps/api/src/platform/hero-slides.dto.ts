import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HeroSlideItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  badge?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  buttonText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  buttonUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000000)
  mobileImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  hideOverlay?: boolean;

  @IsOptional()
  @IsBoolean()
  onlyImage?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  bgGradient?: string;
}

export class UpdateHeroSlidesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeroSlideItemDto)
  slides!: HeroSlideItemDto[];
}
