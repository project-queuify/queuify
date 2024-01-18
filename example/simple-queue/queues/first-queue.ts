import { Redis } from 'ioredis';
import Queue from '../../../lib';
import { QUEUE_EVENTS, WORKER_TYPES } from '../../../lib/helpers/constants';

const redisQueue = new Queue('first-queue');

const dfQueue = new Queue('first-queue-df', 'redis://127.0.0.1:6380', { connectTimeout: 5000 });

global.redis = new Redis();

const worker = (job: unknown) => {
  console.log(global.redis?.options?.port);
  const random = Math.random();
  if (random > 0.5) {
    throw new Error('Something went wrong');
  }
  console.log('😊 -> worker -> job:', JSON.stringify(job));
};

redisQueue.process(worker, { type: WORKER_TYPES.SANDBOX, sharedData: { global: { redis: global.redis } } });
dfQueue.process(worker, { type: WORKER_TYPES.SANDBOX, sharedData: { global: { redis: global.redis } } });

for (let index = 0; index < 5; index++) {
  redisQueue.schedule('Hello World! rd' + index).catch(console.error);
  dfQueue.schedule('Hello World! df' + index).catch(console.error);
}

setTimeout(() => {
  for (let index = 0; index < 5; index++) {
    redisQueue.schedule('Hello World! rd' + index).catch(console.error);
    dfQueue.schedule('Hello World! df' + index).catch(console.error);
  }
}, 10000);

redisQueue.on(QUEUE_EVENTS.JOB_COMPLETE, (data) => {
  return console.log('Listened from queue', data);
});
dfQueue.on(QUEUE_EVENTS.JOB_COMPLETE, (data) => {
  return console.log('Listened from queue', data);
});
