import Queue from '../../../lib';

const redisQueue = new Queue('first-queue', 'redis://127.0.0.1:6379');
// const dfQueue = new Queue('first-queue-df', 'redis://127.0.0.1:6380', { connectTimeout: 5000 });
// console.log('Dragonfly queue connected');

const worker = (job: unknown) => {
  const random = Math.random();
  console.log('😊 -> worker -> random:', random);
  if (random > 0.5) {
    throw new Error('Something went wrong');
  }
  console.log('😊 -> worker -> job:', JSON.stringify(job));
};
redisQueue.process(worker);

// for (let index = 0; index < 5; index++) {
//   redisQueue.schedule('Hello World!' + index).catch(console.error);
// }
// setTimeout(() => {
//   for (let index = 0; index < 5; index++) {
//     redisQueue.schedule('Hello World!' + index).catch(console.error);
//   }
// }, 10000);
// redisQueue.schedule('custom_id 2', 'Hello World with id!').catch(console.error);

redisQueue.on(`first-queue:job:complete`, (data) => {
  return console.log('Listened from queue', data);
});
// dfQueue.schedule('Hello World!').catch(console.error);
// dfQueue.schedule('custom_id 2', 'Hello World with id!').catch(console.error);
