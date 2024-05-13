import { toTitleCase } from './utils';

export const INVALID_JOB_DATA = 'Job data is invalid. Please use proper data to schedule a job!';

/**
 * Returns a string indicating that a job with a specific ID and queue name already exists.
 *
 * @param {string} jobId - The ID of the job (optional).
 * @param {string} queueName - The name of the queue (optional).
 * @return {string} A string indicating that a job already exists in the specified queue.
 */
export const JOB_ALREADY_EXISTS = (jobId?: string, queueName?: string): string =>
  `Job with id${jobId ? `: "${jobId}"` : ''} already exists in queue${queueName ? ` "${queueName}"` : ''}!`;

/**
 * Returns a string indicating that a particular entity is required.
 *
 * @param {string} entity - The entity that is required.
 * @param {string} entityName (optional) - The name of the entity.
 * @return {string} A message indicating that the entity is required.
 */
export const REQUIRED = (entity: string, entityName?: string): string =>
  `${toTitleCase(entity)}${entityName ? ` "${entityName}"` : ''} is required!`;

/**
 * Returns a string indicating that the given entity already exists.
 *
 * @param {string} entity - The name of the entity.
 * @param {string} [entityName] - The specific name of the entity (optional).
 * @return {string} A string indicating that the entity already exists.
 */
export const ALREADY_EXISTS = (entity: string, entityName?: string): string =>
  `${toTitleCase(entity)}${entityName ? ` "${entityName}"` : ''} already exists!`;

/**
 * Generates an error message indicating that an operation failed.
 *
 * @param {string} operation - The name of the operation that failed.
 * @param {string} [message] - Optional additional error message.
 * @param {string} [entity] - Optional name of the entity being operated on.
 * @param {string} [entityName] - Optional name of the specific entity instance.
 * @param {string} [parentEntity] - Optional name of the parent entity.
 * @param {string} [parentEntityName] - Optional name of the specific parent entity instance.
 * @return {string} The error message indicating the failure of the operation.
 */
export const OPERATION_FAILED = (
  operation: string,
  message?: string,
  entity?: string,
  entityName?: string,
  parentEntity?: string,
  parentEntityName?: string,
): string =>
  `Could not ${operation} the ${entity ? ` ${entity}` : ''}${entityName ? ` "${entityName}"` : ''}${
    parentEntity ? ` in ${parentEntity}` : ''
  }${parentEntityName ? ` "${parentEntityName}"` : ''}!${message ? ` ${message}` : ''}`;

export const EVENT_TIMED_OUT = (eventName: string) => `Timed out waiting for event "${eventName}"`;
