import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';
import { tDbConnectOptions } from './db';

export enum enumWorkerType {
  SANDBOX = 'sandbox', // Spawn a new process for each job
  EMBEDDED = 'embedded', // Execute the job in the current process
  HYBRID = 'hybrid', // Spawn a new process and execute the jobs in parallel
}

type tCommonQueueConfig = {
  workerType?: enumWorkerType;
  maxConcurrency?: number; // Max number of jobs that can be processed at the same time
  runBatchInParallel?: boolean; // Should wait for other jobs until specified jobs are added in the queue
  batchConcurrency?: number; // If running in batch, how many jobs should be processed at the same time
  maxExecutionTime?: number; // Max execution time in seconds per job
};

export type tGlobalQueueConfig = tCommonQueueConfig & {
  maxWorkers?: number; // Max number of workers
  pollingTime?: number; // Polling time in seconds for fetching new jobs
  dbOptions?: tDbConnectOptions; // ioredis connection options
  debug?: boolean; // Whether to print debug logs
};

declare global {
  // eslint-disable-next-line no-var
  var queuifyConfig: tGlobalQueueConfig;
}

export type tQueueConfig = tCommonQueueConfig & {
  name: string; // Name of the queue
};

export declare class tQueue {
  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor();
  public db: Redis | null;
  public schedule: (job: any) => void;
  public batch: (job: any) => void;
}

export enum tQueueEngineStatus {
  NONE,
  STARTING,
  RUNNING,
  STOPPED,
}
export declare class tQueueEngine extends EventEmitter {
  status: tQueueEngineStatus;
  globalDb: Redis | null; // Global redis connection which is used by all queues if they don't have their own connection
}
