import { Redis } from 'ioredis';

import { checkRequired, compressData, connectToDb, generateId, withErrors } from '../helpers';
import { ENTITIES, ENGINE_STATUS, PREFIXES } from '../helpers/constants';
import { INVALID_JOB_DATA, REQUIRED } from '../helpers/messages';
import { tDbConnectOptions, tQueue, tQueueConfig } from '../types';
import queuifyEngine from './engine';

export default class Queue implements tQueue {
  public db;
  public name;
  private compressData = !!globalThis.queuifyConfig?.compressData;

  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor(...args: unknown[]) {
    if (queuifyEngine.status !== ENGINE_STATUS.RUNNING) {
      throw new Error('Queue engine is not running');
    }
    const isQueueConfigProvided = typeof args[0] === 'object';
    const queueConfig = isQueueConfigProvided ? (args[0] as tQueueConfig) : null;
    if (queueConfig?.compressData !== undefined) this.compressData = !!(args[0] as tQueueConfig).compressData;

    this.name = typeof args[0] === 'string' ? args[0] : isQueueConfigProvided ? (args[0] as tQueueConfig).name : '';

    if (!this.name) {
      throw new Error('Queue name is required');
    }

    const dbOptions = args.slice(1) as tDbConnectOptions;
    this.db = dbOptions.length ? connectToDb(...dbOptions) : (queuifyEngine.globalDb as Redis);

    if (!this.db) {
      throw new Error('Database connection is required');
    }

    queuifyEngine.start(this);
  }

  async schedule(jobId: string, data: unknown): Promise<unknown>;
  async schedule(data: unknown): Promise<unknown>;
  async schedule(jobIdOrData: string | unknown, data?: unknown): Promise<unknown> {
    const jobData = data ?? jobIdOrData;
    const preparedData = withErrors(jobData, this.compressData ? compressData : JSON.stringify, INVALID_JOB_DATA);
    const jobId = arguments.length === 2 ? (jobIdOrData as string) : generateId();

    const queueData = checkRequired(queuifyEngine.queues.get(this.name), REQUIRED(ENTITIES.QUEUE));
    await queueData.dbActions.addJob(
      this.name,
      jobId,
      this.compressData ? PREFIXES.LZ_CACHED + preparedData : preparedData,
    );

    return null;
  }

  async process(workerFilePath: string): Promise<unknown>;
  async process(workerFunction: (...args: unknown[]) => unknown): Promise<unknown>;
  async process(workerPathOrFunction: string | unknown): Promise<unknown> {
    const workerFunction =
      typeof workerPathOrFunction === 'string' ? await import(workerPathOrFunction) : workerPathOrFunction;
    return;
  }

  batch = (job: unknown) => {
    return null;
  };
}
