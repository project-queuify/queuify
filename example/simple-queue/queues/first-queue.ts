import Queue from '../../../lib';
import { QUEUE_EVENTS } from '../../../lib/helpers/constants';

const redisQueue = new Queue('first-queue', 'redis://127.0.0.1:6379');
const dfQueue = new Queue('first-queue-df', 'redis://127.0.0.1:6380', { connectTimeout: 5000 });

const worker = (job: unknown) => {
  const random = Math.random();
  if (random > 0.5) {
    throw new Error('Something went wrong');
  }
  console.log('😊 -> worker -> job:', JSON.stringify(job));
};
redisQueue.process(worker);
dfQueue.process(worker);

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
