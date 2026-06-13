/* ==========================================================================
 * Memory Management Demo
 * Multiprogramming with a Variable Number of Tasks (MVT)
 *
 * Run in the VS Code terminal:
 *   node js/memory.js
 * ========================================================================== */

'use strict';

const readline = require('node:readline/promises');
const fs = require('node:fs');
const { stdin: input, stdout: output } = require('node:process');

const MIN_PARTITION_KB = 4;
const MAX_PARTITION_KB = 64;

const DEFAULT_TOTAL_MEMORY_KB = 384;
const DEFAULT_OS_MEMORY_KB = 128;
const DEFAULT_PARTITION_SIZES = [64, 64, 64, 64];
const DEFAULT_PARTITION_COUNT = DEFAULT_PARTITION_SIZES.length;
const DEFAULT_JOBS = [
    { id: 'J1', sizeKb: 32, arrivalOrder: 1 },
    { id: 'J2', sizeKb: 48, arrivalOrder: 2 },
    { id: 'J3', sizeKb: 20, arrivalOrder: 3 },
    { id: 'J4', sizeKb: 60, arrivalOrder: 4 },
    { id: 'J5', sizeKb: 28, arrivalOrder: 5 },
];

function printLine() {
    console.log('-'.repeat(78));
}

function parsePositiveInteger(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number) || number <= 0) return null;
    return number;
}

function createQuestionReader() {
    if (input.isTTY) {
        const rl = readline.createInterface({ input, output });
        return {
            ask: prompt => rl.question(prompt),
            close: () => rl.close(),
        };
    }

    const answers = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    let index = 0;

    return {
        ask: async prompt => {
            const answer = answers[index] ?? '';
            index += 1;
            console.log(`${prompt}${answer}`);
            return answer;
        },
        close: () => {},
    };
}

async function askPositiveInteger(ask, question, defaultValue) {
    while (true) {
        const answer = (await ask(`${question} [${defaultValue}]: `)).trim();
        if (answer === '') return defaultValue;

        const value = parsePositiveInteger(answer);
        if (value !== null) return value;

        console.log('Please enter a positive whole number.');
    }
}

async function askPartitionSize(ask, partitionNumber, defaultValue) {
    while (true) {
        const sizeKb = await askPositiveInteger(ask, `Partition ${partitionNumber} Size in KB (${MIN_PARTITION_KB}-${MAX_PARTITION_KB})`, defaultValue);
        if (sizeKb >= MIN_PARTITION_KB && sizeKb <= MAX_PARTITION_KB) return sizeKb;

        console.log(`Partition size must be between ${MIN_PARTITION_KB} KB and ${MAX_PARTITION_KB} KB.`);
    }
}

async function askPartitionSizes(ask, userMemoryKb) {
    while (true) {
        const partitionCount = await askPositiveInteger(ask, 'Number of Partitions', DEFAULT_PARTITION_COUNT);
        const sizes = [];

        for (let index = 0; index < partitionCount; index += 1) {
            const defaultValue = DEFAULT_PARTITION_SIZES[index] || MAX_PARTITION_KB;
            sizes.push(await askPartitionSize(ask, index + 1, defaultValue));
        }

        const total = sizes.reduce((sum, size) => sum + size, 0);
        if (total <= userMemoryKb) return sizes;

        console.log(`Partition total is ${total} KB, but user memory is only ${userMemoryKb} KB.`);
        console.log('Please enter the partition count and sizes again.\n');
    }
}

async function askJob(ask, index) {
    const defaultJob = DEFAULT_JOBS[index] || {
        id: `J${index + 1}`,
        sizeKb: 100 + (index * 25),
        arrivalOrder: index + 1,
    };

    const idAnswer = (await ask(`Job ID [${defaultJob.id}]: `)).trim();
    const id = idAnswer || defaultJob.id;
    const sizeKb = await askPositiveInteger(ask, `Job Size for ${id} in KB`, defaultJob.sizeKb);
    const arrivalOrder = await askPositiveInteger(ask, `Arrival Order for ${id}`, defaultJob.arrivalOrder);

    return {
        id,
        sizeKb,
        arrivalOrder,
        runTime: Math.max(1, Math.ceil(sizeKb / 60)),
    };
}

async function getUserInput() {
    const reader = createQuestionReader();
    const ask = reader.ask;

    try {
        console.log('\nEnter memory configuration. Press Enter to use the default in brackets.\n');

        const totalMemoryKb = await askPositiveInteger(ask, 'Total Memory Size in KB', DEFAULT_TOTAL_MEMORY_KB);
        let osMemoryKb;

        while (true) {
            osMemoryKb = await askPositiveInteger(ask, 'OS Memory Size in KB', DEFAULT_OS_MEMORY_KB);
            if (osMemoryKb < totalMemoryKb) break;
            console.log('OS memory must be smaller than total memory.');
        }

        const userMemoryKb = totalMemoryKb - osMemoryKb;
        const partitionSizes = await askPartitionSizes(ask, userMemoryKb);
        const jobCount = await askPositiveInteger(ask, 'Number of Jobs', DEFAULT_JOBS.length);
        const jobs = [];

        console.log('\nEnter job details. Runtime is calculated automatically from job size.\n');
        for (let index = 0; index < jobCount; index += 1) {
            console.log(`Job ${index + 1}`);
            jobs.push(await askJob(ask, index));
            console.log('');
        }

        return {
            totalMemoryKb,
            osMemoryKb,
            userMemoryKb,
            partitionSizes,
            jobs: jobs.sort((a, b) => {
                if (a.arrivalOrder !== b.arrivalOrder) return a.arrivalOrder - b.arrivalOrder;
                return a.id.localeCompare(b.id);
            }),
        };
    } finally {
        reader.close();
    }
}

