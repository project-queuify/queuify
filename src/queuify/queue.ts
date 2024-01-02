import { connectToDb } from '../helpers';
import { tDbConnectOptions, tQueue, tQueueConfig, tQueueEngineStatus } from '../types';
import queuifyEngine from './engine';

export default class Queue implements tQueue {
  public db;

  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor(...args: unknown[]) {
    if (queuifyEngine.status !== tQueueEngineStatus.RUNNING) {
      throw new Error('Queue engine is not running');
    }

    const dbOptions = args.slice(1) as tDbConnectOptions;
    this.db = dbOptions.length ? connectToDb(...dbOptions) : queuifyEngine.globalDb;

    console.log('Initialized queue');
  }

  schedule = (job: any) => {
    return null;
  };

  batch = (job: any) => {
    return null;
  };
}
