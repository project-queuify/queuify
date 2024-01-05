import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';

import { DBActions, checkExisting, connectToDb, decompressData } from '../helpers';
import { tQueue, tQueueEngine } from '../types';
import { ENTITIES, ENGINE_STATUS, QUEUE_EVENTS } from '../helpers/constants';
import { ALREADY_EXISTS } from '../helpers/messages';

class QueuifyEngine extends EventEmitter implements tQueueEngine {
  status = ENGINE_STATUS.NONE;
  debug = !!globalThis.queuifyConfig?.debug;
  queues: Map<string, { queue: tQueue; dbActions: InstanceType<typeof DBActions> }> = new Map();
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

    this.queues.set(queueName, { queue, dbActions: new DBActions(queue.db) });
    this.emit(QUEUE_EVENTS.QUEUE_ADD, queueName);
    return this.processQueue(queueName);
  }

  private async processQueue(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    const jobs = await queue.dbActions.getJobs(queueName);
    console.log('😊 -> QueuifyEngine -> processQueue -> jobs:', jobs);
  }
}

const queuifyEngine = new QueuifyEngine();

queuifyEngine.on(QUEUE_EVENTS.QUEUE_ADD, (queueName) => {
  const queueData = queuifyEngine.queues.get(queueName);
  if (!queueData) return;
});

export default queuifyEngine;
