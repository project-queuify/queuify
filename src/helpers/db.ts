import Redis from 'ioredis';

import { tDbConnectOptions } from '../types';
import { checkExisting, checkRequired, getQueuifyKey } from './utils';
import { JOB_ALREADY_EXISTS, OPERATION_FAILED } from './messages';
import { ENTITIES, OPERATIONS, POSTFIXES } from './constants';

export const connectToDb = (...args: tDbConnectOptions): Redis => {
  const redis = !args.length
    ? new Redis()
    : args.length === 1
    ? new Redis(args[0] as any)
    : args.length === 2
    ? new Redis(args[0] as any, args[1] as any)
    : new Redis(args[0], args[1], args[2]);
  console.log('Redis connected');
  return redis;
};

export class DBActions {
  public db;
  constructor(db: Redis) {
    this.db = db;
  }

  public setupQueue(queueName: string) {
    console.log('😊 -> DBActions -> setupQueue -> queueName:', queueName);
  }

  public async getJobs(queueName: string) {
    const queuifyKey = getQueuifyKey(queueName);
    // TODO: Make this to only get the first few jobs
    const data = await this.db.xrange(queuifyKey, '-', '+');
    return data;
  }

  public async addJob(queueName: string, jobId: string, data: string) {
    const queuifyKey = getQueuifyKey(queueName);
    const queuifyHashKey = getQueuifyKey(queueName, POSTFIXES.HASH);

    console.time(queueName + jobId);

    // Check if jobId already exists in the hash
    checkExisting(await this.db.hexists(queuifyHashKey, jobId), JOB_ALREADY_EXISTS(jobId, queueName));

    // Add job data to a new stream and get the stream ID
    const streamId = checkRequired(
      await this.db.xadd(queuifyKey, '*', 'data', data),
      OPERATION_FAILED(OPERATIONS.ADD, undefined, ENTITIES.JOB, undefined, ENTITIES.QUEUE, queueName),
    );

    // Create a new hash record with jobId and the streamId
    await this.db.hset(queuifyHashKey, jobId, streamId);
    console.timeEnd(queueName + jobId);
  }
}
