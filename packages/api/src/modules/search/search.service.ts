import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface SearchFilters {
  subject?: string;
  ageMin?: number;
  ageMax?: number;
  priceMin?: number;
  priceMax?: number;
}

export interface SearchResult {
  hits: Array<{
    id: string;
    score: number;
    [key: string]: unknown;
  }>;
  total: number;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;
  private available = false;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      await this.ensureIndex();
      this.available = true;
    } catch {
      console.warn('Elasticsearch not available, search will be degraded');
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  private async ensureIndex() {
    const exists = await this.client.indices.exists({ index: 'classes' });
    if (!exists) {
      await this.client.indices.create({
        index: 'classes',
        body: {
          settings: {
            analysis: {
              filter: {
                russian_stop: {
                  type: 'stop',
                  stopwords: '_russian_',
                },
                russian_stemmer: {
                  type: 'stemmer',
                  language: 'russian',
                },
              },
              analyzer: {
                russian_custom: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'russian_stop',
                    'russian_stemmer',
                  ],
                },
              },
            },
          },
          mappings: {
            properties: {
              title: {
                type: 'text',
                analyzer: 'russian_custom',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: {
                type: 'text',
                analyzer: 'russian_custom',
              },
              subject: { type: 'keyword' },
              ageMin: { type: 'integer' },
              ageMax: { type: 'integer' },
              price: { type: 'float' },
              teacherName: {
                type: 'text',
                analyzer: 'russian_custom',
              },
              rating: { type: 'float' },
              reviewCount: { type: 'integer' },
              status: { type: 'keyword' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
    }
  }

  async indexClass(classData: {
    id: string;
    title: string;
    description: string;
    subject: string;
    ageMin: number;
    ageMax: number;
    price: number;
    teacherName: string;
    rating?: number;
    reviewCount?: number;
    status: string;
    createdAt?: string;
  }) {
    if (!this.available) return;
    await this.client.index({
      index: 'classes',
      id: classData.id,
      body: classData,
    });
  }

  async searchClasses(
    query: string,
    filters?: SearchFilters,
    options?: { from?: number; size?: number; sort?: string },
  ): Promise<SearchResult> {
    if (!this.available) {
      return { hits: [], total: 0 };
    }

    const must: Record<string, unknown>[] = [
      {
        multi_match: {
          query,
          fields: ['title^3', 'description', 'subject^2', 'teacherName'],
          fuzziness: 'AUTO',
          analyzer: 'russian_custom',
        },
      },
    ];

    const filter: Record<string, unknown>[] = [
      { term: { status: 'PUBLISHED' } },
    ];

    if (filters?.subject) {
      filter.push({ term: { subject: filters.subject } });
    }
    if (filters?.ageMin !== undefined) {
      filter.push({ range: { ageMin: { gte: filters.ageMin } } });
    }
    if (filters?.ageMax !== undefined) {
      filter.push({ range: { ageMax: { lte: filters.ageMax } } });
    }
    if (filters?.priceMin !== undefined) {
      filter.push({ range: { price: { gte: filters.priceMin } } });
    }
    if (filters?.priceMax !== undefined) {
      filter.push({ range: { price: { lte: filters.priceMax } } });
    }

    const sortClause = this.buildSortClause(options?.sort);

    const result = await this.client.search({
      index: 'classes',
      body: {
        query: {
          bool: { must, filter },
        },
        from: options?.from ?? 0,
        size: options?.size ?? 20,
        sort: sortClause,
      },
    });

    return {
      hits: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
      total: (result.hits.total as any)?.value ?? 0,
    };
  }

  /** @deprecated Use searchClasses instead */
  async search(query: string, filters?: { subject?: string; ageMin?: number; ageMax?: number }) {
    return this.searchClasses(query, filters);
  }

  async removeClass(id: string) {
    if (!this.available) return;
    try {
      await this.client.delete({ index: 'classes', id });
    } catch {
      // Document may not exist in index
    }
  }

  private buildSortClause(sort?: string): Array<Record<string, unknown>> {
    switch (sort) {
      case 'rating':
        return [{ rating: { order: 'desc' } }, '_score'];
      case 'price_asc':
        return [{ price: { order: 'asc' } }, '_score'];
      case 'price_desc':
        return [{ price: { order: 'desc' } }, '_score'];
      case 'newest':
        return [{ createdAt: { order: 'desc' } }, '_score'];
      default:
        return ['_score'];
    }
  }
}
