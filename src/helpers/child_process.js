/* eslint-disable @typescript-eslint/no-var-requires */
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
  try {
    const job = data.job;
    const sharedData = data.sharedData;
    if (sharedData?.global) {
      for (const [key, value] of Object.entries(sharedData.global)) {
        global[key] = value;
      }
    }
    const sourceData = data.workerSource;
    const { workerFilePath, workerFuncName } = sourceData;
    const workerFile = require(workerFilePath);
    const worker = promisifyFunction(workerFile[workerFuncName]);
    worker(job)
      .then((result) => {
        process.send({ status: 'completed', result });
      })
      .catch((error) => {
        process.send({ status: 'failed', error });
      });
  } catch (error) {
    let cleanedError = error;
    try {
      // Clean ansi from the terminal output!
      cleanedError = {
        message: error?.message?.replace?.(
          // eslint-disable-next-line no-control-regex
          /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
          '',
        ),
        ...error,
      };
    } catch (_error) {
      // Do nothing if there's an error
    }
    process.send({ status: 'failed', error: cleanedError });
  }
});
