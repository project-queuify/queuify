import { tDbConnectOptions } from './db';

export declare class tQueue {
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor();
  public schedule: (job: any) => void;
  public batch: (job: any) => void;
}
