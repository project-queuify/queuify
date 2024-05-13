import { tJob } from '../../lib';

export const worker = async (job: tJob) => {
  console.log('😊 -> worker -> job original:', job.data);
  console.log((global as any)?.redis?.options?.port);
  const random = Math.random();
  console.log('😊 -> worker -> random:', random);
  // if (random > 0.75) {
  //   throw new Error('Something went wrong');
  // }
  await job.update({ test: 'data' });
  console.log('😊 -> worker -> job updated:', JSON.stringify(job));
};
