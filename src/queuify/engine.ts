import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';
import { AddressInfo, createServer, Server, Socket } from 'node:net';
import { ChildProcess, spawn } from 'child_process';
import { join as pathJoin } from 'path';

import {
  checkExisting,
  compressData,
  connectToDb,
  DBActions,
  generateId,
  promisifyFunction,
  toMillis,
  withErrors,
} from '../helpers';
import {
  tJob,
  tPlainJob,
  tQueue,
  tQueueEngine,
  tQueueMapValue,
  tUnknownObject,
  tWorkerConfig,
  tWorkerSandboxSource,
} from '../types';
import {
  DEFAULT_MAX_CONCURRENCY,
  ENGINE_STATUS,
  ENTITIES,
  MISC,
  PREFIXES,
  QUEUE_EVENTS,
  QUEUIFY_JOB_STATUS,
  WORKER_STATUS,
  WORKER_TYPES,
} from '../helpers/constants';
import { ALREADY_EXISTS, INVALID_JOB_DATA } from '../helpers/messages';
import killProcessTree from '../helpers/tree-kill';

export const shouldCompressData = !!globalThis.queuifyConfig?.compressData;

class QueuifyEngine extends EventEmitter implements tQueueEngine {
  status = ENGINE_STATUS.NONE;
  debug = !!globalThis.queuifyConfig?.debug;
  queues: Map<string, tQueueMapValue> = new Map();
  // Queue Engine can have their own DB which is set only when we have a global option available.
  // When creating a Queue without DB options, It will use this global connection!
  globalDb: Redis | null = null;
  server!: Server;
  private serverAddress!: AddressInfo;
  private jobUpdaters: Map<string, (newData: tUnknownObject | string) => Promise<void>> = new Map();

  constructor() {
    super();
    // Start the engine
    this.debugLog('Starting the queue engine');
    this.status = ENGINE_STATUS.STARTING;
    if (globalThis.queuifyConfig?.dbOptions) {
      this.globalDb = connectToDb(...globalThis.queuifyConfig.dbOptions);
    }

    // Initialize server to communicate with a child process
    this.initializeCommunicationServer();

    // The Engine is started!
    this.status = ENGINE_STATUS.RUNNING;
  }

  private initializeCommunicationServer() {
    this.server = createServer();

    this.server.on(MISC.CONNECTION, (socket: Socket) => {
      this.debugLog('Child process connected via socket');
      socket.on(MISC.DATA, (stream: Buffer) => {
        const payload = JSON.parse(stream.toString());
        const jobId = payload.jobId;
        this.debugLog(
          `Update request received from child process for job ${jobId} with new data being "${JSON.stringify(
            payload.data,
          )}"`,
        );
        const updater = this.jobUpdaters.get(jobId);
        if (!updater) {
          this.debugLog(
            `No updater was found for job ${jobId},`,
            'This is likely to be an error with Queuify Engine. Kindly Report it to us!',
          );
          return;
        }
        updater(payload.data)
          .then(() => {
            socket.write(JSON.stringify({ eventId: payload.eventId }));
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : 'Error while updating job data for child process';
            socket.write(JSON.stringify({ eventId: payload.eventId, errorMessage }));
            this.debugError(errorMessage, error);
          });
      });
    });

    this.server.listen(() => {
      const address = this.server.address();
      if (!address) return;
      if (typeof address === 'string') {
        const addressSplit = address.split(':');
        const serverPort = addressSplit.pop() as string;
        this.serverAddress = { address: addressSplit.join(':'), port: +serverPort.replace(/\/.*/, ''), family: 'IPv4' };
      } else {
        this.serverAddress = address;
      }
    });
  }

  private debugLog(...args: unknown[]) {
    if (this.debug) {
      console.log('[Queuify]:', ...args);
    }
  }

  private debugError(...args: unknown[]) {
    if (this.debug) {
      console.error('[Queuify]:', ...args);
    }
  }

  public start(queue: tQueue, shouldCompressData = false) {
    if (!queue.db) throw new Error('Queue db is required');

    const queueName = queue.name;
    checkExisting(this.queues.get(queueName), ALREADY_EXISTS(ENTITIES.QUEUE, queueName));

    this.queues.set(queueName, {
      queue,
      dbActions: new DBActions(queue.db),
      workers: new Map(),
      idleWorkers: new Set(),
      isStalledJobsProcessingComplete: false,
      shouldCompressData,
    });
    this.emit(QUEUE_EVENTS.QUEUE_ADD, queueName);
  }