function createTaskStates(jobs) {
    return jobs.map(job => ({
        ...job,
        remainingTime: job.runTime,
        status: 'Waiting',
        startAddress: null,
        startTime: null,
        finishTime: null,
    }));
}

function createMemoryBlocks(config) {
    const blocks = [
        { type: 'os', start: 0, sizeKb: config.osMemoryKb, task: null },
    ];

    let nextStart = config.osMemoryKb;
    for (const sizeKb of config.partitionSizes) {
        blocks.push({ type: 'hole', start: nextStart, sizeKb, task: null });
        nextStart += sizeKb;
    }

    let leftoverKb = config.totalMemoryKb - nextStart;
    while (leftoverKb > 0) {
        const sizeKb = Math.min(leftoverKb, MAX_PARTITION_KB);
        blocks.push({ type: 'hole', start: nextStart, sizeKb, task: null });
        nextStart += sizeKb;
        leftoverKb -= sizeKb;
    }

    return blocks;
}

function printHeader(config) {
    console.log('\nMULTIPROGRAMMING WITH A VARIABLE NUMBER OF TASKS (MVT)');
    printLine();
    console.log(`Total memory:        ${config.totalMemoryKb} KB`);
    console.log(`OS memory:           ${config.osMemoryKb} KB`);
    console.log(`User memory:         ${config.userMemoryKb} KB`);
    console.log(`Partition sizes:     ${config.partitionSizes.join(', ')} KB`);
    console.log(`Job count:           ${config.jobs.length}`);
    console.log('Allocation method:   First fit with compaction when needed');
    printLine();
}

function printJobList(jobs) {
    console.log('Job list by arrival order:');
    jobs.forEach(job => {
        console.log(
            `  ${job.id}: size=${job.sizeKb} KB, arrival order=${job.arrivalOrder}, runtime=${job.runTime}`
        );
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

function compactMemory(blocks, config, clock) {
    const taskBlocks = blocks.filter(block => block.type === 'task');
    let nextStart = config.osMemoryKb;

    for (const block of taskBlocks) {
        block.start = nextStart;
        block.task.startAddress = nextStart;
        nextStart += block.sizeKb;
    }

    blocks.length = 0;
    blocks.push({ type: 'os', start: 0, sizeKb: config.osMemoryKb, task: null });
    blocks.push(...taskBlocks);

    const remaining = config.totalMemoryKb - nextStart;
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

function allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock) {
    const stillWaiting = [];

    for (const task of waitingQueue) {
        if (task.sizeKb > config.userMemoryKb) {
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
            compactMemory(blocks, config, clock);
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
    console.log(`  Jobs currently in memory: ${blocks.filter(block => block.type === 'task').length}`);
    console.log(`  Used user memory:         ${getUsedUserMemory(blocks)} KB`);
    console.log(`  Total free memory:        ${getTotalFreeMemory(blocks)} KB`);
    console.log(`  External fragmentation:   ${getExternalFragmentation(blocks)} KB`);
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
    console.log(`Jobs accepted:           ${accepted.length}`);
    console.log(`Jobs completed:          ${completed.length}`);
    console.log(`Jobs rejected:           ${rejected.length}`);
    console.log(`Average turnaround time: ${averageTurnaround.toFixed(2)}`);

    console.log('\nPer-job result:');
    allTasks.forEach(task => {
        const address = task.startAddress === null ? 'not loaded' : `${task.startAddress} KB`;
        const finish = task.finishTime === null ? 'n/a' : task.finishTime;
        console.log(`  ${task.id}: ${task.status}, arrival=${task.arrivalOrder}, start address=${address}, finish=${finish}`);
    });
}

function runMvtDemo(config) {
    const blocks = createMemoryBlocks(config);
    const allTasks = createTaskStates(config.jobs);
    const completed = [];
    const rejected = [];
    let waitingQueue = [...allTasks];
    let clock = 0;

    printHeader(config);
    printJobList(config.jobs);

    waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock);
    printMemoryMap(blocks, clock);
    printQueues(waitingQueue, completed, rejected);

    while (!isFinished(blocks, waitingQueue)) {
        printLine();
        tick(blocks, completed, clock);
        clock += 1;
        waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock);
        printMemoryMap(blocks, clock);
        printQueues(waitingQueue, completed, rejected);
    }

    printSummary(allTasks, completed, rejected, clock);
}

async function main() {
    const config = await getUserInput();
    runMvtDemo(config);
}

main().catch(error => {
    console.error('Program failed:', error.message);
    process.exitCode = 1;
});
