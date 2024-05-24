Queuify is building!
[![codecov](https://codecov.io/gh/Mr0nline/queuify/graph/badge.svg?token=HTYAPT9VM1)](https://codecov.io/gh/Mr0nline/queuify)

<!-- TOC -->

* [Queuify Pattern!](#queuify-pattern)
* [Notes](#notes)
* [Feature Roadmap](#feature-roadmap)
	* [Queuify](#queuify)
	* [For each queue](#for-each-queue)
	* [Workers](#workers)
	* [Batching](#batching)

<!-- TOC -->

## Queuify Pattern!

- Options (For whole Queuify)
	1. [**Worker Type**] _Sandbox / Embedded / Hybrid_
	2. [**Max workers**] _default 0 (Infinite)_
	3. [**Max concurrency**] (default 100) _x amount of job should be processed by each queue_
	4. [**Batch Concurrency**] _defaults to Max Concurrency or 1 if max is infinite! Only needed when batch runs in
		 parallel_
	5. [**Run Batch in Parallel**] _Should hold of another job during batch execution or not! On enabling, Total queue
		 concurrency will be Max concurrency + Batch concurrency_
	6. [**Max execution time**] _If a sandboxed worker doesn't finish up in given time, the Process will be killed (Useful
		 to kill memory leak, Make sure it’s kind of 10x than you think)_
	7. [**Connection options**]
		1. [**DB**] _Redis, DragonFly_
		2. [**DB Options**] _If there is something that we want to use specifically_


- Options (For each queue)
	1. [**Worker Type**] _Sandbox / Embedded / Hybrid_ (takes priority over above concurrency)
	2. [**Max concurrency**] _default 0_ (takes priority over above concurrency)
		1. Beware that max concurrency is effective on worker level as of now. That means if we have it set at 2, but we
			 have three workers; The final concurrency for that queue would be 6!
	3. [**Batch concurrency**] (takes priority over above concurrency)
	4. [**Run Batch in parallel**] (takes priority over above)
	5. [**Max execution time**] (takes priority over above)
	6. [**Heap limit**] (in MB)
		1. [**For Sandbox**] _limit gets divided per concurrency. 2048 MB with concurrency 2 will allocate 1024 for each
			 sandboxed processor_
		2. [**For Hybrid**] _It creates a sandboxed processor with Heap limits and processes jobs in parallel as per
			 concurrency!_


- Workers
	1. Total three types
		1. [**Sandboxes**] _Spawns a new node process for the jobs, More scalable and keeps parent server clean from heap
			 issues!_
		2. [**Embedded**] _Works on the same server where processor is added so the more jobs runs in parallel, the more
			 memory heap it consumes_
		3. [**Hybrid**] _Most likely combination of above two, Creates one process and runs everything in parallel to avoid
			 any harm to parent server!_
	2. [**Pre-start hooks**] _Used to execute code to prepare the worker, Mostly it will be db and websocket connections
		 along with clients like shopify etc. so that it can have all the required things before running the worker_
	3. Hooks/Events
		1. [**Before Work**] _Picks X jobs based on Concurrency, Do some logic and return array. The length of array will be
			 pushed to workers (if picked five jobs because of five concurrency and new array is of 7 then total of seven
			 workers will be created)_
		2. [**After Work**] Perform clean up if required.
		3. Other generic events like job success, fail, etc.
		4. **Batch specific events**
			1. _Before Batch Start_
			2. _Before Item Start_
			3. _On Item Success_
			4. _On Item Fail_
			5. _After Item End_
			6. _After Batch End_

- Batching
	1. A dedicated method to schedule multiple jobs (an array) in a queue with some additional hooks as mentioned above
	2. Can provide a unique id or it’ll return a new generated id
	3. Option to delay the execution to wait for more items, so it can be added later on
	4. Once all item added or batch is set to start immediately, Start batch in

## Notes

- There can be few limitations due to the nature of Queuify design, Below are few examples for the same.
	- Queueify is promise-based, Meaning it expects some async tasks to be waited to work perfectly!
	- When adding workers to Queue via `queue.process`, One must await for the response,
		Queuify Engine starts worker pool when it receives first worker for the given queue,
		During that time if other workers gets added,
		There's a high chance that the rest workers will never be used for the processing due to those not being added to
		worker pool!
		- For example, Use solution 2 instead of solution 1.
			```javascript
			const queue = new Queue('test-queue');
			const workerFunc = (job) => console.log(job.id)  
			const workerFunc2 = (job) => console.log(job.id)  
			redisQueue.process(workerFunc)
			// This will cause problem because the above `.process` is not finished yet,
			// And it's likely that workerpool is not started so it's most likely that second worker won't get any jobs!
			redisQueue.process(workerFunc2)
			```
			Instead of above, Do following!
			```javascript
			const queue = new Queue('test-queue');
			const workerFunc = (job) => console.log(job.id)  
			const workerFunc2 = (job) => console.log(job.id)  
			// Await will make sure that second worker only gets added after worker pool is set up!
			await redisQueue.process(workerFunc)
			await redisQueue.process(workerFunc2)
			```

## Feature Roadmap

### Queuify

- Worker Type
- [ ] Embedded
- [ ] Sandbox
- [ ] Hybrid
- Max workers
- [ ] Default 0 (Infinite)
- Max concurrency
- [x] Default 100
- Batch concurrency
- [ ] default to Max Concurrency or 1 if max is infinite!
	- Only needed when batch runs in parallel
- Run Batch in Parallel
- [ ] Should hold of another job during batch execution or not!
	- On enabling, Total queue concurrency will be Max concurrency + Batch concurrency.
- Max execution time
- [ ] If a sandboxed worker doesn’t finish up in given time, the Process will be killed
	- Useful to kill memory leak, Make sure it’s kind of 10x than you think for each job!
- Connection options
	- DB
	- [x] Redis
	- [x] DragonFly
	- DB Options
	- [x] Underlying connection options
		for [ioredis](https://github.com/redis/ioredis/blob/558497c/lib/redis/RedisOptions.ts#L193)

### For each queue

- Worker Type
- [x] Embedded
- [x] Sandbox
- [ ] Hybrid
- Max concurrency
- [x] Default 100
	- takes priority over above concurrency
- Batch concurrency
- [ ] default to Max Concurrency or 1 if max is infinite!
	- takes priority over the above concurrency
	- Only needed when batch runs in parallel
- Run Batch in Parallel
- [ ] Should hold of another job during batch execution or not!
	- takes priority over the above concurrency
	- On enabling, Total queue concurrency will be Max concurrency + Batch concurrency.
- Max execution time
- [ ] If a sandboxed worker doesn’t finish up in given time, the Process will be killed
	- takes priority over the above concurrency
	- Useful to kill memory leak, Make sure it’s kind of 10x than you think for each job!
- Heap limit - in MB
	- [ ] For Sandbox
		- limit gets divided per concurrency
		- 2048 MB with two concurrencies will allocate 1024 for each sandboxed processor
	- [ ] For Hybrid
		- It creates a sandboxed processor with Heap limits
			and processes jobs in parallel as per concurrency!

### Workers

- Three types of workers
- [x] Embedded
	- Works on the same server where processor is added so the more
		jobs runs in parallel, the more memory heap it consumes
- [x] Sandbox
	- Spawns a new node process for the jobs, More scalable and
		keeps parent server clean from heap issues!
- [ ] Hybrid
	- Most likely combination of the above two, Creates one process and
		runs everything in parallel to avoid any harm to parent server!
- Pre-start hooks
	- [ ] Used to execute code to prepare the worker,
		- Mostly, it will be db and websocket connections along with clients like shopify etc.
			so that it can have all the required things before running the worker.
- Hooks & Events
	- [ ] Before Work
		- Picks X jobs based on Concurrency, Do some logic and return array.
		- The length of array will be pushed to workers (if picked five jobs
			because of five concurrencies and new array is of 7,
			then a total of seven workers will be created)
	- [ ] After Work
		- Perform clean up if required.
	- Other generic events
		- [x] Job Add
		- [x] Job Start
		- [x] Job Success
		- [x] Job Fail
	- Batch specific events
		- [ ] Before Batch Start
		- [ ] Before Item Start
		- [ ] On Item Success
		- [ ] On Item Fail
		- [ ] After Item End
		- [ ] After Batch End

### Batching

- Three types of workers
- [ ] A dedicated method to schedule multiple jobs (an array) in a queue with some
	additional hooks as mentioned above
- [ ] Can provide a unique id or it’ll return a new generated id
- [ ] Option to delay the execution to wait for more items, so it can be added later on
- [ ] Once all item added or batch is set to start immediately

## Contributing

The Queuify project welcomes all constructive contributions. Contributions take many forms,
from code for bug fixes and enhancements, to additions and fixes to documentation, additional
tests, triaging incoming pull requests and issues, and more!

See the [Contributing Guide](CONTRIBUTING.md) for more technical details on contributing.

### Security Issues

If you discover a security vulnerability in Queuify, please see [Security Policies and Procedures](SECURITY.md).