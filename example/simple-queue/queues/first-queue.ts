import Queue from '../../../lib';

new Queue('first-queue', 'redis://127.0.0.1:6379', { connectTimeout: 5000 });
console.log('Redis queue connected');
new Queue('first-queue', 'redis://127.0.0.1:6380', { connectTimeout: 5000 });
console.log('Dragonfly queue connected');
