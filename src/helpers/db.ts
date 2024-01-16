/* eslint-disable @typescript-eslint/no-explicit-any */
import Redis from 'ioredis';

import { tDbConnectOptions } from '../types';
import { checkExisting, checkRequired, decompressData, getQueuifyKey } from './utils';
import { JOB_ALREADY_EXISTS, OPERATION_FAILED } from './messages';
import {
  ENTITIES,
  OPERATIONS,
  QUEUIFY_KEY_TYPES,
  QUEUIFY_JOB_STATUS,
  QUEUIFY_JOB_FIELDS,
  DB_FIELDS,
} from './constants';

export const connectToDb = (...args: tDbConnectOptions): Redis => {
  const redis = !args.length
    ? new Redis()
    : args.length === 1
    ? new Redis(args[0] as any)
    : args.length === 2
    ? new Redis(args[0] as any, args[1] as any)
    : new Redis(args[0], args[1], args[2]);
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

  public async getJobs(queueName: string, from: QUEUIFY_JOB_STATUS, limit = 1) {
    const queuifyListKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS, from);
    const queuifyRunsKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS);

    const jobIds = [];
    for (let i = 0; i < limit; i++) {
      const jobId = await this.db.lmove(
        queuifyListKey,
        `${queuifyRunsKey}:${QUEUIFY_JOB_STATUS.RUNNING}`,
        DB_FIELDS.LEFT,
        DB_FIELDS.RIGHT,
      );
      if (!jobId) break;
      jobIds.push(jobId);
    }

    console.log('😊 -> DBActions -> getJobs -> jobIds:', jobIds);
    if (!jobIds.length) return [];

    const idsPipeline = this.db.multi();
    for (const jobId of jobIds) {
      idsPipeline.hget(`${queuifyRunsKey}:${jobId}`, QUEUIFY_JOB_FIELDS.JOB_ID);
    }
    const streamIds = ((await idsPipeline.exec())?.map((item) => item[1]) || []) as string[];
    const jobsPipeline = this.db.multi();
    const statusPipeline = this.db.multi();
    const queuifyJobsKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.JOBS);
    const jobsMap = new Map();
    for (let i = 0; i < streamIds.length; i++) {
      const streamId = streamIds[i];
      const jobId = jobIds[i];
      if (!streamId) continue;
      jobsMap.set(streamId, jobId);
      jobsPipeline.xrange(queuifyJobsKey, streamId, streamId);
      statusPipeline.hset(`${queuifyRunsKey}:${jobId}`, QUEUIFY_JOB_FIELDS.STATUS, QUEUIFY_JOB_STATUS.RUNNING);
    }
    const results = await Promise.allSettled([jobsPipeline.exec(), statusPipeline.exec()]);
    const jobsResults = results[0];
    if (jobsResults.status === 'rejected') throw jobsResults.reason;
    const jobs = [];
    for (const result of jobsResults.value || []) {
      const data = result[1] as unknown[];
      const streamData = data[0] as [string, [string, string]];
      const job = {
        id: jobsMap.get(streamData[0]),
        data: decompressData(streamData[1][1]),
      };
      jobs.push(job);
    }

    return jobs;
  }

  public async completeJob(queueName: string, jobId: string) {
    const queuifyKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS);
    const jobPipeline = this.db.multi();
    jobPipeline.hset(`${queuifyKey}:${jobId}`, QUEUIFY_JOB_FIELDS.STATUS, QUEUIFY_JOB_STATUS.COMPLETED);
    jobPipeline.lrem(`${queuifyKey}:${QUEUIFY_JOB_STATUS.RUNNING}`, 1, jobId);
    jobPipeline.lpush(`${queuifyKey}:${QUEUIFY_JOB_STATUS.COMPLETED}`, jobId);
    await jobPipeline.exec();
  }

  public async failJob(queueName: string, jobId: string, failedReason: string) {
    const queuifyKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS);
    const jobPipeline = this.db.multi();
    jobPipeline.hset(
      `${queuifyKey}:${jobId}`,
      QUEUIFY_JOB_FIELDS.STATUS,
      QUEUIFY_JOB_STATUS.FAILED,
      QUEUIFY_JOB_FIELDS.FAILED_REASON,
      failedReason,
    );
    jobPipeline.lrem(`${queuifyKey}:${QUEUIFY_JOB_STATUS.RUNNING}`, 1, jobId);
    jobPipeline.lpush(`${queuifyKey}:${QUEUIFY_JOB_STATUS.FAILED}`, jobId);
    await jobPipeline.exec();
  }
  public async moveJobsBetweenLists(queueName: string, from: QUEUIFY_JOB_STATUS, to: QUEUIFY_JOB_STATUS) {
    const queuifyKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS);
    const fromList = `${queuifyKey}:${from}`;
    const toList = `${queuifyKey}:${to}`;
    const jobRuns = await this.db.lrange(fromList, 0, -1);
    console.log('😊 -> DBActions -> moveJobsBetweenLists -> jobRuns:', jobRuns);
    if (!jobRuns) return;
    const jobMovePipeline = this.db.multi();
    for (const jobId of jobRuns) {
      // Move item from fromList's head(LEFT) to toList's tail(RIGHT).
      // L1 = 3,2,1
      // L2 = 6,5,4
      // Moving head to tail makes L2 6,5,4,3,2,1
      // When Engine will pop from tail, It will process in a order of 3,2,1 which is desired order
      jobMovePipeline.lmove(fromList, toList, DB_FIELDS.LEFT, DB_FIELDS.RIGHT);
      jobMovePipeline.hset(`${queuifyKey}:${jobId}`, QUEUIFY_JOB_FIELDS.STATUS, to);
    }

    await jobMovePipeline.exec();

    return jobRuns;
  }

  public async addJob(queueName: string, jobId: string, data: string) {
    const queuifyKey = getQueuifyKey(queueName);
    const queuifyRunsKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS);
    const queuifyRunsJobKey = `${queuifyRunsKey}:${jobId}`;

    // Check if jobId already exists in the hash
    checkExisting(await this.db.exists(queuifyRunsJobKey), JOB_ALREADY_EXISTS(jobId, queueName));

    // Add job data to a new stream and get the stream ID
    const streamId = checkRequired(
      await this.db.xadd(queuifyKey, '*', QUEUIFY_JOB_FIELDS.DATA, data),
      OPERATION_FAILED(OPERATIONS.ADD, undefined, ENTITIES.JOB, jobId, ENTITIES.QUEUE, queueName),
    );

    // Create a new hash record with jobId and the streamId
    await this.db.hset(
      queuifyRunsJobKey,
      QUEUIFY_JOB_FIELDS.JOB_ID,
      streamId,
      QUEUIFY_JOB_FIELDS.STATUS,
      QUEUIFY_JOB_STATUS.PENDING,
    );

    // Add job id in the in progress list's head
    const queuifyRunsPendingKey = getQueuifyKey(queueName, QUEUIFY_KEY_TYPES.RUNS, QUEUIFY_JOB_STATUS.PENDING);
    await this.db.lpush(queuifyRunsPendingKey, jobId);
  }
}
