import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';

import { DBActions, checkExisting, connectToDb, generateId, promisifyFunction } from '../helpers';
import { tJob, tQueue, tQueueEngine, tQueueMapValue } from '../types';
import { ENTITIES, ENGINE_STATUS, QUEUE_EVENTS, QUEUIFY_JOB_STATUS, WORKER_STATUS } from '../helpers/constants';
import { ALREADY_EXISTS } from '../helpers/messages';

class QueuifyEngine extends EventEmitter implements tQueueEngine {
  status = ENGINE_STATUS.NONE;
  debug = !!globalThis.queuifyConfig?.debug;
  queues: Map<string, tQueueMapValue> = new Map();
  // Queue Engine can have their own DB which is set only when we have global option available.
  // When creating a Queue without DB options, It will use this global connection!
  globalDb: Redis | null = null;

  constructor() {
    super();
    // Start the engine
    this.debugLog('Starting the queue engine');
    this.status = ENGINE_STATUS.STARTING;
    if (globalThis.queuifyConfig?.dbOptions) {
      this.globalDb = connectToDb(...globalThis.queuifyConfig.dbOptions);
    }

    // Engine is started!
    this.status = ENGINE_STATUS.RUNNING;
  }

  private debugLog(...args: unknown[]) {
    if (this.debug) {
      console.log('💻', ...args);
    }
  }

  public start(queue: tQueue) {
    if (!queue.db) throw new Error('Queue db is required');

    const queueName = queue.name;
    checkExisting(this.queues.get(queueName), ALREADY_EXISTS(ENTITIES.QUEUE, queueName));

    this.queues.set(queueName, {
      queue,
      dbActions: new DBActions(queue.db),
      workers: new Map(),
      idleWorkerId: '',
      isStalledJobsProcessingComplete: false,
    });
    this.emit(QUEUE_EVENTS.QUEUE_ADD, queueName);
  }

  public async addJob(queueName: string, jobId: string, data: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    await queue.dbActions.addJob(queueName, jobId, data);
    this.emit(`${queueName}:${QUEUE_EVENTS.JOB_ADD}`, queueName);

    if (queue.idleWorkerId) {
      this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, { queueName, workerId: queue.idleWorkerId });
    }
  }

  public async addWorker(queueName: string, workerFunction: (...args: unknown[]) => unknown) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    const hasWorkers = queue.workers.size > 0;
    const workerId = generateId();
    queue.workers.set(workerId, { worker: workerFunction, jobs: [], status: WORKER_STATUS.IDLE });

    if (!hasWorkers) await this.startWorkers(queueName);

    this.emit(`${queueName}:${QUEUE_EVENTS.WORKER_ADD}`, { queueName, workerId });
  }

  private async onWorkerAdd({ queueName, workerId }: { queueName: string; workerId: string }) {
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

    // First prioritize stalled jobs
    let jobs: tJob[] = [];
    if (!queue.isStalledJobsProcessingComplete) {
      jobs = await queue.dbActions.getJobs(queueName, QUEUIFY_JOB_STATUS.STALLED);
      if (!jobs.length) {
        queue.isStalledJobsProcessingComplete = true;
      }
    }

    if (!jobs.length) {
      // Then get pending jobs
      jobs = await queue.dbActions.getJobs(queueName, QUEUIFY_JOB_STATUS.PENDING);
    }

    if (!jobs.length) return;

    workerData.jobs.push(...jobs);

    this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_PROCESS}`, { queueName, workerId });
  }

  private async onJobsProcess({ queueName, workerId }: { queueName: string; workerId: string }) {
    const queue = this.queues.get(queueName);
    if (!queue) return;
    const workerData = queue.workers.get(workerId);
    if (!workerData) return;

    if (!workerData.jobs.length) {
      workerData.status = WORKER_STATUS.IDLE;
      queue.idleWorkerId = workerId;
      return;
    }
    workerData.status = WORKER_STATUS.BUSY;
    let idleWorkerId = '';
    for (const [workerId, worker] of queue.workers) {
      if (worker.status !== WORKER_STATUS.IDLE) continue;

      idleWorkerId = workerId;
      break;
    }
    queue.idleWorkerId = idleWorkerId;

    const workerFunction = promisifyFunction(workerData.worker);
    if (!workerFunction) return;

    let remainingJobs = workerData.jobs.length;
    while (workerData.jobs.length) {
      const job = workerData.jobs.pop();
      if (!job) break;
      workerFunction(job)
        .then(async () => {
          await queue.dbActions.completeJob(queueName, job.id);
          this.emit(`${queueName}:${QUEUE_EVENTS.JOB_COMPLETE}`, job.id);
        })
        .catch(async (error) => {
          await queue.dbActions.failJob(queueName, job.id, error?.message);
          this.emit(`${queueName}:${QUEUE_EVENTS.JOB_FAIL}`, job.id);
        })
        .finally(() => {
          remainingJobs--;

          if (!remainingJobs) {
            workerData.status = WORKER_STATUS.IDLE;
            queue.idleWorkerId = workerId;
            this.emit(`${queueName}:${QUEUE_EVENTS.JOB_POOL_REQUEST}`, { queueName, workerId });
          }
        });
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
    // Move running jobs to stalled list
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
