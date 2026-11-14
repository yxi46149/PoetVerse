import { Controller, Get, Query } from '@nestjs/common'
import { SearchDto } from '../poems/poem-query.dto.js'
import { CatalogService } from './catalog.service.js'

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('catalog')
  catalog() {
    return this.catalogService.catalog()
  }

  @Get('overview')
  overview() {
    return this.catalogService.overview()
  }

  @Get('dynasties')
  async dynasties() {
    return (await this.catalogService.catalog()).dynasties
  }

  @Get('forms')
  async forms() {
    return (await this.catalogService.catalog()).forms
  }

  @Get('tags')
  async tags() {
    return (await this.catalogService.catalog()).tags
  }

  @Get('authors')
  authors(@Query() query: SearchDto) {
    return this.catalogService.authors(query)
  }
}
