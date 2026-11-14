import { Transform, Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value
}

export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 12
}

export class SearchDto extends PaginationDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(16)
  dynasty?: string
}

export class PoemQueryDto extends SearchDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(16)
  form?: string

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(32)
  tag?: string

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  author?: string

  @IsIn(['default', 'latest'])
  sort: 'default' | 'latest' = 'default'
}

export class RandomPoemQueryDto {
  @IsOptional()
  @IsUUID('all')
  exclude?: string
}

// Prisma's contains/startsWith filters use LIKE; user wildcards must stay literal.
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&')
}
