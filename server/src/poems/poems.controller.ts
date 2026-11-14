import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { PoemQueryDto, RandomPoemQueryDto } from './poem-query.dto.js'
import { PoemsService } from './poems.service.js'

@Controller('poems')
export class PoemsController {
  constructor(private readonly poems: PoemsService) {}

  @Get()
  list(@Query() query: PoemQueryDto) {
    return this.poems.list(query)
  }

  @Get('featured')
  featured() {
    return this.poems.featured()
  }

  @Get('random')
  random(@Query() query: RandomPoemQueryDto) {
    return this.poems.random(query.exclude)
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.poems.detail(id)
  }
}
