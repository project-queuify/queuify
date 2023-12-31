import { Redis } from 'ioredis';
import { tDbConnectOptions } from './db';

export enum enumWorkerType {
  SANDBOX = 'sandbox',
  EMBEDDED = 'embedded',
  HYBRID = 'hybrid',
}

type tCommonQueueConfig = {
  workerType?: enumWorkerType;
  maxConcurrency?: number;
  batchConcurrency?: number;
  runBatchInParallel?: boolean;
  maxExecutionTime?: number;
};

export type tGlobalQueueConfig = tCommonQueueConfig & {
  maxWorkers?: number;
  pollingTime?: number;
};
export type tQueueConfig = tCommonQueueConfig & {
  name: string;
};

export declare class tQueue {
  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor();
  public db: Redis;
  public schedule: (job: any) => void;
  public batch: (job: any) => void;
}
