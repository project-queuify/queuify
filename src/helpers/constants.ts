export enum ENTITIES {
  QUEUE = 'queue',
  JOB = 'job',
  DB = 'db',
}

export enum OPERATIONS {
  ADD = 'add',
}

export enum WORKER_TYPES {
  SANDBOX = 'sandbox', // Spawn a new process for each job
  EMBEDDED = 'embedded', // Execute the job in the current process
  HYBRID = 'hybrid', // Spawn a new process and execute the jobs in parallel
}

export enum POSTFIXES {
  HASH = 'hash',
}

export enum PREFIXES {
  LZ_CACHED = 'lzc',
}

export enum ENGINE_STATUS {
  NONE,
  STARTING,
  RUNNING,
  STOPPED,
}

export enum WORKER_STATUS {
  NONE,
  IDLE,
  BUSY,
}

export enum QUEUE_EVENTS {
  QUEUE_ADD = 'queue:add',
  WORKER_ADD = 'worker:add',
  JOB_ADD = 'job:add',
  JOB_POOL_REQUEST = 'job-pool:request',
  JOB_POOL_PROCESS = 'job-pool:process',
  JOB_COMPLETE = 'job:complete',
  JOB_UPDATE = 'job:update',
  JOB_FAIL = 'job:fail',
}

export enum QUEUIFY_KEY_TYPES {
  RUNS = 'runs',
  JOBS = 'jobs',
  IDS = 'ids',
}

export enum QUEUIFY_JOB_STATUS {
  PENDING = 'pending',
  STALLED = 'stalled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  RETRY = 'retry',
  FAILED = 'failed',
}

export enum QUEUIFY_JOB_FIELDS {
  STATUS = 'status',
  JOB_ID = 'jobId',
  DATA = 'data',
  FAILED_REASON = 'failedReason',
}

export enum DB_FIELDS {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export const MISC = {
  DATA: 'data',
  ERROR: 'error',
  MESSAGE: 'message',
  CONNECTION: 'connection',
};
