import Queue from '../../../lib';

new Queue('first-queue', 'redis://127.0.0.1:6379', { connectTimeout: 5000 });
