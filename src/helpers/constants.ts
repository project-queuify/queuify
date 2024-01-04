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

export enum QUEUE_EVENTS {
  QUEUE_ADD = 'queue:add',
}
