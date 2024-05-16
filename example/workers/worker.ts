import { tJob } from '../../lib';

export const worker = async (job: tJob) => {
  console.log('Shared global redis', global?.redis?.options?.port);
  const random = Math.random();
  if (random > 0.75) {
    return;
  }
  await job.update({ test: 'data' });
};
