import { createConnection } from 'node:net';

import { tUnknownObject } from '../types';
import { tJobData } from '../types/child_process';
import { MISC, QUEUE_EVENTS } from './constants';
import { generateId, promisifyFunction, waitForProcessResponse } from './utils';

const maxTimeToWaitForProcessResponse = 6 * 1000;

const emitter = process.on(MISC.MESSAGE, async (data: tJobData & { eventId?: string }) => {
  console.log('😊 -> process.on -> data: triggered', data);

  // if data has eventId that means that it is meant for another listener, So we just want to ignore that signal on the top level processor!
  if (data.eventId) return;
  try {
    const job = data.job;
    let skipEvents = false;

    const server  = createConnection();

    job.complete = async (result) => {
      skipEvents = true;
      process?.send?.({ action: QUEUE_EVENTS.JOB_COMPLETE, data: result });
    };
    job.update = async (data) => {
      const eventId = generateId(QUEUE_EVENTS.JOB_UPDATE);
      // Wait for a parent process to give a response for job update
      console.log('Waiting for job update response...', eventId);
      await waitForProcessResponse(
        process,
        { eventId: eventId, action: QUEUE_EVENTS.JOB_UPDATE, data },
        maxTimeToWaitForProcessResponse,
      );
      console.log('Job update response received...', eventId);
    };
    job.failed = async (error) => {
      skipEvents = true;
      process?.send?.({ action: QUEUE_EVENTS.JOB_FAIL, error });
    };
    const sharedData = data.sharedData;
    if (sharedData?.global) {
      for (const [key, value] of Object.entries(sharedData.global)) {
        (global as tUnknownObject)[key] = value;
      }
    }
    const sourceData = data.workerSource;
    const { workerFilePath, workerFuncName } = sourceData;
    const workerFunc = await import(workerFilePath).then((m) => m?.[workerFuncName]);
    const worker = promisifyFunction(workerFunc);
    worker(job)
      .then((result) => {
        if (skipEvents) return;
        process?.send?.({ action: QUEUE_EVENTS.JOB_COMPLETE, data: result });
      })
      .catch((error) => {
        if (skipEvents) return;
        process?.send?.({ action: QUEUE_EVENTS.JOB_FAIL, error });
      });
  } catch (error) {
    let cleanedError = error;
    try {
      // Clean ansi from the terminal output!
      cleanedError = {
        message: ((error as tUnknownObject)?.message as string)?.replace?.(
          // eslint-disable-next-line no-control-regex
          /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
          '',
        ),
        ...(error as tUnknownObject),
      };
    } catch (_error) {
      // Do nothing if there's an error
    }
    process?.send?.({ action: QUEUE_EVENTS.JOB_FAIL, error: cleanedError });
  }
});

emitter.on('message', (...args) => console.log('argsssss', ...args));
