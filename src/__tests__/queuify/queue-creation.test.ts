import Queue, { tQueue } from '../../queuify';

describe('queue creation', () => {
  let queue: tQueue;

  it('should create a queue with standard redis opts', () => {
    queue = new Queue('standard');

    expect(queue.db.options.host).toEqual('localhost');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
  });

  afterAll(() => {
    queue.db.quit();
  });
});
