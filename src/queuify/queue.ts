import path from 'path';
import { Redis } from 'ioredis';

import { callSites, checkRequired, compressData, connectToDb, generateId, withErrors } from '../helpers';
import { ENTITIES, ENGINE_STATUS, PREFIXES, WORKER_TYPES } from '../helpers/constants';
import { INVALID_JOB_DATA, REQUIRED } from '../helpers/messages';
import { tDbConnectOptions, tQueue, tQueueConfig, tWorkerConfig, tWorkerSandboxSource } from '../types';
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
    this.db = dbOptions.length
      ? connectToDb(...dbOptions)
      : queuifyEngine.globalDb
      ? (queuifyEngine.globalDb as Redis)
      : connectToDb('redis://localhost:6379');

    if (!this.db) {
      throw new Error('Database connection is required');
    }

    queuifyEngine.start(this);
  }

  public on(eventName: string, listener: (...args: unknown[]) => unknown): unknown {
    return queuifyEngine.on(`${this.name}:${eventName}`, listener);
  }

  async schedule(jobId: string, data: unknown): Promise<unknown>;
  async schedule(data: unknown): Promise<unknown>;
  async schedule(jobIdOrData: string | unknown, data?: unknown): Promise<unknown> {
    const jobData = data ?? jobIdOrData;
    const preparedData = withErrors(jobData, this.compressData ? compressData : JSON.stringify, INVALID_JOB_DATA);
    const jobId = arguments.length === 2 ? (jobIdOrData as string) : generateId();

    const queueData = checkRequired(queuifyEngine.queues.get(this.name), REQUIRED(ENTITIES.QUEUE));
    await queuifyEngine.addJob(
      queueData.queue.name,
      jobId,
      this.compressData ? PREFIXES.LZ_CACHED + preparedData : preparedData,
    );

    return null;
  }

  // TODO: Add support for named workers
  async process(name: string, workerFile: tWorkerSandboxSource, workerConfig: tWorkerConfig): Promise<unknown>;
  async process(
    name: string,
    workerFunction: (...args: unknown[]) => unknown,
    workerConfig: tWorkerConfig,
  ): Promise<unknown>;
  async process(workerFile: tWorkerSandboxSource, workerConfig: tWorkerConfig): Promise<unknown>;
  async process(workerFile: tWorkerSandboxSource): Promise<unknown>;
  async process(workerFunction: (...args: unknown[]) => unknown, workerConfig: tWorkerConfig): Promise<unknown>;
  async process(workerFunction: (...args: unknown[]) => unknown): Promise<unknown>;
  async process(
    workerNameOrSourceOrFunction: string | tWorkerSandboxSource | ((...args: unknown[]) => unknown),
    workerSourceOrConfig?: tWorkerSandboxSource | tWorkerConfig | ((...args: unknown[]) => unknown),
    workerConfig?: tWorkerConfig,
  ): Promise<unknown> {
    const workerSource = (
      typeof workerNameOrSourceOrFunction === 'string' ? workerSourceOrConfig : workerNameOrSourceOrFunction
    ) as tWorkerSandboxSource | ((...args: unknown[]) => unknown);

    // TODO: In future, add support for normal functions in sandbox mode in context sharing solution is found!
    const isSandbox = typeof workerSource === 'object';

    const config = (
      typeof workerNameOrSourceOrFunction === 'string' ? workerConfig : workerSourceOrConfig
    ) as tWorkerConfig;

    if (isSandbox) {
      config.type = WORKER_TYPES.SANDBOX;
      const stack = callSites();

      if (!stack[1]) {
        throw new Error('Stack is not sufficient!');
      }

      workerSource.workerFilePath = path.join(
        stack[1].getFileName()?.match(/.+(?=\/)/g)?.[0] || '',
        workerSource.workerFilePath,
      );
    }

    return await queuifyEngine.addWorker(this.name, workerSource, config);
  }

  batch = (job: unknown) => {
    return job;
  };
}
