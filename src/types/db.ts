import { RedisOptions } from 'ioredis';

export type tDbConnectOptions =
  | [number, string, RedisOptions]
  | [string | number, RedisOptions]
  | [number, string]
  | [RedisOptions]
  | [number]
  | [string];
