/* ==========================================================================
 * Memory Management Demo
 * Multiprogramming with a Variable Number of Tasks (MVT)
 *
 * Run in the VS Code terminal:
 *   node js/memory.js
 * ========================================================================== */

'use strict';

const MEMORY_SIZE_KB = 1024;
const OS_RESERVED_KB = 128;
const USER_MEMORY_KB = MEMORY_SIZE_KB - OS_RESERVED_KB;

const tasks = [
    { id: 'T1', sizeKb: 180, runTime: 5 },
    { id: 'T2', sizeKb: 240, runTime: 7 },
    { id: 'T3', sizeKb: 120, runTime: 4 },
    { id: 'T4', sizeKb: 300, runTime: 8 },
    { id: 'T5', sizeKb: 160, runTime: 6 },
    { id: 'T6', sizeKb: 90, runTime: 3 },
    { id: 'T7', sizeKb: 420, runTime: 5 },
];

function createTaskStates() {
    return tasks.map(task => ({
        ...task,
        remainingTime: task.runTime,
        status: 'Waiting',
        startAddress: null,
        startTime: null,
        finishTime: null,
    }));
}

function createMemoryBlocks() {
    return [
        { type: 'os', start: 0, sizeKb: OS_RESERVED_KB, task: null },
        { type: 'hole', start: OS_RESERVED_KB, sizeKb: USER_MEMORY_KB, task: null },
    ];
}

function printLine() {
    console.log('-'.repeat(78));
}

function printHeader() {
    console.log('\nMULTIPROGRAMMING WITH A VARIABLE NUMBER OF TASKS (MVT)');
    printLine();
    console.log(`Total memory:        ${MEMORY_SIZE_KB} KB`);
    console.log(`OS reserved memory:  ${OS_RESERVED_KB} KB`);
    console.log(`User memory:         ${USER_MEMORY_KB} KB`);
    console.log(`Task count:          ${tasks.length}`);
    console.log('Allocation method:   First fit with compaction when needed');
    printLine();
}

function printTaskList() {
    console.log('Task list:');
    tasks.forEach(task => {
        console.log(`  ${task.id}: size=${task.sizeKb} KB, run time=${task.runTime}`);
    });
    printLine();
}

function mergeAdjacentHoles(blocks) {
    for (let index = 0; index < blocks.length - 1; index += 1) {
        const current = blocks[index];
        const next = blocks[index + 1];

        if (current.type === 'hole' && next.type === 'hole') {
            current.sizeKb += next.sizeKb;
            blocks.splice(index + 1, 1);
            index -= 1;
        }
    }
}

function compactMemory(blocks, clock) {
    const taskBlocks = blocks.filter(block => block.type === 'task');
    let nextStart = OS_RESERVED_KB;

    for (const block of taskBlocks) {
        block.start = nextStart;
        block.task.startAddress = nextStart;
        nextStart += block.sizeKb;
    }

    blocks.length = 0;
    blocks.push({ type: 'os', start: 0, sizeKb: OS_RESERVED_KB, task: null });
    blocks.push(...taskBlocks);

    const remaining = MEMORY_SIZE_KB - nextStart;
    if (remaining > 0) {
        blocks.push({ type: 'hole', start: nextStart, sizeKb: remaining, task: null });
    }

    console.log(`t=${clock}: compaction performed to combine scattered free memory.`);
}

function findFirstFit(blocks, task) {
    return blocks.findIndex(block => block.type === 'hole' && block.sizeKb >= task.sizeKb);
}

function allocateTask(blocks, task, clock) {
    const holeIndex = findFirstFit(blocks, task);
    if (holeIndex === -1) return false;

    const hole = blocks[holeIndex];
    const taskBlock = {
        type: 'task',
        start: hole.start,
        sizeKb: task.sizeKb,
        task,
    };

    task.status = 'Running';
    task.startAddress = hole.start;
    if (task.startTime === null) {
        task.startTime = clock;
    }

    if (hole.sizeKb === task.sizeKb) {
        blocks.splice(holeIndex, 1, taskBlock);
    } else {
        hole.start += task.sizeKb;
        hole.sizeKb -= task.sizeKb;
        blocks.splice(holeIndex, 0, taskBlock);
    }

    console.log(`t=${clock}: ${task.id} loaded at address ${task.startAddress} KB.`);
    return true;
}

function allocateWaitingTasks(blocks, waitingQueue, rejected, clock) {
    const stillWaiting = [];

    for (const task of waitingQueue) {
        if (task.sizeKb > USER_MEMORY_KB) {
            task.status = 'Rejected';
            rejected.push(task);
            console.log(`t=${clock}: ${task.id} rejected because it is larger than user memory.`);
            continue;
        }

        if (allocateTask(blocks, task, clock)) {
            continue;
        }

        const totalFree = getTotalFreeMemory(blocks);
        if (totalFree >= task.sizeKb) {
            compactMemory(blocks, clock);
            if (allocateTask(blocks, task, clock)) {
                continue;
            }
        }

        stillWaiting.push(task);
    }

    return stillWaiting;
}

