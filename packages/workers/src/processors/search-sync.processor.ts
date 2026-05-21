import { Job } from 'bullmq';
import { Client } from '@elastic/elasticsearch';
import type { SearchSyncJobData } from '../queues';

const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const INDEX_NAME = 'classes';

const esClient = new Client({ node: ES_NODE });

async function ensureIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: INDEX_NAME });
  if (!exists) {
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          analysis: {
            analyzer: {
              russian_custom: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'russian_stemmer'],
              },
            },
            filter: {
              russian_stemmer: {
                type: 'stemmer',
                language: 'russian',
              },
            },
          },
        },
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'russian_custom' },
            description: { type: 'text', analyzer: 'russian_custom' },
            subject: { type: 'keyword' },
            teacherName: { type: 'text' },
            ageMin: { type: 'integer' },
            ageMax: { type: 'integer' },
            priceFrom: { type: 'float' },
            rating: { type: 'float' },
            updatedAt: { type: 'date' },
          },
        },
      },
    });
    console.log(`[search-sync] created index "${INDEX_NAME}"`);
  }
}

let indexEnsured = false;

export async function processSearchSyncJob(
  job: Job<SearchSyncJobData>,
): Promise<void> {
  const { action, classId, data } = job.data;

  if (!indexEnsured) {
    await ensureIndex();
    indexEnsured = true;
  }

  switch (action) {
    case 'upsert': {
      if (!data) {
        throw new Error('upsert action requires data field');
      }
      await esClient.index({
        index: INDEX_NAME,
        id: classId,
        body: {
          ...data,
          updatedAt: new Date().toISOString(),
        },
      });
      console.log(`[search-sync] upserted class ${classId}`);
      break;
    }

    case 'delete': {
      try {
        await esClient.delete({ index: INDEX_NAME, id: classId });
        console.log(`[search-sync] deleted class ${classId}`);
      } catch (err: unknown) {
        const esErr = err as { meta?: { statusCode?: number } };
        if (esErr.meta?.statusCode === 404) {
          console.log(`[search-sync] class ${classId} not found, skipping delete`);
        } else {
          throw err;
        }
      }
      break;
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown search-sync action: ${_exhaustive}`);
    }
  }
}
