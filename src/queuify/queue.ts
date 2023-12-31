import { Redis } from 'ioredis';
import { connectToDb } from '../helpers';
import { tDbConnectOptions, tQueue, tQueueConfig } from '../types';

export default class Queue implements tQueue {
  public db: Redis;

  constructor(config: tQueueConfig, ...dbOpts: tDbConnectOptions);
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor(...args: any[]) {
    this.db = connectToDb(...(args.slice(1) as tDbConnectOptions));
    console.log('Initialized queue', args[0]);
  }

  schedule = (job: any) => {
    return null;
  };

  batch = (job: any) => {
    return null;
  };
}