function tick(blocks, completed, clock) {
    for (const block of [...blocks]) {
        if (block.type !== 'task') continue;

        block.task.remainingTime -= 1;

        if (block.task.remainingTime === 0) {
            block.task.status = 'Completed';
            block.task.finishTime = clock + 1;
            completed.push(block.task);
            console.log(`t=${clock + 1}: ${block.task.id} completed and released ${block.sizeKb} KB.`);

            block.type = 'hole';
            block.task = null;
        }
    }

    mergeAdjacentHoles(blocks);
}

function getTotalFreeMemory(blocks) {
    return blocks.reduce((total, block) => {
        if (block.type !== 'hole') return total;
        return total + block.sizeKb;
    }, 0);
}

function getLargestHole(blocks) {
    return blocks.reduce((largest, block) => {
        if (block.type !== 'hole') return largest;
        return Math.max(largest, block.sizeKb);
    }, 0);
}

function getExternalFragmentation(blocks) {
    const totalFree = getTotalFreeMemory(blocks);
    const largestHole = getLargestHole(blocks);
    return totalFree - largestHole;
}

function getUsedUserMemory(blocks) {
    return blocks.reduce((total, block) => {
        if (block.type !== 'task') return total;
        return total + block.sizeKb;
    }, 0);
}

function formatBlock(block) {
    const end = block.start + block.sizeKb - 1;

    if (block.type === 'os') {
        return `OS       ${block.start}-${end} KB (${block.sizeKb} KB reserved)`;
    }

    if (block.type === 'hole') {
        return `HOLE     ${block.start}-${end} KB (${block.sizeKb} KB free)`;
    }

    return `${block.task.id.padEnd(8)} ${block.start}-${end} KB (${block.sizeKb} KB, ${block.task.remainingTime}/${block.task.runTime} time left)`;
}

function printMemoryMap(blocks, clock) {
    console.log(`\nMemory map at t=${clock}:`);
    blocks.forEach(block => console.log(`  ${formatBlock(block)}`));
    console.log(`  Tasks currently in memory: ${blocks.filter(block => block.type === 'task').length}`);
    console.log(`  Used user memory:          ${getUsedUserMemory(blocks)} KB`);
    console.log(`  Total free memory:         ${getTotalFreeMemory(blocks)} KB`);
    console.log(`  External fragmentation:    ${getExternalFragmentation(blocks)} KB`);
}

function printQueues(waitingQueue, completed, rejected) {
    const waiting = waitingQueue.map(task => task.id).join(', ') || 'none';
    const done = completed.map(task => task.id).join(', ') || 'none';
    const bad = rejected.map(task => task.id).join(', ') || 'none';

    console.log(`  Waiting queue: ${waiting}`);
    console.log(`  Completed:     ${done}`);
    console.log(`  Rejected:      ${bad}`);
}

function isFinished(blocks, waitingQueue) {
    return waitingQueue.length === 0 && blocks.every(block => block.type !== 'task');
}

function printSummary(allTasks, completed, rejected, clock) {
    const accepted = allTasks.filter(task => task.status !== 'Rejected');
    const averageTurnaround = completed.length === 0
        ? 0
        : completed.reduce((total, task) => total + (task.finishTime - task.startTime), 0) / completed.length;

    printLine();
    console.log('FINAL SUMMARY');
    printLine();
    console.log(`Total time elapsed:      ${clock}`);
    console.log(`Tasks accepted:          ${accepted.length}`);
    console.log(`Tasks completed:         ${completed.length}`);
    console.log(`Tasks rejected:          ${rejected.length}`);
    console.log(`Average turnaround time: ${averageTurnaround.toFixed(2)}`);

    console.log('\nPer-task result:');
    allTasks.forEach(task => {
        const address = task.startAddress === null ? 'not loaded' : `${task.startAddress} KB`;
        const finish = task.finishTime === null ? 'n/a' : task.finishTime;
        console.log(`  ${task.id}: ${task.status}, start address=${address}, finish=${finish}`);
    });
}

function runMvtDemo() {
    const blocks = createMemoryBlocks();
    const allTasks = createTaskStates();
    const completed = [];
    const rejected = [];
    let waitingQueue = [...allTasks];
    let clock = 0;

    printHeader();
    printTaskList();

    waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, clock);
    printMemoryMap(blocks, clock);
    printQueues(waitingQueue, completed, rejected);

    while (!isFinished(blocks, waitingQueue)) {
        printLine();
        tick(blocks, completed, clock);
        clock += 1;
        waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, clock);
        printMemoryMap(blocks, clock);
        printQueues(waitingQueue, completed, rejected);
    }

    printSummary(allTasks, completed, rejected, clock);
}

runMvtDemo();
