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

