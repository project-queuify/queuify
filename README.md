Queuify is building!
[![codecov](https://codecov.io/gh/Mr0nline/queuify/graph/badge.svg?token=HTYAPT9VM1)](https://codecov.io/gh/Mr0nline/queuify)

## Queuify Pattern!

- Options (For whole Queuify)
   1. [**Worker Type**] _Sandbox / Embedded / Hybrid_
   2. [**Max workers**] _default 0 (Infinite)_
   3. [**Max concurrency**] (default 0) _x amount of job should be processed by each queue_
   4. [**Batch Concurrency**] _defaults to Max Concurrency or 1 if max is infinite! Only needed when batch runs in parallel_
   5. [**Run Batch in Parallel**] _Should hold of another job during batch execution or not! On enabling, Total queue concurrency will be Max concurrency + Batch concurrency_
   6. [**Max execution time**] _If a sandboxed worker doesn't finish up in given time, the Process will be killed (Useful to kill memory leak, Make sure it’s kind of 10x than you think)_
   7. [**Polling**] (not yet decided) _If we need a sort of polling request to find for new jobs, then this will be used to decide at how many seconds we should re-fetch data from DB!_
   8. [**Connection options**]
         1. [**DB**] _Redis, DragonFly_
         2. [**DB Options**] _If there is something that we want to use specifically_


- Options (For each queue)
   1. [**Worker Type**] _Sandbox / Embedded / Hybrid_ (takes priority over above concurrency)
   2. [**Max concurrency**] _default 0_ (takes priority over above concurrency)
   3. [**Batch concurrency**] (takes priority over above concurrency)
   4. [**Run Batch in parallel**] (takes priority over above)
   5. [**Max execution time**] (takes priority over above)
   6. [**Heap limit**] (in MB)
      1. [**For Sandbox**] _limit gets divided per concurrency. 2048 MB with concurrency 2 will allocate 1024 for each sandboxed processor_
      2. [**For Hybrid**] _It creates a sandboxed processor with Heap limits and processes jobs in parallel as per concurrency!_


- Workers
   1. Total three types
      1. [**Sandboxes**] _Spawns a new node process for the jobs, More scalable and keeps parent server clean from heap issues!_
      2. [**Embedded**] _Works on the same server where processor is added so the more jobs runs in parallel, the more memory heap it consumes_
      3. [**Hybrid**] _Most likely combination of above two, Creates one process and runs everything in parallel to avoid any harm to parent server!_
   2. [**Pre-start hooks**] _Used to execute code to prepare the worker, Mostly it will be db and websocket connections along with clients like shopify etc. so that it can have all the required things before running the worker_
   3. Hooks/Events
      1. [**Before Work**] _Picks X jobs based on Concurrency, Do some logic and return array. The length of array will be pushed to workers (if picked five jobs because of five concurrency and new array is of 7 then total of seven workers will be created)_
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
