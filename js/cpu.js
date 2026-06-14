/* ═══════════════════════════════════════════════════════════════════
 *  CPU Scheduling Algorithms — Browser-Compatible Module
 *  Algorithms: FCFS, SJF, SRTF, Priority (NP), Priority (P), Round Robin
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Merges consecutive Gantt blocks that have the same process ID.
 */
function addGanttBlock(ganttChart, id, startTime, endTime) {
    const lastBlock = ganttChart[ganttChart.length - 1];
    if (lastBlock && lastBlock.id === id && lastBlock.endTime === startTime) {
        lastBlock.endTime = endTime;
        return;
    }
    ganttChart.push({ id, startTime, endTime });
}

/**
 * Computes summary metrics from a finished simulation.
 */
function computeMetrics(ganttChart, results) {
    const totalWaitingTime = results.reduce((s, p) => s + p.waitingTime, 0);
    const totalTurnaroundTime = results.reduce((s, p) => s + p.turnaroundTime, 0);
    const totalResponseTime = results.reduce((s, p) => s + p.responseTime, 0);
    const totalBurstTime = results.reduce((s, p) => s + p.burstTime, 0);
    const firstStart = ganttChart.length > 0 ? ganttChart[0].startTime : 0;
    const lastEnd = results.length > 0 ? Math.max(...results.map(p => p.completionTime)) : 0;
    const totalTime = lastEnd - firstStart;

    return {
        averageWaitingTime: results.length > 0 ? totalWaitingTime / results.length : 0,
        averageTurnaroundTime: results.length > 0 ? totalTurnaroundTime / results.length : 0,
        averageResponseTime: results.length > 0 ? totalResponseTime / results.length : 0,
        cpuUtilization: totalTime > 0 ? (totalBurstTime / totalTime) * 100 : 0,
        throughput: totalTime > 0 ? results.length / totalTime : 0,
    };
}

/* ── 1. First-Come, First-Served ──────────────────────────────── */
function simulateFCFS(processes) {
    const sorted = [...processes].sort((a, b) =>
        a.arrivalTime !== b.arrivalTime ? a.arrivalTime - b.arrivalTime : a.inputOrder - b.inputOrder
    );

    let currentTime = 0;
    const ganttChart = [];
    const results = [];

    for (const proc of sorted) {
        if (currentTime < proc.arrivalTime) {
            ganttChart.push({ id: 'Idle', startTime: currentTime, endTime: proc.arrivalTime });
            currentTime = proc.arrivalTime;
        }

        const startTime = currentTime;
        const completionTime = startTime + proc.burstTime;
        const turnaroundTime = completionTime - proc.arrivalTime;
        const waitingTime = turnaroundTime - proc.burstTime;
        const responseTime = startTime - proc.arrivalTime;

        ganttChart.push({ id: proc.id, startTime, endTime: completionTime });
        results.push({
            id: proc.id, arrivalTime: proc.arrivalTime, burstTime: proc.burstTime,
            priority: proc.priority, startTime, completionTime, turnaroundTime, waitingTime, responseTime,
        });
        currentTime = completionTime;
    }

    return { algorithm: 'First-Come, First-Served (FCFS)', ganttChart, results, metrics: computeMetrics(ganttChart, results) };
}

/* ── 2. Shortest Job First (Non-Preemptive) ───────────────────── */
function simulateSJF(processes) {
    const waiting = [...processes].sort((a, b) =>
        a.arrivalTime !== b.arrivalTime ? a.arrivalTime - b.arrivalTime : a.inputOrder - b.inputOrder
    );

    let currentTime = 0;
    const ganttChart = [];
    const results = [];

    while (waiting.length > 0) {
        const available = waiting.filter(p => p.arrivalTime <= currentTime);

        if (available.length === 0) {
            const next = waiting[0].arrivalTime;
            ganttChart.push({ id: 'Idle', startTime: currentTime, endTime: next });
            currentTime = next;
            continue;
        }

        available.sort((a, b) => {
            if (a.burstTime !== b.burstTime) return a.burstTime - b.burstTime;
            if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
            return a.inputOrder - b.inputOrder;
        });

        const sel = available[0];
        waiting.splice(waiting.findIndex(p => p.inputOrder === sel.inputOrder), 1);

        const startTime = currentTime;
        const completionTime = startTime + sel.burstTime;
        const turnaroundTime = completionTime - sel.arrivalTime;
        const waitingTime = turnaroundTime - sel.burstTime;
        const responseTime = startTime - sel.arrivalTime;

        ganttChart.push({ id: sel.id, startTime, endTime: completionTime });
        results.push({
            id: sel.id, arrivalTime: sel.arrivalTime, burstTime: sel.burstTime,
            priority: sel.priority, startTime, completionTime, turnaroundTime, waitingTime, responseTime,
        });
        currentTime = completionTime;
    }

    return { algorithm: 'Shortest Job First (SJF)', ganttChart, results, metrics: computeMetrics(ganttChart, results) };
}

