import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private client: Client;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      await this.ensureIndex();
    } catch {
      console.warn('Elasticsearch not available, search will be degraded');
    }
  }

  private async ensureIndex() {
    const exists = await this.client.indices.exists({ index: 'classes' });
    if (!exists) {
      await this.client.indices.create({
        index: 'classes',
        body: {
          mappings: {
            properties: {
              title: { type: 'text', analyzer: 'standard' },
              description: { type: 'text', analyzer: 'standard' },
              subject: { type: 'keyword' },
              ageMin: { type: 'integer' },
              ageMax: { type: 'integer' },
              price: { type: 'float' },
              teacherName: { type: 'text' },
              status: { type: 'keyword' },
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
    status: string;
  }) {
    await this.client.index({
      index: 'classes',
      id: classData.id,
      body: classData,
    });
  }

  async search(query: string, filters?: { subject?: string; ageMin?: number; ageMax?: number }) {
    const must: Record<string, unknown>[] = [
      {
        multi_match: {
          query,
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
  }

  async removeClass(id: string) {
    await this.client.delete({ index: 'classes', id });
  }
}
