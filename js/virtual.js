/* ==========================================================================
 * Virtual Memory Management Simulator
 *
 * Algorithms:
 *  1. FIFO                              (First-In, First-Out)
 *  2. OPT                               (Optimal / Bélády's)
 *  3. LRU                               (Least Recently Used)
 *  4. ARB                               (LRU Approximation — Additional Reference Bits)
 *  5. Clock                             (Second-Chance)
 *  6. Enhanced Clock                    (Second-Chance with Dirty Bit)
 *  7. LFU                               (Least Frequently Used)
 *  8. MFU                               (Most Frequently Used)
 *
 * Run:
 *   node virtual-memory.js
 * ========================================================================== */

'use strict';

const readline = require('node:readline/promises');
const fs = require('node:fs');
const { stdin: input, stdout: output } = require('node:process');

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULTS = Object.freeze({
    REFERENCE_STRING: '7 0 1 2 0 3 0 4 2 3 0 3 2',
    FRAMES: 3,
    MEMORY_ACCESS_TIME: 100,
    PAGE_FAULT_SERVICE_TIME: 8_000_000,
    ARB_INTERVAL: 3,
});

const ALGORITHMS = Object.freeze({
    fifo: 'FIFO',
    opt: 'Optimal (Bélády)',
    lru: 'LRU',
    arb: 'LRU Approximation (ARB)',
    clock: 'Second-Chance / Clock',
    enhanced: 'Enhanced Second-Chance',
    lfu: 'Least Frequently Used (LFU)',
    mfu: 'Most Frequently Used (MFU)',
});

// Exported for tests
module.exports = { DEFAULTS, ALGORITHMS, simulate };

// ── I/O helpers ───────────────────────────────────────────────────────────────

function makeDivider(char = '─', len = 80) {
    return char.repeat(len);
}

/** Creates a question-asker that works in both TTY and piped-input modes. */
function createReader() {
    if (input.isTTY) {
        const rl = readline.createInterface({ input, output });
        return {
            ask: prompt => rl.question(prompt),
            close: () => rl.close(),
        };
    }

    const lines = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    let cursor = 0;
    return {
        ask: async prompt => {
            const answer = lines[cursor++] ?? '';
            console.log(`${prompt}${answer}`);
            return answer;
        },
        close: () => { },
    };
}

/** Parses a string into a positive integer, or returns null on failure. */
function parsePositiveInt(raw) {
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
}

/** Repeatedly prompts until the user enters a positive integer (or hits Enter for the default). */
async function promptPositiveInt(ask, label, defaultValue) {
    while (true) {
        const raw = (await ask(`${label} [${defaultValue}]: `)).trim();
        if (raw === '') return defaultValue;

        const value = parsePositiveInt(raw);
        if (value !== null) return value;

        console.log('  ⚠  Please enter a positive integer.');
    }
}

/** Prompts the user to choose one of the supported algorithms. */
async function promptAlgorithm(ask) {
    const menu = [
        '',
        '  Algorithms',
        '  ──────────',
        '  1. FIFO',
        '  2. Optimal (Bélády)',
        '  3. LRU',
        '  4. ARB  (LRU Approximation — Additional Reference Bits)',
        '  5. Clock (Second-Chance)',
        '  6. Enhanced Clock (Second-Chance + Dirty Bit)',
        '  7. LFU  (Least Frequently Used)',
        '  8. MFU  (Most Frequently Used)',
        '',
    ].join('\n');

    const keyMap = {
        '': 'fifo', '1': 'fifo',
        '2': 'opt', '3': 'lru',
        '4': 'arb', '5': 'clock',
        '6': 'enhanced', '7': 'lfu', '8': 'mfu',
    };

    while (true) {
        console.log(menu);
        const raw = (await ask('  Choose algorithm [1]: ')).trim();
        if (raw in keyMap) return keyMap[raw];
        console.log('  ⚠  Invalid selection — enter a number from 1 to 8.\n');
    }
}

/** Parses the reference-string input and validates it. */
function parseReferenceString(raw) {
    const pages = (raw || DEFAULTS.REFERENCE_STRING)
        .trim()
        .split(/\s+/)
        .map(Number);

    if (pages.some(Number.isNaN)) {
        throw new Error('Reference string contains non-numeric values.');
    }
    if (pages.length === 0) {
        throw new Error('Reference string must not be empty.');
    }
    return pages;
}

