/* eslint-disable no-var */
import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';

import { tDbConnectOptions } from './db';
import { WORKER_TYPES, ENGINE_STATUS, WORKER_STATUS } from '../helpers/constants';
import { DBActions } from '../helpers';

type tCommonQueueConfig = {
  workerType?: WORKER_TYPES;
  maxConcurrency?: number; // Max number of jobs that can be processed at the same time
  runBatchInParallel?: boolean; // Should wait for other jobs until specified jobs are added in the queue
  batchConcurrency?: number; // If running in batch, how many jobs should be processed at the same time
  maxExecutionTime?: number; // Max execution time in seconds per job
  compressData?: boolean; // Compress job data before adding it to the queue
};

export type tGlobalQueueConfig = tCommonQueueConfig & {
  maxWorkers?: number; // Max number of workers
  pollingTime?: number; // Polling time in seconds for fetching new jobs
  dbOptions?: tDbConnectOptions; // ioredis connection options
  debug?: boolean; // Whether to print debug logs
};

declare global {
  var queuifyConfig: tGlobalQueueConfig;
  var redis: Redis;
}

export type tQueueConfig = tCommonQueueConfig & {
  name: string; // Name of the queue
};

// noinspection Annotator
export declare class tQueue {
  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor();

  public db: Redis;
  public name: string;

  public schedule(jobId: string, data: unknown): Promise<unknown>;
  public schedule(data: unknown): Promise<unknown>;

  public process(name: string, workerFile: tWorkerSandboxSource, workerConfig: tWorkerConfig): Promise<unknown>;
  public process(
    name: string,
    workerFunction: (...args: unknown[]) => unknown,
    workerConfig: tWorkerConfig,
  ): Promise<unknown>;
  public process(workerFile: tWorkerSandboxSource, workerConfig: tWorkerConfig): Promise<unknown>;
  public process(workerFile: tWorkerSandboxSource): Promise<unknown>;
  public process(workerFunction: (...args: unknown[]) => unknown, workerConfig: tWorkerConfig): Promise<unknown>;
  public process(workerFunction: (...args: unknown[]) => unknown): Promise<unknown>;

  public batch: (job: unknown) => void;
}

export declare class tQueueEngine extends EventEmitter {
  status: ENGINE_STATUS;
  globalDb: Redis | null; // Global redis connection which is used by all queues if they don't have their own connection
}

export type tJob = {
  id: string;
  data: unknown;
  complete: (result: unknown) => Promise<unknown>;
  update: (data: unknown) => Promise<unknown>;
  failed: (error: unknown) => Promise<unknown>;
};

export type tWorkerFunction = (job: tJob) => Promise<unknown> | unknown;
export type tWorkerSandboxSource = {
  maxTimeToWaitForServer?: number;
  workerFilePath: string;
  workerFuncName: string;
};
export type tUnknownObject = Record<string, unknown>;
export type tWorkerConfig = {
  type?: WORKER_TYPES;
  sharedData?: tUnknownObject;
};

export type tPlainJob = Omit<tJob, 'complete' | 'update' | 'failed'>;

export type tQueueMapValue = {
  queue: tQueue;
  dbActions: InstanceType<typeof DBActions>;
  workers: Map<
    string,
    {
      worker: tWorkerSandboxSource | ((...args: unknown[]) => unknown);
      jobs: tPlainJob[];
      status: WORKER_STATUS;
      config: tWorkerConfig;
    }
  >;
  idleWorkerId: string;
  isStalledJobsProcessingComplete: boolean;
  shouldCompressData: boolean;
};
