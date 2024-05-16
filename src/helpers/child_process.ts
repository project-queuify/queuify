import { createConnection, Socket } from 'node:net';

import { tUnknownObject } from '../types';
import { tJobData } from '../types/child_process';
import { MISC, QUEUE_EVENTS } from './constants';
import { generateId, promisifyFunction, waitForServerResponse } from './utils';

process.on(
  MISC.MESSAGE,
  async (
    data: tJobData & {
      serverAddress: { host: string; port: number };
    },
  ) => {
    try {
      const job = data.job;
      let skipEvents = false;

      const sourceData = data.workerSource;
      const { workerFilePath, workerFuncName, maxTimeToWaitForServer } = sourceData;
      const maxTimeToWaitForServerResponse = +(maxTimeToWaitForServer || 60 * 1000);

      if (!data.serverAddress) {
        // noinspection ExceptionCaughtLocallyJS`
        throw new Error('Server address not provided');
      }

      const server: Socket = await new Promise((resolve, reject) => {
        const server = createConnection(data.serverAddress.port, data.serverAddress.host, () => {
          resolve(server);
        });
        server.on('error', reject);
        server.on('close', () => {
          reject(new Error('Connection closed'));
        });
        server.on('end', () => {
          reject(new Error('Connection ended'));
        });
      });

      job.complete = async (result) => {
        skipEvents = true;
        process?.send?.({ action: QUEUE_EVENTS.JOB_COMPLETE, data: result });
      };
      job.update = async (data) => {
        const eventId = generateId(QUEUE_EVENTS.JOB_UPDATE);
        // Wait for a parent process to give a response for job update
        await waitForServerResponse(
          server,
          { eventId, jobId: job.id, action: QUEUE_EVENTS.JOB_UPDATE, data },
          maxTimeToWaitForServerResponse,
        );
        job.data = data;
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
  },
);