  public async addJob(queueName: string, jobId: string, data: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    await queue.dbActions.addJob(queueName, jobId, data);
    this.emit(`${queueName}:${QUEUE_EVENTS.JOB_ADD}`, queueName);

    if (queue.idleWorkers.size) {
      const workerIds = [...queue.idleWorkers];
      const idleWorkerId = workerIds.shift();
      if (!idleWorkerId) return;
      this.debugLog(
        `Removing worker ${idleWorkerId} from idle worker pool of queue ${queueName} because it will now request for jobs!`,
      );
      queue.idleWorkers.delete(idleWorkerId);
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, { queueName, workerId: idleWorkerId });
    }
  }

  public async addWorker(
    queueName: string,
    workerFunction: tWorkerSandboxSource | ((...args: unknown[]) => unknown),
    workerConfig: tWorkerConfig = {},
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    const hasWorkers = queue.workers.size > 0;
    const workerId = generateId();
    queue.workers.set(workerId, {
      worker: workerFunction,
      jobs: [],
      status: WORKER_STATUS.IDLE,
      config: workerConfig,
    });
    this.debugLog(
      `Added new worker ${workerId} to queue ${queueName}! If you don't see a notification of worker being added to worker pool, Kindly make sure that you are awaiting for .process method of the queue!`,
    );

    if (!hasWorkers) await this.startWorkers(queueName);

    this.emit(`${queueName}:${QUEUE_EVENTS.WORKER_ADD}`, { queueName, workerId });
  }

  private async onWorkerAdd({ queueName, workerId }: { queueName: string; workerId: string }) {
    this.debugLog(`Added new worker ${workerId} of queue ${queueName} to worker pool!`);
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const workerData = queue.workers.get(workerId);
    if (!workerData) return;

    // TODO: Add worker configuration based job pooling
    this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, { queueName, workerId });
  }

  private async onJobsRequest({ queueName, workerId }: { queueName: string; workerId: string }) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const workerData = queue.workers.get(workerId);
    if (!workerData) return;

    // TODO: This concurrency is only used to fetch jobs,
    //  In ideal world we want to make sure that this concurrency control how many jobs are running in parallel
    //  For example, If we have a concurrency of 1 with 3 worker, the real concurrency is 3 instead of one.
    //  To be worked on after community response!
    const concurrency = queue.queue.config.maxConcurrency || DEFAULT_MAX_CONCURRENCY;

    // First prioritize stalled jobs
    let jobs: tPlainJob[] = [];
    if (!queue.isStalledJobsProcessingComplete) {
      jobs = await queue.dbActions.getJobs(queueName, QUEUIFY_JOB_STATUS.STALLED, concurrency);
      if (!jobs.length) {
        queue.isStalledJobsProcessingComplete = true;
      }
    }

    if (!jobs.length) {
      // Then get pending jobs
      jobs = await queue.dbActions.getJobs(queueName, QUEUIFY_JOB_STATUS.PENDING, concurrency);
    }

    if (!jobs.length) {
      // If there are no jobs, Mark it's status as idle, so it can pick other jobs immediately
      const workerData = queue.workers.get(workerId);
      if (workerData) workerData.status = WORKER_STATUS.IDLE;
      if (!queue.idleWorkers.has(workerId)) {
        this.debugLog(
          `Adding worker ${workerId} of queue ${queueName} to idle pool because there are no pending jobs to process!`,
        );
        queue.idleWorkers.add(workerId);
      }
      return;
    }

    workerData.jobs.push(...jobs);
    if (queue.idleWorkers.has(workerId)) {
      this.debugLog(
        `Removing worker ${workerId} of queue ${queueName} from idle pool as it got pending jobs to process!`,
      );
      queue.idleWorkers.delete(workerId);
    }

    this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_PROCESS}`, { queueName, workerId });
  }

  private async onJobsProcess({ queueName, workerId }: { queueName: string; workerId: string }) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const workerData = queue.workers.get(workerId);
    if (!workerData) return;

    // If a worker doesn't have any jobs, Mark it's status as idle, so it can pick other jobs immediately
    if (!workerData.jobs.length) {
      workerData.status = WORKER_STATUS.IDLE;
      if (!queue.idleWorkers.has(workerId)) {
        this.debugLog(
          `Adding worker ${workerId} of queue ${queueName} to idle pool because worker got no jobs at time of processing!`,
        );
        queue.idleWorkers.add(workerId);
      }
      return;
    }

    // Set worker as busy so that it doesn't get picked up by queue
    workerData.status = WORKER_STATUS.BUSY;

    if (!workerData.worker) return;

    let remainingJobs = workerData.jobs.length;
    const isSandbox = workerData.config.type === WORKER_TYPES.SANDBOX;

    // Job handlers
    const onComplete = async (jobId: string) => {
      await queue.dbActions.completeJob(queueName, jobId);
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_COMPLETE}`, jobId);
    };
    const onUpdate = async (job: tJob, newData: unknown, argQueue?: tQueueMapValue) => {
      const jobId = job.id;
      const queueRef = argQueue || queue;
      const existingData = job.data;
      if (typeof newData === 'object' && existingData && typeof existingData === 'object') {
        newData = { ...existingData, ...newData };
      }
      this.debugLog(`Updating job ${jobId} with new data`, JSON.stringify(newData));
      job.data = newData;
      const preparedData = withErrors(
        job.data,
        queueRef.shouldCompressData ? compressData : JSON.stringify,
        INVALID_JOB_DATA,
      );
      await queueRef.dbActions.updateJob(
        queueName,
        job.id,
        queueRef.shouldCompressData ? PREFIXES.LZ_CACHED + preparedData : preparedData,
      );
      this.debugLog(`Updated job ${jobId} with new data`, JSON.stringify(newData));
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_UPDATE}`, jobId);
    };
    const onFailed = async (jobId: string, errorMessage: string) => {
      await queue.dbActions.failJob(queueName, jobId, errorMessage);
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_FAIL}`, jobId);
    };
    const onFinish = (jobId: string, process?: ChildProcess) => {
      remainingJobs--;

      if (!remainingJobs) {
        workerData.status = WORKER_STATUS.IDLE;
        if (!queue.idleWorkers.has(workerId)) {
          this.debugLog(
            `Adding worker ${workerId} of queue ${queueName} to idle pool because it finished all assigned jobs!`,
          );
          queue.idleWorkers.add(workerId);
        }
        this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, { queueName, workerId });
      }

      if (process?.pid) {
        killProcessTree(process.pid, 'SIGKILL', (error) => {
          if (error) {
            return console.error(
              `Error while killing sandboxed process for job "${jobId}" for queue "${queueName}" in worker "${workerId}"! Kindly report this to us!`,
              error,
            );
          }
          this.debugLog(`Killed process ${process.pid} created by sandbox of job ${jobId}`);
        });
      }
      this.jobUpdaters.delete(jobId);
    };

    while (workerData.jobs.length) {
      const job = workerData.jobs.pop() as tJob;
      if (!job) break;

      this.debugLog(`Processing job ${job.id} of queue ${queueName} from worker ${workerId}`);
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_PROCESS}`, job.id);

      job.complete = async () => {
        await onComplete(job.id);
      };
      job.update = async (data) => {
        await onUpdate(job, data);
      };
      job.failed = async (error) => {
        const errorMessage =
          (error as Error)?.message || (typeof error === 'string' && error) || 'Something went wrong';
        await onFailed(job.id, errorMessage);
      };

      if (isSandbox) {
        this.debugLog(`Spawning new sandbox to process job ${job.id}`);

        // Set updaters in class to avail update method for sandboxed processes
        const updaterWithJobContext = (job: tJob, queue: tQueueMapValue) => (newData: tUnknownObject | string) =>
          onUpdate(job, newData, queue);
        this.jobUpdaters.set(job.id, updaterWithJobContext(job, queue));

        const cpPath = pathJoin(process.cwd(), './lib/helpers/child_process.js');
        // TODO: We are using ts-node just in case worker files are typescript ones!
        const sandboxedProcess = spawn('ts-node', [cpPath], {
          detached: true,
          stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        });

        const maxExecutionTime = queue.queue.config.maxExecutionTime;
        let timeout: NodeJS.Timeout;

        if (maxExecutionTime) {
          timeout = setTimeout(() => {
            // Kill sandboxed process along with all child processes, once max execution time is reached
            this.debugLog(
              `Killing sandboxed process for job "${job.id}" for queue "${queueName}" in worker "${workerId}" as max execution time (${maxExecutionTime}s) is reached!`,
            );
            if (sandboxedProcess.pid)
              killProcessTree(sandboxedProcess.pid, 'SIGKILL', (error) => {
                if (error) {
                  return console.error(
                    `Error while killing maximum awaited sandboxed process for job "${job.id}" for queue "${queueName}" in worker "${workerId}"! Kindly report this to us!`,
                    error,
                  );
                }

                const errorMessage = `Job failed due to max execution time (${maxExecutionTime}s) reached!`;
                onFailed(job.id, errorMessage).finally(() => onFinish(job.id));

                this.debugLog(
                  `Killed sandboxed process for job "${job.id}" for queue "${queueName}" in worker "${workerId}"!`,
                );
              });
          }, toMillis(maxExecutionTime));
        }
        sandboxedProcess.on(
          MISC.MESSAGE,
          async (response: {
            action: QUEUE_EVENTS;
            data?: unknown; // New job data during job update
            eventId?: string;
            error?: Error;
          }) => {
            try {
              this.debugLog(`Received message from sandbox for job "${job.id}"`, JSON.stringify(response));
              switch (response.action) {
                case QUEUE_EVENTS.JOB_COMPLETE: {
                  await onComplete(job.id);
                  break;
                }
                case QUEUE_EVENTS.JOB_FAIL: {
                  await onFailed(job.id, response?.error?.message || 'Something went wrong');
                  break;
                }
              }
            } catch (error) {
              this.debugLog(`An error while processing sandbox message for job "${job.id}"!`, error);
            } finally {
              clearTimeout(timeout);
              onFinish(job.id, sandboxedProcess);
            }
          },
        );

        sandboxedProcess.on(MISC.ERROR, async (error) => {
          try {
            await onFailed(job.id, `Spawn Failed! ${error?.message || 'Something went wrong'}`);
          } catch (error) {
            this.debugLog(`An error while spawning sandbox for job "${job.id}"!`, error);
          } finally {
            clearTimeout(timeout);
            onFinish(job.id, sandboxedProcess);
          }
        });

        sandboxedProcess.send({
          job,
          serverAddress: this.serverAddress,
          workerSource: workerData.worker,
          sharedData: workerData.config.sharedData,
        });
        continue;
      }

      this.debugLog(`Processing job ${job.id} via embedded worker`);
      const workerFunction = promisifyFunction(workerData.worker as (...args: unknown[]) => unknown);
      const onFinishWithJobIdContext = (jobId: string) => () => onFinish(jobId);
      workerFunction(job)
        .then(async () => await onComplete(job.id))
        .catch(async (error) => await onFailed(job.id, error?.message))
        .finally(onFinishWithJobIdContext(job.id));
    }
  }

  private async startWorkers(queueName: string) {
    const queueData = this.queues.get(queueName);
    if (!queueData) return;

    await this.startWorkerPool(queueData);

    this.on(`${queueName}:${QUEUE_EVENTS.WORKER_ADD}`, this.onWorkerAdd);
    this.on(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, this.onJobsRequest);
    this.on(`${queueName}:${QUEUE_EVENTS.JOB_POOL_PROCESS}`, this.onJobsProcess);
  }

  private async startWorkerPool(queue: tQueueMapValue) {
    // Move running jobs to a stalled list
    const stalledJobs = await queue.dbActions.moveJobsBetweenLists(
      queue.queue.name,
      QUEUIFY_JOB_STATUS.RUNNING,
      QUEUIFY_JOB_STATUS.STALLED,
    );
    if (!stalledJobs.length) queue.isStalledJobsProcessingComplete = true;
  }
}

const queuifyEngine = new QueuifyEngine();

queuifyEngine.on(QUEUE_EVENTS.QUEUE_ADD, (queueName) => {
  const queueData = queuifyEngine.queues.get(queueName);
  if (!queueData) return;
});

queuifyEngine.on(QUEUE_EVENTS.WORKER_ADD, async (queueName) => {
  const queueData = queuifyEngine.queues.get(queueName);
  if (!queueData) return;
});

export default queuifyEngine;
