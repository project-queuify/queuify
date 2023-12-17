import { connectToDb } from '../helpers';
import { tDbConnectOptions, tQueue } from '../types';

export default class Queue implements tQueue {
  constructor(name: string, ...dbOpts: tDbConnectOptions);
  constructor(name: string);
  constructor(...args: any[]) {
    console.dir(args);
    connectToDb(...(args.slice(1) as tDbConnectOptions));
    console.log('Initialized queue', args[0]);
  }

  schedule = (job: any) => {
    return null;
  };

  batch = (job: any) => {
    return null;
  };
}