/* ── 3. Shortest Remaining Time First (Preemptive SJF) ────────── */
function simulateSRTF(processes) {
    const states = processes.map(p => ({ ...p, remainingTime: p.burstTime, startTime: null, completionTime: null }));

    let currentTime = 0;
    let completed = 0;
    const ganttChart = [];

    while (completed < states.length) {
        const available = states.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);

        if (available.length === 0) {
            const next = Math.min(...states.filter(p => p.remainingTime > 0).map(p => p.arrivalTime));
            addGanttBlock(ganttChart, 'Idle', currentTime, next);
            currentTime = next;
            continue;
        }

        available.sort((a, b) => {
            if (a.remainingTime !== b.remainingTime) return a.remainingTime - b.remainingTime;
            if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
            return a.inputOrder - b.inputOrder;
        });

        const sel = available[0];
        if (sel.startTime === null) sel.startTime = currentTime;

        addGanttBlock(ganttChart, sel.id, currentTime, currentTime + 1);
        sel.remainingTime -= 1;
        currentTime += 1;

        if (sel.remainingTime === 0) { sel.completionTime = currentTime; completed++; }
    }

    const results = states.map(p => ({
        id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime, priority: p.priority,
        startTime: p.startTime, completionTime: p.completionTime,
        turnaroundTime: p.completionTime - p.arrivalTime,
        waitingTime: (p.completionTime - p.arrivalTime) - p.burstTime,
        responseTime: p.startTime - p.arrivalTime,
    })).sort((a, b) => a.completionTime - b.completionTime);

    return { algorithm: 'Shortest Remaining Time First (SRTF)', ganttChart, results, metrics: computeMetrics(ganttChart, results) };
}

/* ── 4. Priority Scheduling (Non-Preemptive) ──────────────────── */
function simulatePriorityNP(processes) {
    const waiting = [...processes].sort((a, b) =>
        a.arrivalTime !== b.arrivalTime ? a.arrivalTime - b.arrivalTime : a.inputOrder - b.inputOrder
    );

    let currentTime = 0;
    const ganttChart = [];
    const results = [];

    while (waiting.length > 0) {
        const available = waiting.filter(p => p.arrivalTime <= currentTime);

        if (available.length === 0) {
            const next = waiting[0].arrivalTime;
            ganttChart.push({ id: 'Idle', startTime: currentTime, endTime: next });
            currentTime = next;
            continue;
        }

        available.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
            return a.inputOrder - b.inputOrder;
        });

        const sel = available[0];
        waiting.splice(waiting.findIndex(p => p.inputOrder === sel.inputOrder), 1);

        const startTime = currentTime;
        const completionTime = startTime + sel.burstTime;
        const turnaroundTime = completionTime - sel.arrivalTime;
        const waitingTime = turnaroundTime - sel.burstTime;
        const responseTime = startTime - sel.arrivalTime;

        ganttChart.push({ id: sel.id, startTime, endTime: completionTime });
        results.push({
            id: sel.id, arrivalTime: sel.arrivalTime, burstTime: sel.burstTime,
            priority: sel.priority, startTime, completionTime, turnaroundTime, waitingTime, responseTime,
        });
        currentTime = completionTime;
    }

    return { algorithm: 'Priority Scheduling (Non-Preemptive)', ganttChart, results, metrics: computeMetrics(ganttChart, results) };
}

