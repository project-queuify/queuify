'use strict';
// Forked from https://github.com/pkrumins/node-tree-kill

import { spawn, exec } from 'child_process';

interface ProcessTree {
  [pid: number]: number[];
}

type Signal = string | number | undefined;

export default function killProcessTree(pid: number, signal: Signal, callback?: (...args: unknown[]) => void): void {
  if (typeof signal === 'function' && callback === undefined) {
    callback = signal;
    signal = undefined;
  }

  pid = parseInt(pid.toString());
  if (Number.isNaN(pid)) {
    if (callback) {
      return callback(new Error('pid must be a number'));
    } else {
      throw new Error('pid must be a number');
    }
  }

  const tree: ProcessTree = {};
  const pidsToProcess: { [pid: number]: number } = {};
  tree[pid] = [];
  pidsToProcess[pid] = 1;

  switch (process.platform) {
    case 'win32':
      exec(`taskkill /pid ${pid} /T /F`, callback);
      break;
    case 'darwin':
      buildProcessTree(
        pid,
        tree,
        pidsToProcess,
        (parentPid) => spawn('pgrep', ['-P', parentPid.toString()]),
        () => killAll(tree, signal, callback),
      );
      break;
    // case 'sunos':
    //     buildProcessTreeSunOS(pid, tree, pidsToProcess, function () {
    //         killAll(tree, signal, callback);
    //     });
    //     break;
    default: // Linux
      buildProcessTree(
        pid,
        tree,
        pidsToProcess,
        (parentPid) => spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid.toString()]),
        () => killAll(tree, signal, callback),
      );
      break;
  }
}

function killAll(tree: ProcessTree, signal: Signal, callback?: (...args: unknown[]) => void): void {
  const killed: { [pid: number]: number } = {};
  try {
    Object.keys(tree).forEach(function (pid) {
      tree[+pid].forEach(function (pidpid: number) {
        if (!killed[pidpid]) {
          killPid(pidpid, signal);
          killed[pidpid] = 1;
        }
      });
      if (!killed[+pid]) {
        killPid(+pid, signal);
        killed[+pid] = 1;
      }
    });
  } catch (err) {
    if (callback) {
      return callback(err);
    } else {
      throw err;
    }
  }
  if (callback) {
    return callback();
  }
}

function killPid(pid: number, signal: Signal): void {
  try {
    process.kill(parseInt(pid.toString(), 10), signal);
  } catch (err: any) {
    if (err.code !== 'ESRCH') throw err;
  }
}

function buildProcessTree(
  parentPid: number,
  tree: ProcessTree,
  pidsToProcess: { [pid: number]: number },
  spawnChildProcessesList: (parentPid: number) => any,
  cb: () => void,
): void {
  const ps = spawnChildProcessesList(parentPid);
  let allData = '';
  ps.stdout.on('data', function (data: { toString: (arg0: string) => any }) {
    const dataStr = data?.toString?.('ascii');
    allData += dataStr;
  });

  const onClose = function (code: number) {
    delete pidsToProcess[parentPid];

    if (code != 0) {
      // no more parent processes
      if (Object.keys(pidsToProcess).length == 0) {
        cb();
      }
      return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    allData.match(/\d+/g).forEach(function (pid: number) {
      pid = parseInt(pid?.toString(), 10);
      tree[parentPid].push(pid);
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
    });
  };

  ps.on('close', onClose);
}
