/* ==========================================================================
 * Memory Management Demo
 * MVT: Variable Partition Allocation
 * Allocation algorithms: First Fit, Next Fit, Best Fit, Worst Fit
 *
 * Run in the VS Code terminal:
 *   node js/memory.js
 * ========================================================================== */

'use strict';

const readline = require('node:readline/promises');
const fs = require('node:fs');
const { stdin: input, stdout: output } = require('node:process');

const DEFAULT_TOTAL_MEMORY_KB = 384;
const DEFAULT_OS_MEMORY_KB = 64;
const ALGORITHMS = {
    first: 'First Fit',
    next: 'Next Fit',
    best: 'Best Fit',
    worst: 'Worst Fit',
};
const DEFAULT_JOBS = [
    { id: 'J1', sizeKb: 80, arrivalOrder: 1, duration: 2 },
    { id: 'J2', sizeKb: 60, arrivalOrder: 2, duration: 3 },
    { id: 'J3', sizeKb: 100, arrivalOrder: 3, duration: 2 },
    { id: 'J4', sizeKb: 70, arrivalOrder: 4, duration: 2 },
    { id: 'J5', sizeKb: 120, arrivalOrder: 5, duration: 2 },
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

async function askYesNo(ask, question, defaultValue) {
    const defaultLabel = defaultValue ? 'Y' : 'N';

    while (true) {
        const answer = (await ask(`${question} [${defaultLabel}]: `)).trim().toLowerCase();
        if (answer === '') return defaultValue;
        if (answer === 'y' || answer === 'yes') return true;
        if (answer === 'n' || answer === 'no') return false;

        console.log('Please enter yes or no.');
    }
}

async function askJob(ask, index) {
    const defaultJob = DEFAULT_JOBS[index] || {
        id: `J${index + 1}`,
        sizeKb: 64,
        arrivalOrder: index + 1,
        duration: 2,
    };

    const idAnswer = (await ask(`Job ID [${defaultJob.id}]: `)).trim();
    const id = idAnswer || defaultJob.id;
    const sizeKb = await askPositiveInteger(ask, `Job Size for ${id} in KB`, defaultJob.sizeKb);
    const arrivalOrder = await askPositiveInteger(ask, `Arrival Order for ${id}`, defaultJob.arrivalOrder);
    const duration = await askPositiveInteger(ask, `Job Duration for ${id}`, defaultJob.duration);

    return { id, sizeKb, arrivalOrder, duration };
}

async function getUserInput() {
    const reader = createQuestionReader();
    const ask = reader.ask;

    try {
        console.log('\nEnter memory configuration. Press Enter to use the default in brackets.\n');

        const algorithm = await askAlgorithm(ask);
        const compactionEnabled = await askYesNo(ask, 'Enable compaction when total free memory can fit a waiting job?', true);
        const totalMemoryKb = await askPositiveInteger(ask, 'Total Memory Size in KB', DEFAULT_TOTAL_MEMORY_KB);
        let osMemoryKb;

        while (true) {
            osMemoryKb = await askPositiveInteger(ask, 'OS Memory Size in KB', DEFAULT_OS_MEMORY_KB);
            if (osMemoryKb < totalMemoryKb) break;
            console.log('OS memory must be smaller than total memory.');
        }

        const userMemoryKb = totalMemoryKb - osMemoryKb;
        const jobCount = await askPositiveInteger(ask, 'Number of Jobs', DEFAULT_JOBS.length);
        const jobs = [];

        console.log('\nEnter job details.\n');
        for (let index = 0; index < jobCount; index += 1) {
            console.log(`Job ${index + 1}`);
            jobs.push(await askJob(ask, index));
            console.log('');
        }

        return {
            algorithm,
            compactionEnabled,
            totalMemoryKb,
            osMemoryKb,
            userMemoryKb,
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
        remainingTime: job.duration,
        status: 'Waiting',
        startAddress: null,
        startTime: null,
        finishTime: null,
    }));
}

function createMemoryBlocks(config) {
    return [
        { type: 'os', start: 0, sizeKb: config.osMemoryKb, task: null },
        { type: 'hole', start: config.osMemoryKb, sizeKb: config.userMemoryKb, task: null },
    ];
}

