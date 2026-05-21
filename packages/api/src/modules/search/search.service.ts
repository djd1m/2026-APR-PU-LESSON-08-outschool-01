import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
  private readonly logger = new Logger(SearchService.name);
  private client: Client;
  private available = false;

  private esAvailable = true;
  private esFailCount = 0;
  private readonly ES_MAX_FAILURES = 3;
  private readonly ES_RESET_MS = 30000;

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
      this.logger.warn('Elasticsearch not available, search will be degraded');
    }
  }

  private sanitizeQuery(query: string): string {
    // Escape Elasticsearch special characters to prevent query injection
    return query.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, '\\$&').trim();
  }

  private async withCircuitBreaker<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.esAvailable) return fallback;
    try {
      const result = await fn();
      this.esFailCount = 0;
      return result;
    } catch (error) {
      this.esFailCount++;
      if (this.esFailCount >= this.ES_MAX_FAILURES) {
        this.esAvailable = false;
        this.logger.warn('Elasticsearch circuit breaker OPEN — falling back to DB search');
        setTimeout(() => { this.esAvailable = true; this.esFailCount = 0; }, this.ES_RESET_MS);
      }
      return fallback;
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
              analyzer: {
                russian_custom: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'russian_stop', 'russian_stemmer'],
                },
              },
              filter: {
                russian_stop: { type: 'stop', stopwords: '_russian_' },
                russian_stemmer: { type: 'stemmer', language: 'russian' },
              },
            },
          },
          mappings: {
            properties: {
              title: { type: 'text', analyzer: 'russian_custom' },
              description: { type: 'text', analyzer: 'russian_custom' },
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

  async search(query: string, filters?: { subject?: string; ageMin?: number; ageMax?: number }) {
    const emptyResult = { hits: [], total: 0 };
    const sanitizedQuery = this.sanitizeQuery(query);

    if (!sanitizedQuery) {
      return emptyResult;
    }

    return this.withCircuitBreaker(async () => {
      const must: Record<string, unknown>[] = [
        {
          multi_match: {
            query: sanitizedQuery,
            fields: ['title^3', 'description', 'subject^2', 'teacherName'],
            fuzziness: 'AUTO',
          },
        },
      ];

      const filter: Record<string, unknown>[] = [
        { term: { status: 'PUBLISHED' } },
      ];

      if (filters?.subject) {
        filter.push({ term: { subject: filters.subject } });
      }
      if (filters?.ageMin) {
        filter.push({ range: { ageMin: { gte: filters.ageMin } } });
      }
      if (filters?.ageMax) {
        filter.push({ range: { ageMax: { lte: filters.ageMax } } });
      }

      const result = await this.client.search({
        index: 'classes',
        body: {
          query: {
            bool: { must, filter },
          },
          size: 20,
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
    }, emptyResult);
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