/* ── 5. Priority Scheduling (Preemptive) ──────────────────────── */
function simulatePriorityP(processes) {
    const states = processes.map(p => ({ ...p, remainingTime: p.burstTime, startTime: null, completionTime: null }));

    let currentTime = 0;
    let completed = 0;
    const ganttChart = [];

    while (completed < states.length) {
        const available = states.filter(p => p.arrivalTime <= currentTime && p.remainingTime > 0);

        if (available.length === 0) {
            const next = Math.min(...states.filter(p => p.remainingTime > 0).map(p => p.arrivalTime));
            addGanttBlock(ganttChart, 'Idle', currentTime, next);
            currentTime = next;
            continue;
        }

        available.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            if (a.arrivalTime !== b.arrivalTime) return a.arrivalTime - b.arrivalTime;
            return a.inputOrder - b.inputOrder;
        });

        const sel = available[0];
        if (sel.startTime === null) sel.startTime = currentTime;

        addGanttBlock(ganttChart, sel.id, currentTime, currentTime + 1);
        sel.remainingTime -= 1;
        currentTime += 1;

        if (sel.remainingTime === 0) { sel.completionTime = currentTime; completed++; }
    }

    const results = states.map(p => ({
        id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime, priority: p.priority,
        startTime: p.startTime, completionTime: p.completionTime,
        turnaroundTime: p.completionTime - p.arrivalTime,
        waitingTime: (p.completionTime - p.arrivalTime) - p.burstTime,
        responseTime: p.startTime - p.arrivalTime,
    })).sort((a, b) => a.completionTime - b.completionTime);

    return { algorithm: 'Priority Scheduling (Preemptive)', ganttChart, results, metrics: computeMetrics(ganttChart, results) };
}

/* ── 6. Round Robin ───────────────────────────────────────────── */
function simulateRoundRobin(processes, timeQuantum) {
    const states = [...processes]
        .sort((a, b) => a.arrivalTime !== b.arrivalTime ? a.arrivalTime - b.arrivalTime : a.inputOrder - b.inputOrder)
        .map(p => ({ ...p, remainingTime: p.burstTime, startTime: null, completionTime: null }));

    let currentTime = 0;
    let nextIdx = 0;
    const readyQueue = [];
    const ganttChart = [];

    while (readyQueue.length > 0 || nextIdx < states.length) {
        while (nextIdx < states.length && states[nextIdx].arrivalTime <= currentTime) {
            readyQueue.push(states[nextIdx]);
            nextIdx++;
        }

        if (readyQueue.length === 0) {
            const next = states[nextIdx].arrivalTime;
            addGanttBlock(ganttChart, 'Idle', currentTime, next);
            currentTime = next;
            continue;
        }

        const sel = readyQueue.shift();
        if (sel.startTime === null) sel.startTime = currentTime;

        const runTime = Math.min(timeQuantum, sel.remainingTime);
        const endTime = currentTime + runTime;

        addGanttBlock(ganttChart, sel.id, currentTime, endTime);
        sel.remainingTime -= runTime;
        currentTime = endTime;

        while (nextIdx < states.length && states[nextIdx].arrivalTime <= currentTime) {
            readyQueue.push(states[nextIdx]);
            nextIdx++;
        }

        if (sel.remainingTime > 0) {
            readyQueue.push(sel);
        } else {
            sel.completionTime = currentTime;
        }
    }

    const results = states.map(p => ({
        id: p.id, arrivalTime: p.arrivalTime, burstTime: p.burstTime, priority: p.priority,
        startTime: p.startTime, completionTime: p.completionTime,
        turnaroundTime: p.completionTime - p.arrivalTime,
        waitingTime: (p.completionTime - p.arrivalTime) - p.burstTime,
        responseTime: p.startTime - p.arrivalTime,
    })).sort((a, b) => a.completionTime - b.completionTime);

    return {
        algorithm: `Round Robin (TQ = ${timeQuantum})`,
        ganttChart, results, metrics: computeMetrics(ganttChart, results),
    };
}
