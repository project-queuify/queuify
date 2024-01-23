export const worker = (job: unknown) => {
  console.log((global as any)?.redis?.options?.port);
  const random = Math.random();
  if (random > 0.5) {
    throw new Error('Something went wrong');
  }
  console.log('😊 -> worker -> job:', JSON.stringify(job));
};
