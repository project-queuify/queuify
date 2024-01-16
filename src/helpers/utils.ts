/* eslint-disable @typescript-eslint/ban-types */
import { compress, decompress } from 'lz-string';
import crypto from 'node:crypto';
import uniqid from 'uniqid';
import { PREFIXES, QUEUIFY_KEY_TYPES, QUEUIFY_JOB_STATUS } from './constants';

/**
 * Generates a random UUID.
 *
 * @param {crypto.RandomUUIDOptions | undefined} options - Optional options for generating the UUID.
 * @return {string} - The randomly generated UUID.
 */
export const randomUUID = (options?: crypto.RandomUUIDOptions | undefined): string => crypto.randomUUID(options);

/**
 * Generates a unique ID.
 *
 * @returns {string} The generated unique ID.
 */
export const generateId = (prefix?: string, suffix?: string): string => uniqid(prefix, suffix);

export const getQueuifyKey = (
  name: string,
  type: QUEUIFY_KEY_TYPES = QUEUIFY_KEY_TYPES.JOBS,
  status?: QUEUIFY_JOB_STATUS,
): string => `queuify:${name}${type ? `:${type}` : ''}${status ? `:${status}` : ''}`;

/**
 * Executes a processor function with the given data, handling any errors that occur.
 *
 * @param {T} data - The data to be processed.
 * @param {(data: T) => R} processor - The function that processes the data.
 * @param {string | ((error: unknown) => R)} onError - The error handling mechanism. If it is a string, it throws an error with the string as the message. If it is a function, it calls the function with the error as the argument.
 * @return {R} - The result of the processor function or the error handling mechanism.
 */
export const withErrors = <T, R>(data: T, processor: (data: T) => R, onError: string | ((error: unknown) => R)): R => {
  try {
    return processor(data);
  } catch (error) {
    typeof onError === 'string' ? throwError(error) : onError(error);
  }
  // Add a return statement here
  return undefined as R;
};

/**
 * Checks if a value is defined and throws an error if it is not.
 *
 * @param {T} value - The value to be checked.
 * @param {string} errorMessage - The error message to be thrown if the value is not defined.
 * @returns {NonNullable<T>} - The input value if it is defined.
 * @throws {Error} - Throws an error with the specified error message if the value is not defined.
 */
export const checkRequired = <T>(value: T, errorMessage?: string): NonNullable<T> => {
  if (value === null || value === undefined) {
    throw new Error(errorMessage || 'Value is required');
  }
  return value;
};

/**
 * Checks if a value already exists and throws an error if it does.
 *
 * @param {unknown} value - The value to check.
 * @param {string} [errorMessage] - The error message to throw if the value exists.
 * @return {unknown} - Returns falsy value.
 */
export const checkExisting = (value: unknown, errorMessage?: string): unknown => {
  if (value) {
    throw new Error(errorMessage || 'Value already exists');
  }
  return value;
};

/**
 * Throws an error.
 *
 * @param {unknown} error - The error to throw.
 * @return {void} This function does not return anything.
 */
export const throwError = (error: unknown): void => {
  throw typeof error === 'string' ? new Error(error) : error;
};

/**
 * Compresses the given data into a string.
 *
 * @param {unknown} data - The data to be compressed.
 * @return {string} The compressed data as a string.
 */
export const compressData = (data: unknown): string => compress(JSON.stringify(data));

/**
 * Parses a compressed data string and returns the decompressed data.
 *
 * @param {string} data - The compressed data string to be decompressed.
 * @return {unknown} The decompressed data.
 */
export const decompressData = (data: string): unknown =>
  JSON.parse(data.startsWith(PREFIXES.LZ_CACHED) ? decompress(data.slice(PREFIXES.LZ_CACHED.length)) : data);

/**
 * Converts a string to title case.
 *
 * @param {string} str - The string to convert.
 * @return {string} The converted string in title case.
 */
export const toTitleCase = (str: string): string =>
  str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
  });

export const promisifyFunction =
  (fn: Function) =>
  (...args: unknown[]): Promise<unknown> =>
    new Promise((resolve, reject) => {
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    });