function printHeader(config) {
    console.log('\nMVT: VARIABLE PARTITION ALLOCATION');
    printLine();
    console.log(`Total memory:        ${config.totalMemoryKb} KB`);
    console.log(`OS memory:           ${config.osMemoryKb} KB`);
    console.log(`User memory:         ${config.userMemoryKb} KB`);
    console.log(`Allocation method:   ${ALGORITHMS[config.algorithm]}`);
    console.log(`Compaction:          ${config.compactionEnabled ? 'Enabled' : 'Disabled'}`);
    printLine();
}

function printJobList(jobs) {
    console.log('Job list by arrival order:');
    jobs.forEach(job => {
        console.log(
            `  ${job.id}: size=${job.sizeKb} KB, arrival=${job.arrivalOrder}, duration=${job.duration}`
        );
    });
    printLine();
}

function getHoleIndexes(blocks) {
    return blocks
        .map((block, index) => ({ block, index }))
        .filter(item => item.block.type === 'hole')
        .map(item => item.index);
}

function findFirstFit(blocks, task) {
    return blocks.findIndex(block => block.type === 'hole' && block.sizeKb >= task.sizeKb);
}

function findNextFit(blocks, task, allocator) {
    const holeIndexes = getHoleIndexes(blocks);
    if (holeIndexes.length === 0) return -1;

    for (let offset = 0; offset < holeIndexes.length; offset += 1) {
        const pointer = (allocator.nextPointer + offset) % holeIndexes.length;
        const blockIndex = holeIndexes[pointer];
        const block = blocks[blockIndex];

        if (block.sizeKb >= task.sizeKb) {
            allocator.nextPointer = (pointer + 1) % holeIndexes.length;
            return blockIndex;
        }
    }

    return -1;
}

function findBestFit(blocks, task) {
    let bestIndex = -1;
    let smallestRemainder = Infinity;

    blocks.forEach((block, index) => {
        if (block.type !== 'hole' || block.sizeKb < task.sizeKb) return;

        const remainder = block.sizeKb - task.sizeKb;
        if (remainder < smallestRemainder) {
            bestIndex = index;
            smallestRemainder = remainder;
        }
    });

    return bestIndex;
}

function findWorstFit(blocks, task) {
    let worstIndex = -1;
    let largestRemainder = -1;

    blocks.forEach((block, index) => {
        if (block.type !== 'hole' || block.sizeKb < task.sizeKb) return;

        const remainder = block.sizeKb - task.sizeKb;
        if (remainder > largestRemainder) {
            worstIndex = index;
            largestRemainder = remainder;
        }
    });

    return worstIndex;
}

function findHole(blocks, task, allocator) {
    if (allocator.algorithm === 'next') return findNextFit(blocks, task, allocator);
    if (allocator.algorithm === 'best') return findBestFit(blocks, task);
    if (allocator.algorithm === 'worst') return findWorstFit(blocks, task);
    return findFirstFit(blocks, task);
}

function allocateTask(blocks, task, clock, allocator) {
    const holeIndex = findHole(blocks, task, allocator);
    if (holeIndex === -1) return false;

    const hole = blocks[holeIndex];
    const taskBlock = {
        type: 'job',
        start: hole.start,
        sizeKb: task.sizeKb,
        task,
    };

    task.status = 'Running';
    task.startAddress = hole.start;
    if (task.startTime === null) task.startTime = clock;

    if (hole.sizeKb === task.sizeKb) {
        blocks.splice(holeIndex, 1, taskBlock);
    } else {
        hole.start += task.sizeKb;
        hole.sizeKb -= task.sizeKb;
        blocks.splice(holeIndex, 0, taskBlock);
        console.log(`t=${clock}: hole split, ${task.id} used ${task.sizeKb} KB and left ${hole.sizeKb} KB free.`);
    }

    console.log(`t=${clock}: ${task.id} loaded at address ${task.startAddress} KB by ${ALGORITHMS[allocator.algorithm]}.`);
    return true;
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
    const jobBlocks = blocks.filter(block => block.type === 'job');
    let nextStart = config.osMemoryKb;

    jobBlocks.forEach(block => {
        block.start = nextStart;
        block.task.startAddress = nextStart;
        nextStart += block.sizeKb;
    });

    blocks.length = 0;
    blocks.push({ type: 'os', start: 0, sizeKb: config.osMemoryKb, task: null });
    blocks.push(...jobBlocks);

    const freeKb = config.totalMemoryKb - nextStart;
    if (freeKb > 0) {
        blocks.push({ type: 'hole', start: nextStart, sizeKb: freeKb, task: null });
    }

    console.log(`t=${clock}: compaction performed, all holes combined into one free block.`);
}

