/* ==========================================================================
 * Virtual Memory Management Simulator
 *
 * Algorithms:
 *  1. FIFO
 *  2. OPTIMAL
 *  3. LRU
 *  4. LRU Approximation (Additional Reference Bits)
 *  5. Second Chance / Clock
 *  6. Enhanced Second Chance
 *  7. LFU
 *  8. MFU
 *
 * Run:
 *   node virtual-memory.js
 * ========================================================================== */

'use strict';

const readline = require('node:readline/promises');
const fs = require('node:fs');
const { stdin: input, stdout: output } = require('node:process');

const DEFAULT_REFERENCE_STRING =
    '7 0 1 2 0 3 0 4 2 3 0 3 2';

const DEFAULT_FRAMES = 3;
const DEFAULT_MEMORY_ACCESS_TIME = 100;
const DEFAULT_PAGE_FAULT_SERVICE_TIME = 8000000;

const ALGORITHMS = {
    fifo: 'FIFO',
    opt: 'Optimal',
    lru: 'LRU',
    arb: 'LRU Approximation (ARB)',
    clock: 'Second Chance / Clock',
    enhanced: 'Enhanced Second Chance',
    lfu: 'Least Frequently Used',
    mfu: 'Most Frequently Used',
};

module.exports = {
    DEFAULT_REFERENCE_STRING,
    DEFAULT_FRAMES,
    DEFAULT_MEMORY_ACCESS_TIME,
    DEFAULT_PAGE_FAULT_SERVICE_TIME,
    ALGORITHMS,
};

function printLine() {
    console.log('-'.repeat(80));
}

function createQuestionReader() {
    if (input.isTTY) {
        const rl =
            readline.createInterface({
                input,
                output
            });
        return {
            ask: prompt => rl.question(prompt),
            close: () => rl.close(),
        };
    }
    const answers =
        fs.readFileSync(0, 'utf8')
            .split(/\r?\n/);
    let index = 0;
    return {
        ask: async prompt => {
            const answer =
                answers[index] ?? '';
            index++;
            console.log(
                `${prompt}${answer}`
            );
            return answer;
        },
        close: () => {},
    };
}

function parsePositiveInteger(value) {
    const number =
        Number.parseInt(value, 10);
    if (
        Number.isNaN(number) ||
        number <= 0
    ) {
        return null;
    }
    return number;
}

async function askPositiveInteger(
    ask,
    question,
    defaultValue
) {
    while (true) {
        const answer =
            (
                await ask(
                    `${question} [${defaultValue}]: `
                )
            ).trim();
        if (answer === '') {
            return defaultValue;
        }
        const value =
            parsePositiveInteger(answer);
        if (value !== null) {
            return value;
        }
        console.log(
            'Please enter a positive number.'
        );
    }
}

async function askAlgorithm(ask) {
    while (true) {
        console.log('\nAlgorithms');
        console.log(' 1. FIFO');
        console.log(' 2. OPTIMAL');
        console.log(' 3. LRU');
        console.log(' 4. ARB');
        console.log(' 5. CLOCK');
        console.log(' 6. ENHANCED CLOCK');
        console.log(' 7. LFU');
        console.log(' 8. MFU');
        const answer =
            (
                await ask(
                    '\nChoose algorithm [1]: '
                )
            ).trim();
        if (answer === '' || answer === '1')
            return 'fifo';
        if (answer === '2')
            return 'opt';
        if (answer === '3')
            return 'lru';
        if (answer === '4')
            return 'arb';
        if (answer === '5')
            return 'clock';
        if (answer === '6')
            return 'enhanced';
        if (answer === '7')
            return 'lfu';
        if (answer === '8')
            return 'mfu';
        console.log(
            'Invalid selection.'
        );
    }
}

async function getUserInput() {
    const reader =
        createQuestionReader();
    const ask = reader.ask;
    try {
        const algorithm =
            await askAlgorithm(ask);
        const refStringInput =
            (
                await ask(
                    `Reference String [${DEFAULT_REFERENCE_STRING}]: `
                )
            ).trim();
        const referenceString =
            (
                refStringInput ||
                DEFAULT_REFERENCE_STRING
            )
            .split(/\s+/)
            .map(Number);
	if (
		referenceString.some(
     		   Number.isNaN
    )
) {
   		 throw new Error(
      		  'Reference string contains invalid values.'
    );
}
        const frames =
            await askPositiveInteger(
                ask,
                'Number of Frames',
                DEFAULT_FRAMES
            );
        const memoryAccessTime =
            await askPositiveInteger(
                ask,
                'Memory Access Time (ns)',
                DEFAULT_MEMORY_ACCESS_TIME
            );
        const pageFaultServiceTime =
            await askPositiveInteger(
                ask,
                'Page Fault Service Time (ns)',
                DEFAULT_PAGE_FAULT_SERVICE_TIME
            );
        return {
            algorithm,
            referenceString,
            frames,
            memoryAccessTime,
            pageFaultServiceTime,
        };
    } finally {
        reader.close();
    }
}

function createFrames(count) {
    return Array.from(
        { length: count },
        () => ({
            page: null,
            R: 0,
            M: 0,
            refByte: 0,
            count: 0,
            lastUsed: 0,
        })
    );
}

function findPage(frames, page) {
    return frames.findIndex(
        frame =>
            frame.page === page
    );
}

function findEmptyFrame(frames) {
    return frames.findIndex(
        frame =>
            frame.page === null
    );
}

