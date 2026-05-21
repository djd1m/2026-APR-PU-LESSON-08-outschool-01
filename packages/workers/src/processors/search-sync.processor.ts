import { Job, Worker } from 'bullmq';
import { Client } from '@elastic/elasticsearch';
import { QUEUES } from '../queues';

const INDEX_NAME = 'classes';

interface SearchSyncJobData {
  action: 'index' | 'update' | 'delete';
  classId: string;
  data?: {
    title: string;
    description: string;
    subject: string;
    ageMin: number;
    ageMax: number;
    price: number;
    rating: number;
    teacherName: string;
  };
}

async function processSearchSync(job: Job<SearchSyncJobData>): Promise<void> {
  const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
  const { action, classId, data } = job.data;

  switch (action) {
    case 'index':
    case 'update':
      if (!data) throw new Error('Data required for index/update');
      await esClient.index({ index: INDEX_NAME, id: classId, document: data });
      console.log(`[search-sync] ${action} class ${classId}`);
      break;
    case 'delete':
      await esClient.delete({ index: INDEX_NAME, id: classId }).catch(() => {});
      console.log(`[search-sync] deleted class ${classId}`);
      break;
  }
}

export function createSearchSyncWorker(connectionUrl: string) {
  return new Worker(QUEUES.SEARCH_SYNC, processSearchSync, {
    connection: { url: connectionUrl },
    concurrency: 5,
  });
}
