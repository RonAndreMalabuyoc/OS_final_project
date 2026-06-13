/* ==========================================================================
 * Memory Management Demo
 * MFT: Fixed Partition Allocation
 * Allocation algorithms: First Fit, Next Fit, Best Fit, Worst Fit
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
const ALGORITHMS = {
    first: 'First Fit',
    next: 'Next Fit',
    best: 'Best Fit',
    worst: 'Worst Fit',
};
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

async function askAlgorithm(ask) {
    while (true) {
        console.log('Allocation Algorithm');
        console.log('  1. First Fit');
        console.log('  2. Next Fit');
        console.log('  3. Best Fit');
        console.log('  4. Worst Fit');

        const answer = (await ask('Choose algorithm [2]: ')).trim();
        if (answer === '' || answer === '2') return 'next';
        if (answer === '1') return 'first';
        if (answer === '3') return 'best';
        if (answer === '4') return 'worst';

        console.log('Please enter 1 for First Fit, 2 for Next Fit, 3 for Best Fit, or 4 for Worst Fit.');
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

        const algorithm = await askAlgorithm(ask);
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
            algorithm,
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
        partitionId: null,
        startTime: null,
        finishTime: null,
    }));
}

function createFixedPartitions(config) {
    const blocks = [
        { type: 'os', start: 0, sizeKb: config.osMemoryKb, task: null },
    ];

    let nextStart = config.osMemoryKb;
    config.partitionSizes.forEach((sizeKb, index) => {
        blocks.push({
            type: 'partition',
            id: index + 1,
            start: nextStart,
            sizeKb,
            task: null,
        });
        nextStart += sizeKb;
    });

    const unpartitionedKb = config.totalMemoryKb - nextStart;
    if (unpartitionedKb > 0) {
        blocks.push({ type: 'unpartitioned', start: nextStart, sizeKb: unpartitionedKb, task: null });
    }

    return blocks;
}

function printHeader(config) {
    console.log('\nMFT: FIXED PARTITION ALLOCATION');
    printLine();
    console.log(`Total memory:        ${config.totalMemoryKb} KB`);
    console.log(`OS memory:           ${config.osMemoryKb} KB`);
    console.log(`User memory:         ${config.userMemoryKb} KB`);
    console.log(`Fixed partitions:    ${config.partitionSizes.join(', ')} KB`);
    console.log(`Job count:           ${config.jobs.length}`);
    console.log(`Allocation method:   ${ALGORITHMS[config.algorithm]}`);
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

function findFirstFit(blocks, task) {
    return blocks.findIndex(block =>
        block.type === 'partition' &&
        block.task === null &&
        block.sizeKb >= task.sizeKb
    );
}

function getPartitionIndexes(blocks) {
    return blocks
        .map((block, index) => ({ block, index }))
        .filter(item => item.block.type === 'partition')
        .map(item => item.index);
}

function findNextFit(blocks, task, allocator) {
    const partitionIndexes = getPartitionIndexes(blocks);
    if (partitionIndexes.length === 0) return -1;

    for (let offset = 0; offset < partitionIndexes.length; offset += 1) {
        const pointer = (allocator.nextPointer + offset) % partitionIndexes.length;
        const blockIndex = partitionIndexes[pointer];
        const block = blocks[blockIndex];

        if (block.task === null && block.sizeKb >= task.sizeKb) {
            allocator.nextPointer = (pointer + 1) % partitionIndexes.length;
            return blockIndex;
        }
    }

    return -1;
}

function findBestFit(blocks, task) {
    let bestIndex = -1;
    let smallestWaste = Infinity;

    blocks.forEach((block, index) => {
        if (block.type !== 'partition' || block.task !== null || block.sizeKb < task.sizeKb) {
            return;
        }

        const waste = block.sizeKb - task.sizeKb;
        if (waste < smallestWaste) {
            bestIndex = index;
            smallestWaste = waste;
        }
    });

    return bestIndex;
}

function findWorstFit(blocks, task) {
    let worstIndex = -1;
    let largestWaste = -1;

    blocks.forEach((block, index) => {
        if (block.type !== 'partition' || block.task !== null || block.sizeKb < task.sizeKb) {
            return;
        }

        const waste = block.sizeKb - task.sizeKb;
        if (waste > largestWaste) {
            worstIndex = index;
            largestWaste = waste;
        }
    });

    return worstIndex;
}

function findPartition(blocks, task, allocator) {
    if (allocator.algorithm === 'next') {
        return findNextFit(blocks, task, allocator);
    }

    if (allocator.algorithm === 'best') {
        return findBestFit(blocks, task);
    }

    if (allocator.algorithm === 'worst') {
        return findWorstFit(blocks, task);
    }

    return findFirstFit(blocks, task);
}

function allocateTask(blocks, task, clock, allocator) {
    const partitionIndex = findPartition(blocks, task, allocator);
    if (partitionIndex === -1) return false;

    const partition = blocks[partitionIndex];
    task.status = 'Running';
    task.startAddress = partition.start;
    task.partitionId = partition.id;
    if (task.startTime === null) {
        task.startTime = clock;
    }

    partition.task = task;

    console.log(`t=${clock}: ${task.id} loaded into partition ${partition.id} by ${ALGORITHMS[allocator.algorithm]}.`);
    return true;
}

function allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock, allocator) {
    const stillWaiting = [];
    const largestPartition = Math.max(...config.partitionSizes);

    for (const task of waitingQueue) {
        if (task.sizeKb > largestPartition) {
            task.status = 'Rejected';
            rejected.push(task);
            console.log(`t=${clock}: ${task.id} rejected because ${task.sizeKb} KB is larger than every fixed partition.`);
            continue;
        }

        if (allocateTask(blocks, task, clock, allocator)) {
            continue;
        }

        stillWaiting.push(task);
    }

    return stillWaiting;
}

function tick(blocks, completed, clock) {
    for (const block of [...blocks]) {
        if (block.type !== 'partition' || block.task === null) continue;

        block.task.remainingTime -= 1;

        if (block.task.remainingTime === 0) {
            block.task.status = 'Completed';
            block.task.finishTime = clock + 1;
            completed.push(block.task);
            console.log(`t=${clock + 1}: ${block.task.id} completed and released partition ${block.id}.`);

            block.task = null;
        }
    }
}

function getTotalFreeMemory(blocks) {
    return blocks.reduce((total, block) => {
        if (block.type !== 'partition' || block.task !== null) return total;
        return total + block.sizeKb;
    }, 0);
}

function getUsedUserMemory(blocks) {
    return blocks.reduce((total, block) => {
        if (block.type !== 'partition' || block.task === null) return total;
        return total + block.task.sizeKb;
    }, 0);
}

function getInternalFragmentation(blocks) {
    return blocks.reduce((total, block) => {
        if (block.type !== 'partition' || block.task === null) return total;
        return total + (block.sizeKb - block.task.sizeKb);
    }, 0);
}

function formatBlock(block) {
    const end = block.start + block.sizeKb - 1;

    if (block.type === 'os') {
        return `OS       ${block.start}-${end} KB (${block.sizeKb} KB reserved)`;
    }

    if (block.type === 'unpartitioned') {
        return `UNUSED   ${block.start}-${end} KB (${block.sizeKb} KB not partitioned)`;
    }

    if (block.task === null) {
        return `P${String(block.id).padEnd(7)} ${block.start}-${end} KB (${block.sizeKb} KB free)`;
    }

    const waste = block.sizeKb - block.task.sizeKb;
    return `P${String(block.id).padEnd(7)} ${block.start}-${end} KB: ${block.task.id} (${block.task.sizeKb}/${block.sizeKb} KB, ${block.task.remainingTime}/${block.task.runTime} time left, waste=${waste} KB)`;
}

function getChartLabel(block) {
    if (block.type === 'os') return 'OS';
    if (block.type === 'unpartitioned') return 'UNUSED';
    if (block.task === null) return `P${block.id}`;
    return `P${block.id}:${block.task.id}`;
}

function centerLabel(label, width) {
    if (width <= 0) return '';
    if (label.length > width) return label.slice(0, width);

    const left = Math.floor((width - label.length) / 2);
    const right = width - label.length - left;
    return `${' '.repeat(left)}${label}${' '.repeat(right)}`;
}

function printMemoryChart(blocks) {
    const chartWidth = 64;
    const totalMemory = blocks.reduce((total, block) => total + block.sizeKb, 0);
    const parts = [];

    blocks.forEach((block, index) => {
        const isLast = index === blocks.length - 1;
        const proportionalWidth = Math.round((block.sizeKb / totalMemory) * chartWidth);
        const usedWidth = parts.reduce((sum, part) => sum + part.width, 0);
        const width = isLast ? chartWidth - usedWidth : Math.max(3, proportionalWidth);

        parts.push({
            label: getChartLabel(block),
            width,
        });
    });

    const bar = parts.map(part => centerLabel(part.label, part.width)).join('|');
    const scale = parts.map(part => '-'.repeat(part.width)).join('+');

    console.log('\nMemory allocation chart:');
    console.log(`  |${bar}|`);
    console.log(`  0${scale}${totalMemory} KB`);
}

function printMemoryMap(blocks, clock) {
    console.log(`\nMemory map at t=${clock}:`);
    blocks.forEach(block => console.log(`  ${formatBlock(block)}`));
    printMemoryChart(blocks);
    console.log(`  Jobs currently in memory: ${blocks.filter(block => block.type === 'partition' && block.task !== null).length}`);
    console.log(`  Used user memory:         ${getUsedUserMemory(blocks)} KB`);
    console.log(`  Free partition memory:    ${getTotalFreeMemory(blocks)} KB`);
    console.log(`  Internal fragmentation:   ${getInternalFragmentation(blocks)} KB`);
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
    return waitingQueue.length === 0 && blocks.every(block => block.type !== 'partition' || block.task === null);
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
        const partition = task.partitionId === null ? 'n/a' : `P${task.partitionId}`;
        console.log(`  ${task.id}: ${task.status}, arrival=${task.arrivalOrder}, partition=${partition}, start address=${address}, finish=${finish}`);
    });
}

function runMftDemo(config) {
    const blocks = createFixedPartitions(config);
    const allTasks = createTaskStates(config.jobs);
    const completed = [];
    const rejected = [];
    const allocator = {
        algorithm: config.algorithm,
        nextPointer: 0,
    };
    let waitingQueue = [...allTasks];
    let clock = 0;

    printHeader(config);
    printJobList(config.jobs);

    waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock, allocator);
    printMemoryMap(blocks, clock);
    printQueues(waitingQueue, completed, rejected);

    while (!isFinished(blocks, waitingQueue)) {
        printLine();
        tick(blocks, completed, clock);
        clock += 1;
        waitingQueue = allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock, allocator);
        printMemoryMap(blocks, clock);
        printQueues(waitingQueue, completed, rejected);
    }

    printSummary(allTasks, completed, rejected, clock);
}

async function main() {
    const config = await getUserInput();
    runMftDemo(config);
}

main().catch(error => {
    console.error('Program failed:', error.message);
    process.exitCode = 1;
});
