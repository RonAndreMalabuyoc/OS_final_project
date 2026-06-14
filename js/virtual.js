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

main().catch(error => {
    console.error(
        'Program failed:',
        error.message
    );

    process.exitCode = 1;
});
