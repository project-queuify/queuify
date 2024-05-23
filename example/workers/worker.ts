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
  const random = Math.random();

  if (random > 0.5) {
    console.log(`worker -> ${job.id} will fail due to max time limit being reached`);
  }

  await sleep(random > 0.5 ? 7000 : 3000);

  console.log(`This got print because of no process killing ${job.id}`);
};
