import Queue from '../../../lib';

const redisQueue = new Queue('first-queue', 'redis://127.0.0.1:6380');
console.log('Redis queue connected');
const redisQueue2 = new Queue('second-queue');
console.log('Redis queue connected');
const dfQueue = new Queue('first-queue-df', 'redis://127.0.0.1:6380', { connectTimeout: 5000 });
console.log('Dragonfly queue connected');

redisQueue.schedule('Hello World!').catch(console.error);
redisQueue2.schedule('Hello World!').catch(console.error);
redisQueue.schedule('custom_id 2', 'Hello World with id!').catch(console.error);
dfQueue.schedule('Hello World!').catch(console.error);
dfQueue.schedule('custom_id 2', 'Hello World with id!').catch(console.error);
