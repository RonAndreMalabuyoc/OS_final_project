# OS Simulator Project Documentation

GitHub Repository: https://github.com/RonAndreMalabuyoc/OS_final_project  
Deployed Program: [Insert deployed program link here]

## Project Overview

OS Simulator is an interactive web-based learning tool for visualizing core operating system concepts. The project is built as a static front-end application using HTML, CSS, and JavaScript, with separate modules for CPU scheduling, memory management, virtual memory, and mass storage scheduling.

The program is designed for students and instructors who want to test operating system algorithms, compare their behavior, and understand the results through visual timelines, charts, tables, and performance metrics.

## Main Features

- Interactive simulations for major operating system topics.
- Dedicated pages for CPU scheduling, memory management, virtual memory, and mass storage.
- Editable user inputs for processes, jobs, page references, disk tracks, and algorithm settings.
- Visual outputs such as Gantt charts, memory maps, frame traces, disk seek paths, and animated canvas graphics.
- Performance dashboards that summarize each simulation.
- Built-in example data for quickly demonstrating each module.
- Light and dark theme support stored in the browser.
- macOS-inspired navigation bar with persistent module links.
- Responsive browser-based interface that runs without a backend server.

## CPU Scheduling Simulator

The CPU Scheduling module lets users define processes and compare common CPU scheduling algorithms.

### Supported Algorithms

- First-Come, First-Served (FCFS)
- Shortest Job First (SJF)
- Shortest Remaining Time First (SRTF)
- Priority Scheduling, Non-Preemptive
- Priority Scheduling, Preemptive
- Round Robin with configurable time quantum

### Capabilities

- Add, edit, remove, or clear process rows.
- Configure process ID, arrival time, burst time, and priority.
- Load sample process data.
- Run the selected scheduling algorithm.
- Show CPU idle periods when no process is available.
- Render a color-coded Gantt chart.
- Display per-process results including start time, completion time, turnaround time, waiting time, and response time.
- Calculate performance metrics such as average waiting time, average turnaround time, average response time, CPU utilization, and throughput.

## Memory Management Simulator

The Memory Management module simulates MVT-style contiguous memory allocation and shows how jobs are placed into memory.

### Supported Allocation Algorithms

- First Fit
- Next Fit
- Best Fit
- Worst Fit

### Capabilities

- Configure total memory and operating system reserved memory.
- Choose whether OS memory is included in the visual memory map.
- Enable or disable memory compaction.
- Add, edit, remove, or clear jobs.
- Configure job ID, job size, arrival order, and duration.
- Load sample job data.
- Run a timeline-based memory allocation simulation.
- View a simulation log describing allocation, completion, rejection, hole splitting, and compaction events.
- Step through memory map snapshots using previous and next controls.
- Display allocated jobs, OS memory, and free holes in a visual memory bar.
- Show the free space list and queue states.
- Display per-job results and memory performance metrics, including completed jobs, rejected jobs, memory usage, free space, largest hole, and external fragmentation.

## Virtual Memory Simulator

The Virtual Memory module demonstrates page replacement algorithms using a configurable reference string and frame count.

### Supported Page Replacement Algorithms

- FIFO
- Optimal
- LRU
- Additional Reference Bits (ARB)
- Clock / Second-Chance
- Enhanced Clock
- LFU
- MFU

### Capabilities

- Build a page reference string using an on-screen numeric input tray.
- Delete individual page references or clear the full reference string.
- Configure the number of page frames.
- Configure memory access time and page fault service time.
- Load example reference strings.
- Run page replacement simulations.
- Display a frame-by-frame trace of memory state after each page reference.
- Mark each access as a page hit or page fault.
- Show victim pages when replacement occurs.
- Display a step-by-step results table.
- Calculate page faults, page hits, fault rate, hit rate, and effective access time.

## Mass Storage Simulator

The Mass Storage module visualizes disk scheduling behavior and seek time calculations.

### Supported Disk Scheduling Algorithms

- FCFS
- SSTF
- SCAN
- C-SCAN
- LOOK
- C-LOOK

### Capabilities

- Configure total disk tracks.
- Configure the initial disk head position.
- Choose the initial head direction for directional algorithms.
- Add and remove disk request track numbers.
- Load sample request queues.
- Run the selected disk scheduling algorithm.
- Animate the disk head movement path on a canvas.
- Display the exact service order.
- Show step-by-step head movement calculations.
- Calculate total seek distance, average seek distance per request, and number of requests served.
- Compare all supported disk scheduling algorithms by total seek distance.

## Shared Interface Capabilities

- Global navigation between simulator modules.
- Theme toggle with saved user preference.
- Scroll progress indicator on module pages.
- Back-to-top button for long simulator pages.
- Custom cursor effects and hover states.
- Animated page headers and visual backgrounds.
- Consistent controls, tables, metric cards, and output sections across modules.

## Technology Stack

- HTML5 for page structure.
- CSS3 for layout, themes, animations, and responsive styling.
- JavaScript for simulation logic, rendering, event handling, and metrics.
- Canvas API for animated visualizations such as page backgrounds and disk seek paths.
- Browser localStorage for saving the selected theme.

## Project Structure

```text
OS_final_project/
├── index.html
├── styles.css
├── assets/
│   └── icon and interface images
├── js/
│   ├── cpu.js
│   ├── cursor.js
│   ├── memory.js
│   ├── storage.js
│   └── virtual.js
└── pages/
    ├── cpu.html
    ├── memory.html
    ├── storage.html
    └── virtual.html
```

## How to Use the Program

1. Open `index.html` in a web browser.
2. Choose a module from the navigation menu.
3. Select the algorithm to simulate.
4. Enter custom input values or load the built-in example data.
5. Run the simulation.
6. Review the visual output, result tables, and performance metrics.

Because this is a static web project, it can be deployed through platforms such as GitHub Pages, Netlify, Vercel, or any static hosting service.

## Educational Value

This project helps users understand operating system algorithms by turning abstract calculations into visible step-by-step simulations. Instead of only seeing final answers, users can observe how algorithm decisions change timelines, memory layouts, page fault behavior, and disk head movement.
