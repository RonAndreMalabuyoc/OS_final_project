/* ==========================================================================
 * Memory Management Demo
 * Multiprogramming with a Fixed Number of Tasks (MFT)
 *
 * Run in the VS Code terminal:
 *   node js/memory.js
 * ========================================================================== */

'use strict';

const MEMORY_SIZE_KB = 1024;
const FIXED_PARTITION_COUNT = 4;
const PARTITION_SIZE_KB = Math.floor(MEMORY_SIZE_KB / FIXED_PARTITION_COUNT);

const tasks = [
    { id: 'T1', sizeKb: 120, runTime: 5 },
    { id: 'T2', sizeKb: 210, runTime: 8 },
    { id: 'T3', sizeKb: 80, runTime: 4 },
    { id: 'T4', sizeKb: 300, runTime: 7 },
    { id: 'T5', sizeKb: 160, runTime: 6 },
    { id: 'T6', sizeKb: 90, runTime: 3 },
];

function createPartitions() {
    return Array.from({ length: FIXED_PARTITION_COUNT }, (_, index) => ({
        id: index + 1,
        sizeKb: PARTITION_SIZE_KB,
        task: null,
    }));
}

function createTaskStates() {
    return tasks.map(task => ({
        ...task,
        remainingTime: task.runTime,
        status: 'Waiting',
        partitionId: null,
        startTime: null,
        finishTime: null,
    }));
}

function formatTask(task) {
    return `${task.id} (${task.sizeKb} KB, ${task.remainingTime}/${task.runTime} time left)`;
}

function printLine() {
    console.log('-'.repeat(72));
}

function printHeader() {
    console.log('\nMULTIPROGRAMMING WITH A FIXED NUMBER OF TASKS (MFT)');
    printLine();
    console.log(`Total memory:      ${MEMORY_SIZE_KB} KB`);
    console.log(`Fixed partitions:  ${FIXED_PARTITION_COUNT}`);
    console.log(`Partition size:    ${PARTITION_SIZE_KB} KB each`);
    console.log(`Fixed task count:  ${tasks.length}`);
    printLine();
}

function printTaskList() {
    console.log('Task list:');
    tasks.forEach(task => {
        console.log(`  ${task.id}: size=${task.sizeKb} KB, run time=${task.runTime}`);
    });
    printLine();
}

function allocateWaitingTasks(partitions, waitingQueue, rejected, clock) {
    const stillWaiting = [];

    for (const task of waitingQueue) {
        if (task.sizeKb > PARTITION_SIZE_KB) {
            task.status = 'Rejected';
            rejected.push(task);
            console.log(`t=${clock}: ${task.id} rejected because ${task.sizeKb} KB > ${PARTITION_SIZE_KB} KB partition.`);
            continue;
        }

        const freePartition = partitions.find(partition => partition.task === null);
        if (!freePartition) {
            stillWaiting.push(task);
            continue;
        }

        task.status = 'Running';
        task.partitionId = freePartition.id;
        if (task.startTime === null) {
            task.startTime = clock;
        }
        freePartition.task = task;
        console.log(`t=${clock}: ${task.id} loaded into partition ${freePartition.id}.`);
    }

    return stillWaiting;
}

function tick(partitions, completed, clock) {
    for (const partition of partitions) {
        if (!partition.task) continue;

        partition.task.remainingTime -= 1;

        if (partition.task.remainingTime === 0) {
            partition.task.status = 'Completed';
            partition.task.finishTime = clock + 1;
            completed.push(partition.task);
            console.log(`t=${clock + 1}: ${partition.task.id} completed in partition ${partition.id}.`);
            partition.task = null;
        }
    }
}

function getInternalFragmentation(partitions) {
    return partitions.reduce((total, partition) => {
        if (!partition.task) return total;
        return total + (partition.sizeKb - partition.task.sizeKb);
    }, 0);
}

function getUsedMemory(partitions) {
    return partitions.reduce((total, partition) => {
        if (!partition.task) return total;
        return total + partition.task.sizeKb;
    }, 0);
}

function printMemoryMap(partitions, clock) {
    console.log(`\nMemory map at t=${clock}:`);

    partitions.forEach(partition => {
        if (!partition.task) {
            console.log(`  Partition ${partition.id}: empty (${partition.sizeKb} KB free)`);
            return;
        }

        const freeKb = partition.sizeKb - partition.task.sizeKb;
        console.log(
            `  Partition ${partition.id}: ${formatTask(partition.task)}, internal fragmentation=${freeKb} KB`
        );
    });

    console.log(`  Current internal fragmentation: ${getInternalFragmentation(partitions)} KB`);
    console.log(`  Current memory used by tasks:    ${getUsedMemory(partitions)} KB`);
}

function printQueues(waitingQueue, completed, rejected) {
    const waiting = waitingQueue.map(task => task.id).join(', ') || 'none';
    const done = completed.map(task => task.id).join(', ') || 'none';
    const bad = rejected.map(task => task.id).join(', ') || 'none';

    console.log(`  Waiting queue: ${waiting}`);
    console.log(`  Completed:     ${done}`);
    console.log(`  Rejected:      ${bad}`);
}

function isFinished(partitions, waitingQueue) {
    return waitingQueue.length === 0 && partitions.every(partition => partition.task === null);
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
        const location = task.partitionId ? `partition ${task.partitionId}` : 'not loaded';
        const finish = task.finishTime === null ? 'n/a' : task.finishTime;
        console.log(`  ${task.id}: ${task.status}, ${location}, finish=${finish}`);
    });
}

function runMftDemo() {
    const partitions = createPartitions();
    const allTasks = createTaskStates();
    const completed = [];
    const rejected = [];
    let waitingQueue = [...allTasks];
    let clock = 0;

    printHeader();
    printTaskList();

    waitingQueue = allocateWaitingTasks(partitions, waitingQueue, rejected, clock);
    printMemoryMap(partitions, clock);
    printQueues(waitingQueue, completed, rejected);

    while (!isFinished(partitions, waitingQueue)) {
        printLine();
        tick(partitions, completed, clock);
        clock += 1;
        waitingQueue = allocateWaitingTasks(partitions, waitingQueue, rejected, clock);
        printMemoryMap(partitions, clock);
        printQueues(waitingQueue, completed, rejected);
    }

    printSummary(allTasks, completed, rejected, clock);
}

runMftDemo();
