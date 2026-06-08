function simulateFCFS(processes) {
  const sortedProcesses = [...processes].sort((first, second) => {
    if (first.arrivalTime !== second.arrivalTime) {
      return first.arrivalTime - second.arrivalTime;
    }

    return first.id.localeCompare(second.id);
  });

  let currentTime = 0;
  const ganttChart = [];
  const results = [];

  for (const process of sortedProcesses) {
    if (currentTime < process.arrivalTime) {
      ganttChart.push({
        id: "Idle",
        startTime: currentTime,
        endTime: process.arrivalTime,
      });

      currentTime = process.arrivalTime;
    }

    const startTime = currentTime;
    const completionTime = startTime + process.burstTime;
    const turnaroundTime = completionTime - process.arrivalTime;
    const waitingTime = turnaroundTime - process.burstTime;
    const responseTime = startTime - process.arrivalTime;

    ganttChart.push({
      id: process.id,
      startTime,
      endTime: completionTime,
    });

    results.push({
      id: process.id,
      arrivalTime: process.arrivalTime,
      burstTime: process.burstTime,
      startTime,
      completionTime,
      turnaroundTime,
      waitingTime,
      responseTime,
    });

    currentTime = completionTime;
  }

  const totalWaitingTime = results.reduce((sum, process) => sum + process.waitingTime, 0);
  const totalTurnaroundTime = results.reduce((sum, process) => sum + process.turnaroundTime, 0);
  const totalResponseTime = results.reduce((sum, process) => sum + process.responseTime, 0);
  const totalBurstTime = results.reduce((sum, process) => sum + process.burstTime, 0);
  const firstStartTime = ganttChart.length > 0 ? ganttChart[0].startTime : 0;
  const finalCompletionTime = results.length > 0 ? results[results.length - 1].completionTime : 0;
  const totalTime = finalCompletionTime - firstStartTime;

  return {
    algorithm: "First-Come, First-Served",
    ganttChart,
    results,
    metrics: {
      averageWaitingTime: results.length > 0 ? totalWaitingTime / results.length : 0,
      averageTurnaroundTime: results.length > 0 ? totalTurnaroundTime / results.length : 0,
      averageResponseTime: results.length > 0 ? totalResponseTime / results.length : 0,
      cpuUtilization: totalTime > 0 ? (totalBurstTime / totalTime) * 100 : 0,
      throughput: totalTime > 0 ? results.length / totalTime : 0,
    },
  };
}

const sampleProcesses = [
  { id: "P1", arrivalTime: 0, burstTime: 5 },
  { id: "P2", arrivalTime: 2, burstTime: 3 },
  { id: "P3", arrivalTime: 4, burstTime: 1 },
  { id: "P4", arrivalTime: 6, burstTime: 4 },
];

const simulation = simulateFCFS(sampleProcesses);

console.log("FCFS CPU Scheduling Simulation");
console.log("");
console.log("Gantt Chart:");
for (const block of simulation.ganttChart) {
  console.log(`${block.id}: ${block.startTime} -> ${block.endTime}`);
}

console.log("");
console.log("Process Results:");
console.table(simulation.results);

console.log("Metrics:");
console.table(simulation.metrics);