/** Collects all simulation parameters from the user. */
async function getUserInput() {
    const reader = createReader();
    try {
        const algorithm = await promptAlgorithm(reader.ask);
        const refRaw = (await reader.ask(`  Reference String [${DEFAULTS.REFERENCE_STRING}]: `)).trim();
        const referenceString = parseReferenceString(refRaw);
        const frames = await promptPositiveInt(reader.ask, '  Number of Frames', DEFAULTS.FRAMES);
        const memoryAccessTime = await promptPositiveInt(reader.ask, '  Memory Access Time (ns)', DEFAULTS.MEMORY_ACCESS_TIME);
        const pageFaultServiceTime = await promptPositiveInt(reader.ask, '  Page Fault Service Time (ns)', DEFAULTS.PAGE_FAULT_SERVICE_TIME);

        return { algorithm, referenceString, frames, memoryAccessTime, pageFaultServiceTime };
    } finally {
        reader.close();
    }
}

// ── Frame / State factories ───────────────────────────────────────────────────

/** Creates a single empty frame. */
function makeFrame() {
    return { page: null, R: 0, M: 0, refByte: 0, count: 0, lastUsed: 0 };
}

/** Creates the initial simulation state. */
function makeState(frameCount) {
    return {
        frames: Array.from({ length: frameCount }, makeFrame),
        pageHits: 0,
        pageFaults: 0,
        clockHand: 0,
        fifoQueue: [],   // stores frame indices in arrival order
        time: 0,
    };
}

// ── Frame helpers ─────────────────────────────────────────────────────────────

/** Returns the index of the frame holding `page`, or -1 if not present. */
function indexOfPage(frames, page) {
    return frames.findIndex(f => f.page === page);
}

/** Returns the index of the first empty frame, or -1 if all are occupied. */
function indexOfEmpty(frames) {
    return frames.findIndex(f => f.page === null);
}

/** Loads a page into a frame, resetting all metadata. */
function loadIntoFrame(frame, page, time) {
    frame.page = page;
    frame.R = 1;
    frame.M = 0;
    frame.refByte = 0;
    frame.count = 1;
    frame.lastUsed = time;
}

/** Records a page hit on a frame. */
function recordHit(frame, state) {
    state.pageHits++;
    frame.R = 1;
    frame.count++;
    frame.lastUsed = state.time;
    // Simulate occasional write access (30 % chance)
    if (Math.random() < 0.3) frame.M = 1;
}

// ── Replacement-algorithm implementations ─────────────────────────────────────

function runFIFO(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        state.fifoQueue.push(empty);
        return { status: 'PAGE FAULT', victim: null };
    }

    const victimIdx = state.fifoQueue.shift();
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    state.fifoQueue.push(victimIdx);
    return { status: 'PAGE FAULT', victim: victimPage };
}

/** Picks the frame whose page will be used farthest in the future (or never). */
function pickOptimalVictim(frames, refs, fromIndex) {
    let victim = 0;
    let farthest = -1;

    for (let i = 0; i < frames.length; i++) {
        let nextUse = Infinity;
        for (let j = fromIndex + 1; j < refs.length; j++) {
            if (refs[j] === frames[i].page) { nextUse = j; break; }
        }
        if (nextUse > farthest) { farthest = nextUse; victim = i; }
    }
    return victim;
}

function runOPT(page, state, refs, currentIndex) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        return { status: 'PAGE FAULT', victim: null };
    }

    const victimIdx = pickOptimalVictim(state.frames, refs, currentIndex);
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    return { status: 'PAGE FAULT', victim: victimPage };
}

/** Picks the frame least recently used (smallest lastUsed timestamp). */
function pickLRUVictim(frames) {
    return frames.reduce(
        (best, _, i) => frames[i].lastUsed < frames[best].lastUsed ? i : best,
        0
    );
}

function runLRU(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        return { status: 'PAGE FAULT', victim: null };
    }

    const victimIdx = pickLRUVictim(state.frames);
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    return { status: 'PAGE FAULT', victim: victimPage };
}

/**
 * Shifts each frame's reference byte right by 1 and inserts the current R bit
 * into the MSB, then clears R. Called periodically at every ARB_INTERVAL ticks.
 */
function ageAllFrames(frames) {
    for (const frame of frames) {
        frame.refByte = (frame.refByte >>> 1) | (frame.R === 1 ? 0b10000000 : 0);
        frame.R = 0;
    }
}