function getTotalFreeMemory(blocks) {
    return blocks.reduce((total, block) => block.type === 'hole' ? total + block.sizeKb : total, 0);
}

function getLargestHole(blocks) {
    return blocks.reduce((largest, block) => block.type === 'hole' ? Math.max(largest, block.sizeKb) : largest, 0);
}

function allocateWaitingTasks(blocks, waitingQueue, rejected, config, clock, allocator) {
    const stillWaiting = [];

    for (const task of waitingQueue) {
        if (task.sizeKb > config.userMemoryKb) {
            task.status = 'Rejected';
            rejected.push(task);
            console.log(`t=${clock}: ${task.id} rejected because it is larger than user memory.`);
            continue;
        }

        if (allocateTask(blocks, task, clock, allocator)) continue;

        if (config.compactionEnabled && getTotalFreeMemory(blocks) >= task.sizeKb && getLargestHole(blocks) < task.sizeKb) {
            compactMemory(blocks, config, clock);
            if (allocateTask(blocks, task, clock, allocator)) continue;
        }

        stillWaiting.push(task);
    }

    return stillWaiting;
}

function tick(blocks, completed, clock) {
    for (const block of [...blocks]) {
        if (block.type !== 'job') continue;

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

function getUsedUserMemory(blocks) {
    return blocks.reduce((total, block) => block.type === 'job' ? total + block.sizeKb : total, 0);
}

function getExternalFragmentation(blocks) {
    return getTotalFreeMemory(blocks) - getLargestHole(blocks);
}

function formatBlock(block) {
    const end = block.start + block.sizeKb - 1;

    if (block.type === 'os') {
        return `OS       ${block.start}-${end} KB (${block.sizeKb} KB reserved)`;
    }

    if (block.type === 'hole') {
        return `HOLE     ${block.start}-${end} KB (${block.sizeKb} KB free)`;
    }

    return `${block.task.id.padEnd(8)} ${block.start}-${end} KB (${block.sizeKb} KB, ${block.task.remainingTime}/${block.task.duration} time left)`;
}

function getChartLabel(block) {
    if (block.type === 'os') return 'OS';
    if (block.type === 'hole') return 'HOLE';
    return block.task.id;
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

        parts.push({ label: getChartLabel(block), width });
    });

    console.log('\nMemory allocation chart:');
    console.log(`  |${parts.map(part => centerLabel(part.label, part.width)).join('|')}|`);
    console.log(`  0${parts.map(part => '-'.repeat(part.width)).join('+')}${totalMemory} KB`);
}

function printFreeSpaceList(blocks) {
    const holes = blocks.filter(block => block.type === 'hole');

    console.log('\nFree space list:');
    if (holes.length === 0) {
        console.log('  none');
        return;
    }

    holes.forEach((hole, index) => {
        console.log(`  Hole ${index + 1}: start=${hole.start} KB, size=${hole.sizeKb} KB`);
    });
}

function printMemoryMap(blocks, clock) {
    console.log(`\nMemory map at t=${clock}:`);
    blocks.forEach(block => console.log(`  ${formatBlock(block)}`));
    printMemoryChart(blocks);
    printFreeSpaceList(blocks);
    console.log(`  Jobs currently in memory: ${blocks.filter(block => block.type === 'job').length}`);
    console.log(`  Used user memory:         ${getUsedUserMemory(blocks)} KB`);
    console.log(`  Total free memory:        ${getTotalFreeMemory(blocks)} KB`);
    console.log(`  Largest hole:             ${getLargestHole(blocks)} KB`);
    console.log(`  External fragmentation:   ${getExternalFragmentation(blocks)} KB`);
    console.log('  Internal fragmentation:   N/A for MVT');
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
    return waitingQueue.length === 0 && blocks.every(block => block.type !== 'job');
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
    runMvtDemo(config);
}

main().catch(error => {
    console.error('Program failed:', error.message);
    process.exitCode = 1;
});
