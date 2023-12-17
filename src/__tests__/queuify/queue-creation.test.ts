import Queue, { tQueue } from '../../queuify';

describe('queue creation', () => {
  let queue: tQueue;

  it('should create a queue with standard redis opts', () => {
    queue = new Queue('standard');

    expect(queue.db.options.host).toEqual('localhost');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
  });

  it('should create a queue with redis url', () => {
    queue = new Queue('standard', 'redis://127.0.0.1:6379');

    expect(queue.db.options.host).toEqual('127.0.0.1');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
  });

  it('should create a queue with only port', () => {
    queue = new Queue('standard', 6379);

    expect(queue.db.options.host).toEqual('localhost');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
  });

  it('should create a queue with 5000 connection timeout', () => {
    queue = new Queue('standard', { connectTimeout: 5000 });

    expect(queue.db.options.host).toEqual('localhost');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
    expect(queue.db.options.connectTimeout).toEqual(5000);
  });

  it('should create a queue with url and 5000 connection timeout', () => {
    queue = new Queue('standard', 'redis://127.0.0.1:6379', { connectTimeout: 5000 });

    expect(queue.db.options.host).toEqual('127.0.0.1');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
    expect(queue.db.options.connectTimeout).toEqual(5000);
  });

  it('should create a queue with url, port and 5000 connection timeout', () => {
    queue = new Queue('standard', 6379, 'redis://127.0.0.1:6379', { connectTimeout: 5000 });

    expect(queue.db.options.host).toEqual('127.0.0.1');
    expect(queue.db.options.port).toEqual(6379);
    expect(queue.db.options.db).toEqual(0);
    expect(queue.db.options.connectTimeout).toEqual(5000);
  });

  afterEach(() => {
    queue.db.quit();
  });
});