function createState(config) {
    return {
        frames:
            createFrames(
                config.frames
            ),
        pageHits: 0,
        pageFaults: 0,
        clockHand: 0,
        fifoQueue: [],
        time: 0,
    };
}

function printHeader(config) {
    console.log(
        '\nVIRTUAL MEMORY MANAGEMENT SIMULATOR'
    );
    printLine();
    console.log(
        `Algorithm: ${
            ALGORITHMS[
                config.algorithm
            ]
        }`
    );
    console.log(
        `Frames: ${config.frames}`
    );
    console.log(
        `Reference String: ${
            config.referenceString
                .join(' ')
        }`
    );
    printLine();
}

main().catch(error => {
    console.error(
        'Program failed:',
        error.message
    );
    process.exitCode = 1;
});

function printFrameTable(frames) {
    console.log('\nFrame Table');
    console.log(
        '+-------+------+---+---+---------+-------+'
    );
    console.log(
        '|Frame  |Page  |R  |M  |RefByte  |Count  |'
    );
    console.log(
        '+-------+------+---+---+---------+-------+'
    );
    frames.forEach((frame, index) => {
        const page =
            frame.page === null
                ? '-'
                : frame.page;
        const refByte =
            frame.refByte
                .toString(2)
                .padStart(8, '0');
        console.log(
            `|F${index}`.padEnd(8) +
            `|${String(page)}`.padEnd(6) +
            `|${frame.R}`.padEnd(4) +
            `|${frame.M}`.padEnd(4) +
            `|${refByte}`.padEnd(10) +
            `|${frame.count}`.padEnd(8) +
            '|'
        );
    });
    console.log(
        '+-------+------+---+---+---------+-------+'
    );
}

function printStep(
    page,
    status,
    victim,
    state
) {
    printLine();
    console.log(
        `Current Page Reference: ${page}`
    );
    console.log(
        `Status: ${status}`
    );
    console.log(
        `Victim Page: ${
            victim === null
                ? 'None'
                : victim
        }`
    );
    printFrameTable(
        state.frames
    );
    const total =
        state.pageHits +
        state.pageFaults;
    const rate =
        getFaultRate(
            state.pageFaults,
            total
        );
    console.log(
        `Clock Hand: F${state.clockHand}`
    );
    console.log(
        `Page Fault Count: ${state.pageFaults}`
    );
    console.log(
        `Page Fault Rate: ${(rate * 100)
            .toFixed(2)}%`
    );
}

function loadPage(
    frame,
    page,
    time
) {
    frame.page = page;
    frame.R = 1;
    frame.M = 0;
    frame.refByte = 0;
    frame.count = 1;
    frame.lastUsed = time;
}

function processHit(frame, state) {
    state.pageHits++;
    frame.R = 1;
    frame.count++;
    frame.lastUsed = state.time;
    frame.M = Math.random() < 0.3 ? 1 : frame.M;
}

function simulateWriteAccess(frame) {
    frame.M = 1;
}

function selectFIFO(state) {
    return state.fifoQueue.shift();
}

function runFIFO(
    page,
    state
) {
    const hitIndex =
        findPage(
            state.frames,
            page
        );
    if (hitIndex !== -1) {
        processHit(
            state.frames[hitIndex],
            state
        );
        return {
            status:
                'PAGE HIT',
            victim: null
        };
    }
    state.pageFaults++;
    const empty =
        findEmptyFrame(
            state.frames
        );
    if (empty !== -1) {
        loadPage(
            state.frames[empty],
            page,
            state.time
        );
        state.fifoQueue.push(
            empty
        );
        return {
            status:
                'PAGE FAULT',
            victim: null
        };
    }
    const victimFrame =
        selectFIFO(state);
    const victimPage =
        state.frames[
            victimFrame
        ].page;
    loadPage(
        state.frames[
            victimFrame
        ],
        page,
        state.time
    );
    state.fifoQueue.push(
        victimFrame
    );
    return {
        status:
            'PAGE FAULT',
        victim:
            victimPage
    };
}

function selectOPT(
    frames,
    refs,
    currentIndex
) {
    let victim = 0;
    let farthest = -1;
    for (
        let i = 0;
        i < frames.length;
        i++
    ) {
        let nextUse = Infinity;
        for (
            let j = currentIndex + 1;
            j < refs.length;
            j++
        ) {
            if (
                refs[j] ===
                frames[i].page
            ) {
                nextUse = j;
                break;
            }
        }
        if (
            nextUse > farthest
        ) {
            farthest =
                nextUse;
            victim = i;
        }
    }
    return victim;
}

function runOPT(
    page,
    state,
    refs,
    currentIndex
) {
    const hit =
        findPage(
            state.frames,
            page
        );
    if (hit !== -1) {
        processHit(
            state.frames[hit],
            state
        );
        return {
            status:
                'PAGE HIT',
            victim: null
        };
    }
    state.pageFaults++;
    const empty =
        findEmptyFrame(
            state.frames
        );
    if (empty !== -1) {
        loadPage(
            state.frames[empty],
            page,
            state.time
        );
        return {
            status:
                'PAGE FAULT',
            victim: null
        };
    }
    const victim =
        selectOPT(
            state.frames,
            refs,
            currentIndex
        );
    const victimPage =
        state.frames[
            victim
        ].page;
    loadPage(
        state.frames[
            victim
        ],
        page,
        state.time
    );
    return {
        status:
            'PAGE FAULT',
        victim:
            victimPage
    };
}

main().catch(error => {
    console.error(
        'Program failed:',
        error.message
    );

    process.exitCode = 1;
});
