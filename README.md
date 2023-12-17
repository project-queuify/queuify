Queuify is building!
[![codecov](https://codecov.io/gh/Mr0nline/queuify/graph/badge.svg?token=HTYAPT9VM1)](https://codecov.io/gh/Mr0nline/queuify)

## Queuify Pattern!

1. Options (For whole Queuify)
   1. Worker Type = Sandbox / Embedded / Hybrid
   2. Max workers - default 0 (Infinite)
   3. Max concurrency - default 0 - x amount of job should be processed by each queue
   4. Batch Concurrency - defaults to Max Concurrency or 1 if max is infinite! Only needed when batch runs in parallel
   5. Run Batch in Parallel - Should hold of other job during batch execution or not! On enabling, Total queue concurrency will be Max concurrency + Batch concurrency.
   6. Max execution time - If sandboxed worker doesn’t finish up in given time, Process will be killed (Useful to kill memory leak, Make sure it’s kind of 10x then you think)
   7. Polling (not yet decided) - If we need a sort of polling request to find for new jobs then this will be used to decide at how many seconds we should re-fetch data from DB!
   8. Connection options
      1. DB - Redis, DragonFly
      2. DB Options - If there is something that we want to use specifically.
2. Options (For each queue)
   1. Worker Type = Sandbox / Embedded / Hybrid - takes priority over above concurrency
   2. Max concurrency - default 0 - takes priority over above concurrency
   3. Batch concurrency - takes priority over above concurrency
   4. Run Batch in parallel - takes priority over above
   5. Max execution time - takes priority over above
   6. Heap limit - in MB
      1. For Sandbox - limit gets divided per concurrency. 2048 MB with 2 concurrency will allocate 1024 for each sandboxed processor
      2. For Hybrid - It creates a sandboxed processor with Heap limits and processes jobs parallelly as per concurrency!
3. Workers
   1. Three types
      1. Sandboxes - Spawns a new node process for the jobs, More scalable and keeps parent server clean from heap issues!
      2. Embedded - Works on same server where processor is added so the more jobs runs parallelly, the more memory heap it consumes
      3. Hybrid - Most likely combination of above two, Creates one process and runs everything in parallelly to avoid any harm to parent server!
   2. Prestart hooks - Used to execute code to prepare the worker, Mostly it will be db and websocket connections along with clients like shopify etc so that it can have all of the required things before running the worker
   3. Hooks/Events
      1. Before Work - Picks X jobs based on Concurrency, Do some logic and return array. The length of array will be pushed to workers (if picked 5 jobs because of 5 concurrency and new array is of 7 then total of 7 workers will be created)
      2. After Work - Perform clean up if required.
      3. Other generic events like job success, fail, etc.
      4. Batch specific events
         1. Before Batch Start
         2. Before Item Start
         3. On Item Success
         4. On Item Fail
         5. After Item End
         6. After Batch End
4. Batching
   1. A dedicated method to schedule multiple jobs (an array) in a queue with some additional hooks as mentioned above
   2. Can provide a unique id or it’ll return a new generated id
   3. Option to delay the execution to wait for more items so it can be added later on
   4. Once all item added or batch is set to start immediately, Start batch in
