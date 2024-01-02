global.queuifyConfig = { batchConcurrency: 2, debug: true };

import './queues/first-queue';
console.log('first queue started');
import './queues/second-queue';
console.log('second queue started');
import './queues/third-queue';
console.log('third queue started');
