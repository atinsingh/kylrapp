/**
 * Background worker (separate ECS service, same image as the API).
 * Each processor is a stub until its integration is contracted.
 */
import { Queue, Worker } from 'bullmq';
import { QUEUES } from './jobs/queues.js';

const connection = { url: process.env.REDIS_URL ?? 'redis://localhost:6379' };

const workers = [
  new Worker(QUEUES.listingFeed, async job => {
    // TODO(PropTx VOW agreement): page the RESO Web API by ModificationTimestamp, upsert listings, honour InternetEntireListingDisplayYN.
    return { skipped: true, reason: 'feed not contracted', jobId: job.id };
  }, { connection }),
  new Worker(QUEUES.deadlines, async job => {
    // TODO: load open conditions/offers/deposits due soon and fan out notifications.
    return { jobId: job.id };
  }, { connection }),
];

await new Queue(QUEUES.listingFeed, { connection }).upsertJobScheduler('feed-every-5m', { every: 5 * 60_000 });
await new Queue(QUEUES.deadlines, { connection }).upsertJobScheduler('deadlines-every-15m', { every: 15 * 60_000 });

const stop = async () => { await Promise.all(workers.map(w => w.close())); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
console.log('Klyr worker running:', Object.values(QUEUES).join(', '));