function runARB(page, state) {
    if (state.time % DEFAULTS.ARB_INTERVAL === 0) {
        ageAllFrames(state.frames);
    }

    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        state.frames[hit].R = 1;
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        state.frames[empty].R = 1;
        return { status: 'PAGE FAULT', victim: null };
    }

    // Replace the frame with the smallest reference byte (least recently used)
    const victimIdx = state.frames.reduce(
        (best, _, i) => state.frames[i].refByte < state.frames[best].refByte ? i : best,
        0
    );
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    state.frames[victimIdx].R = 1;
    return { status: 'PAGE FAULT', victim: victimPage };
}

function runClock(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        state.frames[hit].R = 1;
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    // Walk the clock hand until we find a frame with R=0 (or an empty slot)
    while (true) {
        const frame = state.frames[state.clockHand];
        const advance = () => { state.clockHand = (state.clockHand + 1) % state.frames.length; };

        if (frame.page === null || frame.R === 0) {
            const victimPage = frame.page;   // null if empty slot
            loadIntoFrame(frame, page, state.time);
            advance();
            return { status: 'PAGE FAULT', victim: victimPage };
        }

        frame.R = 0;   // give this page a second chance
        advance();
    }
}

/** Maps (R, M) pairs to priority classes: 0 (best to evict) → 3 (worst). */
function evictionClass(frame) {
    return (frame.R << 1) | frame.M;   // (1,1)→3, (1,0)→2, (0,1)→1, (0,0)→0
}

function runEnhancedClock(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        state.frames[hit].R = 1;
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    // Scan from the clock hand; prefer the lowest eviction class
    let victimIdx = -1;
    let bestClass = Infinity;

    for (let pass = 0; pass < state.frames.length; pass++) {
        const i = (state.clockHand + pass) % state.frames.length;
        const frame = state.frames[i];

        if (frame.page === null) { victimIdx = i; break; }

        const cls = evictionClass(frame);
        if (cls < bestClass) {
            bestClass = cls;
            victimIdx = i;
            if (cls === 0) break;   // can't do better than class 0
        }
    }

    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    state.frames[victimIdx].R = 1;
    state.clockHand = (victimIdx + 1) % state.frames.length;
    return { status: 'PAGE FAULT', victim: victimPage };
}

/** Picks the victim for LFU: smallest count, ties broken by oldest lastUsed. */
function pickFrequencyVictim(frames, preferLeast) {
    return frames.reduce((best, _, i) => {
        const cur = frames[i];
        const bst = frames[best];
        const worseThan = preferLeast
            ? cur.count < bst.count
            : cur.count > bst.count;
        return worseThan || (cur.count === bst.count && cur.lastUsed < bst.lastUsed) ? i : best;
    }, 0);
}

function runLFU(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        return { status: 'PAGE FAULT', victim: null };
    }

    const victimIdx = pickFrequencyVictim(state.frames, true);
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    return { status: 'PAGE FAULT', victim: victimPage };
}

