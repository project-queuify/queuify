const promisifyFunction =
  (fn) =>
  (...args) =>
    new Promise((resolve, reject) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    });

process.on('message', (data) => {
  const job = data.job;
  const sharedData = data.sharedData;
  const worker = promisifyFunction(new Function('return ' + data.workerFunction)());
  if (sharedData?.global) {
    for (const [key, value] of Object.entries(sharedData.global)) {
      global[key] = value;
    }
  }
  worker(job)
    .then((result) => {
      console.log('😊 -> .then -> result:', result);
      process.send({ status: 'completed', result });
    })
    .catch((error) => {
      console.log('😊 -> process.on -> error:', error);
      process.send({ status: 'failed', error });
    });
});
