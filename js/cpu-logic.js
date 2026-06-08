const fs = require("fs");
const readline = require("readline");

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
      priority: process.priority,
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

function simulateSJF(processes) {
  const waitingProcesses = [...processes].sort((first, second) => {
    if (first.arrivalTime !== second.arrivalTime) {
      return first.arrivalTime - second.arrivalTime;
    }

    return first.id.localeCompare(second.id);
  });

  let currentTime = 0;
  const ganttChart = [];
  const results = [];

  while (waitingProcesses.length > 0) {
    const availableProcesses = waitingProcesses.filter((process) => process.arrivalTime <= currentTime);

    if (availableProcesses.length === 0) {
      const nextArrivalTime = waitingProcesses[0].arrivalTime;

      ganttChart.push({
        id: "Idle",
        startTime: currentTime,
        endTime: nextArrivalTime,
      });

      currentTime = nextArrivalTime;
      continue;
    }

    availableProcesses.sort((first, second) => {
      if (first.burstTime !== second.burstTime) {
        return first.burstTime - second.burstTime;
      }

      if (first.arrivalTime !== second.arrivalTime) {
        return first.arrivalTime - second.arrivalTime;
      }

      return first.id.localeCompare(second.id);
    });

    const selectedProcess = availableProcesses[0];
    const selectedIndex = waitingProcesses.findIndex((process) => process.id === selectedProcess.id);
    waitingProcesses.splice(selectedIndex, 1);

    const startTime = currentTime;
    const completionTime = startTime + selectedProcess.burstTime;
    const turnaroundTime = completionTime - selectedProcess.arrivalTime;
    const waitingTime = turnaroundTime - selectedProcess.burstTime;
    const responseTime = startTime - selectedProcess.arrivalTime;

    ganttChart.push({
      id: selectedProcess.id,
      startTime,
      endTime: completionTime,
    });

    results.push({
      id: selectedProcess.id,
      arrivalTime: selectedProcess.arrivalTime,
      burstTime: selectedProcess.burstTime,
      priority: selectedProcess.priority,
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
    algorithm: "Shortest Job First",
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

function simulatePreemptiveSJF(processes) {
  const processStates = processes.map((process) => ({
    ...process,
    remainingTime: process.burstTime,
    startTime: null,
    completionTime: null,
  }));

  let currentTime = 0;
  let completedCount = 0;
  const ganttChart = [];

  while (completedCount < processStates.length) {
    const availableProcesses = processStates.filter((process) => process.arrivalTime <= currentTime && process.remainingTime > 0);

    if (availableProcesses.length === 0) {
      const nextArrivalTime = Math.min(
        ...processStates
          .filter((process) => process.remainingTime > 0)
          .map((process) => process.arrivalTime),
      );

      addGanttBlock(ganttChart, "Idle", currentTime, nextArrivalTime);
      currentTime = nextArrivalTime;
      continue;
    }

    availableProcesses.sort((first, second) => {
      if (first.remainingTime !== second.remainingTime) {
        return first.remainingTime - second.remainingTime;
      }

      if (first.arrivalTime !== second.arrivalTime) {
        return first.arrivalTime - second.arrivalTime;
      }

      return first.id.localeCompare(second.id);
    });

    const selectedProcess = availableProcesses[0];

    if (selectedProcess.startTime === null) {
      selectedProcess.startTime = currentTime;
    }

    addGanttBlock(ganttChart, selectedProcess.id, currentTime, currentTime + 1);
    selectedProcess.remainingTime -= 1;
    currentTime += 1;

    if (selectedProcess.remainingTime === 0) {
      selectedProcess.completionTime = currentTime;
      completedCount += 1;
    }
  }

  const results = processStates
    .map((process) => {
      const turnaroundTime = process.completionTime - process.arrivalTime;
      const waitingTime = turnaroundTime - process.burstTime;
      const responseTime = process.startTime - process.arrivalTime;

      return {
        id: process.id,
        arrivalTime: process.arrivalTime,
        burstTime: process.burstTime,
        priority: process.priority,
        startTime: process.startTime,
        completionTime: process.completionTime,
        turnaroundTime,
        waitingTime,
        responseTime,
      };
    })
    .sort((first, second) => first.completionTime - second.completionTime);

  const totalWaitingTime = results.reduce((sum, process) => sum + process.waitingTime, 0);
  const totalTurnaroundTime = results.reduce((sum, process) => sum + process.turnaroundTime, 0);
  const totalResponseTime = results.reduce((sum, process) => sum + process.responseTime, 0);
  const totalBurstTime = results.reduce((sum, process) => sum + process.burstTime, 0);
  const firstStartTime = ganttChart.length > 0 ? ganttChart[0].startTime : 0;
  const finalCompletionTime = results.length > 0 ? Math.max(...results.map((process) => process.completionTime)) : 0;
  const totalTime = finalCompletionTime - firstStartTime;

  return {
    algorithm: "Shortest Job First - Preemptive",
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

function simulateNonPreemptivePriority(processes) {
  const waitingProcesses = [...processes].sort((first, second) => {
    if (first.arrivalTime !== second.arrivalTime) {
      return first.arrivalTime - second.arrivalTime;
    }

    return first.id.localeCompare(second.id);
  });

  let currentTime = 0;
  const ganttChart = [];
  const results = [];

  while (waitingProcesses.length > 0) {
    const availableProcesses = waitingProcesses.filter((process) => process.arrivalTime <= currentTime);

    if (availableProcesses.length === 0) {
      const nextArrivalTime = waitingProcesses[0].arrivalTime;

      ganttChart.push({
        id: "Idle",
        startTime: currentTime,
        endTime: nextArrivalTime,
      });

      currentTime = nextArrivalTime;
      continue;
    }

    availableProcesses.sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority;
      }

      if (first.arrivalTime !== second.arrivalTime) {
        return first.arrivalTime - second.arrivalTime;
      }

      return first.id.localeCompare(second.id);
    });

    const selectedProcess = availableProcesses[0];
    const selectedIndex = waitingProcesses.findIndex((process) => process.id === selectedProcess.id);
    waitingProcesses.splice(selectedIndex, 1);

    const startTime = currentTime;
    const completionTime = startTime + selectedProcess.burstTime;
    const turnaroundTime = completionTime - selectedProcess.arrivalTime;
    const waitingTime = turnaroundTime - selectedProcess.burstTime;
    const responseTime = startTime - selectedProcess.arrivalTime;

    ganttChart.push({
      id: selectedProcess.id,
      startTime,
      endTime: completionTime,
    });

    results.push({
      id: selectedProcess.id,
      arrivalTime: selectedProcess.arrivalTime,
      burstTime: selectedProcess.burstTime,
      priority: selectedProcess.priority,
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
    algorithm: "Priority Scheduling - Non-preemptive",
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

function addGanttBlock(ganttChart, id, startTime, endTime) {
  const lastBlock = ganttChart[ganttChart.length - 1];

  if (lastBlock && lastBlock.id === id && lastBlock.endTime === startTime) {
    lastBlock.endTime = endTime;
    return;
  }

  ganttChart.push({
    id,
    startTime,
    endTime,
  });
}

function createInputReader() {
  if (process.stdin.isTTY) {
    const terminal = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return {
      ask(question) {
        return new Promise((resolve) => {
          terminal.question(question, resolve);
        });
      },
      close() {
        terminal.close();
      },
    };
  }

  const answers = fs.readFileSync(0, "utf8").split(/\r?\n/);
  let answerIndex = 0;

  return {
    ask(question) {
      console.log(question);
      const answer = answers[answerIndex] || "";
      answerIndex += 1;
      return Promise.resolve(answer);
    },
    close() {},
  };
}

function ask(question, input) {
  return new Promise((resolve) => {
    resolve(input.ask(question));
  });
}

async function askForPositiveInteger(question, input, allowZero) {
  while (true) {
    const answer = await ask(question, input);
    const value = Number(answer);

    if (Number.isInteger(value) && (allowZero ? value >= 0 : value > 0)) {
      return value;
    }

    console.log(allowZero ? "Please enter a whole number of 0 or greater." : "Please enter a whole number greater than 0.");
  }
}

async function askForProcesses() {
  const input = createInputReader();
  const processes = [];

  console.log("CPU Scheduling Simulation");
  console.log("");

  const processCount = await askForPositiveInteger("How many processes do you want to enter? ", input, false);

  for (let index = 0; index < processCount; index += 1) {
    console.log("");
    console.log(`Process ${index + 1}`);

    let id = "";
    while (id.trim() === "") {
      id = await ask("Process ID: ", input);
      id = id.trim();

      if (id === "") {
        console.log("Process ID cannot be empty.");
      }
    }

    const arrivalTime = await askForPositiveInteger("Arrival time: ", input, true);
    const burstTime = await askForPositiveInteger("Burst time: ", input, false);
    const priority = await askForPositiveInteger("Priority: ", input, false);

    processes.push({
      id,
      arrivalTime,
      burstTime,
      priority,
    });
  }

  return {
    input,
    processes,
  };
}

async function askForAlgorithm(input) {
  console.log("");
  console.log("Choose a CPU scheduling algorithm:");
  console.log("1. FCFS - First-Come, First-Served");
  console.log("2. SJF - Shortest Job First");
  console.log("3. Priority Scheduling - Non-preemptive");

  while (true) {
    const choice = await ask("Enter algorithm choice: ", input);
    const normalizedChoice = choice.trim().toLowerCase();

    if (normalizedChoice === "1" || normalizedChoice === "fcfs") {
      return "FCFS";
    }

    if (normalizedChoice === "2" || normalizedChoice === "sjf") {
      return "SJF";
    }

    if (normalizedChoice === "3" || normalizedChoice === "priority") {
      return "PRIORITY";
    }

    console.log("Enter 1 or FCFS, 2 or SJF, or 3 or Priority.");
  }
}

async function askForSJFMode(input) {
  console.log("");
  console.log("Choose SJF mode:");
  console.log("1. Non-preemptive SJF");
  console.log("2. Preemptive SJF / Shortest Remaining Time First");

  while (true) {
    const choice = await ask("Enter SJF mode: ", input);
    const normalizedChoice = choice.trim().toLowerCase();

    if (normalizedChoice === "1" || normalizedChoice === "non-preemptive" || normalizedChoice === "nonpreemptive") {
      return "NON_PREEMPTIVE";
    }

    if (normalizedChoice === "2" || normalizedChoice === "preemptive" || normalizedChoice === "srtf") {
      return "PREEMPTIVE";
    }

    console.log("Enter 1 for non-preemptive SJF, or 2 for preemptive SJF.");
  }
}

function printSimulation(simulation) {
  console.log("");
  console.log(`Algorithm Used: ${simulation.algorithm}`);
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
}

async function main() {
  const session = await askForProcesses();
  const algorithm = await askForAlgorithm(session.input);
  let sjfMode = null;

  if (algorithm === "SJF") {
    sjfMode = await askForSJFMode(session.input);
  }

  session.input.close();

  let simulation = null;

  if (algorithm === "FCFS") {
    simulation = simulateFCFS(session.processes);
  } else if (algorithm === "PRIORITY") {
    simulation = simulateNonPreemptivePriority(session.processes);
  } else if (sjfMode === "PREEMPTIVE") {
    simulation = simulatePreemptiveSJF(session.processes);
  } else {
    simulation = simulateSJF(session.processes);
  }

  printSimulation(simulation);
}

main();
