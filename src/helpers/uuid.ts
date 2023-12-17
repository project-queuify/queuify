import crypto from 'node:crypto';

export const randomUUID = (options?: crypto.RandomUUIDOptions | undefined): string => crypto.randomUUID(options);
