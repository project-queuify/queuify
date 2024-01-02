import { Redis } from 'ioredis';
import { EventEmitter } from 'node:events';
import { connectToDb } from '../helpers';
import { tQueueEngine, tQueueEngineStatus } from '../types';

class QueuifyEngine extends EventEmitter implements tQueueEngine {
  status = tQueueEngineStatus.NONE;
  debug = !!globalThis.queuifyConfig.debug;
  queues = new Map();
  // Queue Engine can have their own DB which is set only when we have global option available.
  // When creating a Queue without DB options, It will use this global connection!
  globalDb: Redis | null = null;
  constructor() {
    super();
    // Start the engine
    this.debugLog('Starting the queue engine');
    this.status = tQueueEngineStatus.STARTING;
    if (globalThis.queuifyConfig.dbOptions) {
      this.globalDb = connectToDb(...globalThis.queuifyConfig.dbOptions);
    }

    // Engine is started!
    this.status = tQueueEngineStatus.RUNNING;
  }

  private debugLog(...args: unknown[]) {
    if (this.debug) {
      console.log('💻', ...args);
    }
  }
}

export default new QueuifyEngine();
