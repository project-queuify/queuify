import Redis from 'ioredis';

import { tDbConnectOptions } from '../types';

type tConnectToDb = (...args: tDbConnectOptions) => Promise<Redis>;
export const connectToDb: tConnectToDb = async (...args) => {
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
