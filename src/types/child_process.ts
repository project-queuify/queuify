import { tJob, tUnknownObject, tWorkerSandboxSource } from './queue';

export type tJobData = {
  job: tJob;
  workerSource: tWorkerSandboxSource;
  sharedData?: tUnknownObject;
  complete?: () => void;
  failed?: () => void;
};
