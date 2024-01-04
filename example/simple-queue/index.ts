global.queuifyConfig = { batchConcurrency: 2, debug: true, compressData: true, dbOptions: ['redis://127.0.0.1:6379'] };

import './queues/first-queue';
console.log('first queue started');
// import './queues/second-queue';
// console.log('second queue started');
// import './queues/third-queue';
// console.log('third queue started');