function runMFU(page, state) {
    const hit = indexOfPage(state.frames, page);
    if (hit !== -1) {
        recordHit(state.frames[hit], state);
        return { status: 'PAGE HIT', victim: null };
    }

    state.pageFaults++;

    const empty = indexOfEmpty(state.frames);
    if (empty !== -1) {
        loadIntoFrame(state.frames[empty], page, state.time);
        return { status: 'PAGE FAULT', victim: null };
    }

    const victimIdx = pickFrequencyVictim(state.frames, false);
    const victimPage = state.frames[victimIdx].page;
    loadIntoFrame(state.frames[victimIdx], page, state.time);
    return { status: 'PAGE FAULT', victim: victimPage };
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const RUNNERS = {
    fifo: (page, state, _refs, _i) => runFIFO(page, state),
    opt: (page, state, refs, i) => runOPT(page, state, refs, i),
    lru: (page, state, _refs, _i) => runLRU(page, state),
    arb: (page, state, _refs, _i) => runARB(page, state),
    clock: (page, state, _refs, _i) => runClock(page, state),
    enhanced: (page, state, _refs, _i) => runEnhancedClock(page, state),
    lfu: (page, state, _refs, _i) => runLFU(page, state),
    mfu: (page, state, _refs, _i) => runMFU(page, state),
};

function dispatchStep(page, state, config, index) {
    const runner = RUNNERS[config.algorithm];
    if (!runner) throw new Error(`Unknown algorithm: "${config.algorithm}"`);
    return runner(page, state, config.referenceString, index);
}

// ── Public simulate() — usable from tests ─────────────────────────────────────

/**
 * Runs the full simulation and returns an array of step records plus summary stats.
 * Each step: { time, page, status, victim, frames: [...snapshot] }
 */
function simulate(config) {
    const state = makeState(config.frames);
    const steps = [];

    for (let i = 0; i < config.referenceString.length; i++) {
        state.time = i;
        const page = config.referenceString[i];
        const result = dispatchStep(page, state, config, i);

        steps.push({
            time: i,
            page,
            status: result.status,
            victim: result.victim,
            // Deep snapshot so callers see the state *after* this reference
            frames: state.frames.map(f => ({ ...f })),
            clockHand: state.clockHand,
            pageFaults: state.pageFaults,
            pageHits: state.pageHits,
        });
    }

    const total = state.pageHits + state.pageFaults;
    const faultRate = total > 0 ? state.pageFaults / total : 0;

    return {
        steps,
        summary: {
            totalReferences: total,
            pageHits: state.pageHits,
            pageFaults: state.pageFaults,
            pageFaultRate: faultRate,
            memoryAccessTime: config.memoryAccessTime,
            pageFaultServiceTime: config.pageFaultServiceTime,
            effectiveAccessTime: calculateEAT(config.memoryAccessTime, config.pageFaultServiceTime, faultRate),
        },
    };
}

// ── Presentation ──────────────────────────────────────────────────────────────

function calculateEAT(mat, pfst, faultRate) {
    return mat + faultRate * pfst;
}

function printHeader(config) {
    console.log('\n' + makeDivider('═'));
    console.log('  VIRTUAL MEMORY MANAGEMENT SIMULATOR');
    console.log(makeDivider('═'));
    console.log(`  Algorithm : ${ALGORITHMS[config.algorithm]}`);
    console.log(`  Frames    : ${config.frames}`);
    console.log(`  Ref String: ${config.referenceString.join(' ')}`);
    console.log(makeDivider('─'));
}

function printFrameTable(frames) {
    const SEP = '+--------+-------+---+---+----------+-------+';
    console.log('\n  Frame Table');
    console.log('  ' + SEP);
    console.log('  | Frame  | Page  | R | M | RefByte  | Count |');
    console.log('  ' + SEP);
    for (const [i, f] of frames.entries()) {
        const page = f.page === null ? '—' : String(f.page);
        const refByte = f.refByte.toString(2).padStart(8, '0');
        console.log(
            `  | F${String(i).padEnd(5)} | ${page.padEnd(5)} | ${f.R} | ${f.M} | ${refByte} | ${String(f.count).padEnd(5)} |`
        );
    }
    console.log('  ' + SEP);
}

function printStep(step) {
    console.log('\n' + makeDivider('─'));
    console.log(`  Reference : ${step.page}`);
    console.log(`  Status    : ${step.status}`);
    console.log(`  Victim    : ${step.victim === null ? 'none' : step.victim}`);
    console.log(`  Clock Hand: F${step.clockHand}`);
    console.log(`  Faults so far: ${step.pageFaults}  |  Hits so far: ${step.pageHits}`);
    console.log(`  Fault Rate   : ${((step.pageFaults / (step.pageFaults + step.pageHits)) * 100).toFixed(2)}%`);
    printFrameTable(step.frames);
}

function printSummary(summary) {
    console.log('\n' + makeDivider('═'));
    console.log('  FINAL SUMMARY');
    console.log(makeDivider('═'));
    console.log(`  Total References       : ${summary.totalReferences}`);
    console.log(`  Page Hits              : ${summary.pageHits}`);
    console.log(`  Page Faults            : ${summary.pageFaults}`);
    console.log(`  Page Fault Rate        : ${(summary.pageFaultRate * 100).toFixed(2)} %`);
    console.log(makeDivider('─'));
    console.log(`  Memory Access Time     : ${summary.memoryAccessTime} ns`);
    console.log(`  Page Fault Service Time: ${summary.pageFaultServiceTime} ns`);
    console.log(`  Effective Access Time  : ${summary.effectiveAccessTime.toFixed(2)} ns`);
    console.log(makeDivider('═') + '\n');
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
    const config = await getUserInput();
    const { steps, summary } = simulate(config);

    printHeader(config);
    for (const step of steps) printStep(step);
    printSummary(summary);
}

// Guard so that `require('./virtual-memory')` in tests doesn't auto-run main()
if (require.main === module) {
    main().catch(err => {
        console.error(`\n  ✖  ${err.message}`);
        process.exitCode = 1;
    });
}