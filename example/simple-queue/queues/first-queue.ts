import { Redis } from 'ioredis';
import Queue from '../../../lib';
import { QUEUE_EVENTS, WORKER_TYPES } from '../../../lib/helpers/constants';

const redisQueue = new Queue({ name: 'first-queue', maxConcurrency: 1 });
// const dfQueue = new Queue({ name: 'first-queue-df', maxConcurrency: 3 }, 'redis://127.0.0.1:6380', {
//   connectTimeout: 5000,
// });

async function sleep(number: number) {
  await new Promise((resolve) => setTimeout(resolve, number));
}

global.redis = new Redis();
const inlineProcessor = async (job: any) => {
  // const random = Math.random();
  // if (random > 0.75) {
  //   console.log(`inlineProcessor -> ${job.id} will be completed now`);
  //   return;
  // }
  await job.update({ test: 'data' });
  await sleep(5000);
};

const main = async () => {
  await redisQueue.process(
    { workerFilePath: '../../workers/worker', workerFuncName: 'worker', maxTimeToWaitForServer: 70000 },
    { sharedData: { global: { redis: global.redis } } },
  );
  // await dfQueue.process(
  //   { workerFilePath: '../../workers/worker', workerFuncName: 'worker' },
  //   { sharedData: { global: { redis: global.redis } } },
  // );

  // Embedded Workers
  await redisQueue.process(inlineProcessor, {
    type: WORKER_TYPES.EMBEDDED,
    sharedData: { global: { redis: global.redis } },
  });
  // await dfQueue.process(inlineProcessor, { type: WORKER_TYPES.EMBEDDED, sharedData: { global: { redis: global.redis } } });

  redisQueue.schedule('Hello World! rd').catch(console.error);
  // dfQueue.schedule('Hello World! rd').catch(console.error);

  for (let index = 0; index < 5; index++) {
    const random = Math.random();
    let str = 'Hello World! queue rd' + index;
    let data = random > 0.5 ? str : { str };
    redisQueue.schedule(data).catch(console.error);
    str = 'Hello World timeout! queue df' + index;
    data = random > 0.5 ? str : { str };
    // dfQueue.schedule(data).catch(console.error);
  }

  setTimeout(() => {
    for (let index = 0; index < 5; index++) {
      const random = Math.random();
      let str = 'Hello World timeout! queue rd' + index;
      let data = random > 0.5 ? str : { str };
      redisQueue.schedule(data).catch(console.error);
      str = 'Hello World timeout! queue df' + index;
      data = random > 0.5 ? str : { str };
      // dfQueue.schedule(data).catch(console.error);
    }
  }, 10000);

  redisQueue.on(QUEUE_EVENTS.JOB_COMPLETE, (data) => {
    return console.log('Job is completed', data);
  });
  redisQueue.on(QUEUE_EVENTS.JOB_ADD, (data) => {
    return console.log('Job is scheduled', data);
  });
  redisQueue.on(QUEUE_EVENTS.JOB_PROCESS, (data) => {
    return console.log('Job is now being processed', data);
  });
  // dfQueue.on(QUEUE_EVENTS.JOB_COMPLETE, (data) => {
  //   return console.log('Listened from df queue', data);
  // });
};

main();
