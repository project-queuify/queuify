import { tJob } from '../../lib';

async function sleep(number: number) {
  await new Promise((resolve) => setTimeout(resolve, number));
}

export const worker = async (job: tJob) => {
  // const random = Math.random();
  // if (random > 0.75) {
  //   return;
  // }
  await job.update({ test: 'data', port: global?.redis?.options?.port });
  await sleep(5000);
};
