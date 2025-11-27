# Dynamic Object Single-Photon LiDAR/SPAD Simulator

![Angular](https://img.shields.io/badge/Angular-18%2B-dd0031.svg?logo=angular&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.164-black.svg?logo=three.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6.svg?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**[English](./README_EN.md) | [中文](./README.md)**

> **Keywords**: SPAD, LiDAR, Single-Photon Imaging, Dynamic Object Tracking, Physics Simulation, Three.js, Angular

<img width="1854" height="1089" alt="Image" src="https://github.com/user-attachments/assets/1ba97fba-38cf-44fe-8b3f-a25ea9375792" />

<img width="737" height="526" alt="Image" src="https://github.com/user-attachments/assets/a3dc4560-20d8-4cc9-92ec-e3d264fee931" />

## 📖 Introduction

**Dynamic Object Single-Photon LiDAR/SPAD Simulator** is a high-fidelity, web-based physics simulation tool designed specifically to simulate the detection and tracking of high-speed moving objects (such as a bouncing tennis ball) using a **Single-Photon Avalanche Diode (SPAD)** array.

Unlike traditional geometry-based simulations, this project delves into the **photon-statistical level**. It combines classical ballistic physics with quantum detection theory to generate realistic raw data containing Shot Noise, Dark Counts, and Environmental Background Noise.

This tool is ideal for:
* Development and validation of **Depth Sensing** algorithms.
* Research on object tracking in **Low-SNR** environments.
* System-level evaluation of **SPAD sensor parameters** (e.g., PDE, DCR, Timing Resolution).

## ✨ Key Features

### 1. High-Precision Physics Engine
* **Ballistic Motion Physics**: Simulates projectile motion affected by gravity ($g$) and air resistance, supporting a custom **Coefficient of Restitution** to simulate realistic ground bouncing effects.
* **Photon Link Budget**: Calculates return photon counts based on the radar equation, considering laser peak power, target reflectivity ($0-1$), aperture diameter, and atmospheric attenuation.
* **Statistical Noise Model**:
    * **Signal Photons**: Photon arrival probability based on **Poisson Distribution**.
    * **Background Noise**: Calculates environmental photon rates based on **Solar Irradiance**, filter bandwidth, and Field of View (FOV).
    * **Detector Noise**: Integrated **Dark Count Rate (DCR)** simulation.

### 2. Interactive 3D Visualization
* **Real-time Preview**: Integrated **Three.js** engine provides 3D scene navigation. Supports **Trajectory Preview** of the target before simulation to intuitively adjust initial velocity and position.
* **Heatmap Visualization**: After simulation, provides a comparative display of the **Photon Counting Histogram** and the **Ground Truth Depth Map**.

### 3. Flexible Parameter Configuration
Supports fine-grained control over the experimental environment:
* **Detector**: Resolution (e.g., 32x32, 64x64), Quantum Efficiency (QE), System Efficiency, Timing Resolution.
* **Environment**: Solar Background Intensity ($W/m^2/nm$).
* **Target**: Initial Position $(x,y,z)$, Initial Velocity Vector, Reflectivity.

### 4. Pure Frontend High Performance Computing
* Utilizes **Angular Signals** for reactive state management.
* Uses a **Chunked Processing** strategy to execute intensive Monte Carlo simulation loops on the main thread without blocking the UI rendering.
* Supports one-click export of raw binary data (`.bin`).

## 🛠️ Tech Stack

* **Core Framework**: [Angular](https://angular.io/) (Standalone Components, Signals)
* **3D Rendering**: [Three.js](https://threejs.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Language**: TypeScript

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* npm

### Installation Steps

1.  Clone the repository:
    ```bash
    git clone [https://github.com/hansamar/spad-detector-simulator.git](https://github.com/hansamar/spad-detector-simulator.git)
    cd spad-detector-simulator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:4200` (or the port shown in your terminal).

## 📖 Usage Guide

1.  **Setup**:
    * Set the initial position (Pos) and velocity (Vel) of the tennis ball in the **"Tennis Ball Parameters"** panel on the left.
    * Click the **"Preview Trajectory"** button to confirm the blue trajectory line in the 3D view matches your expectations.

2.  **Detector Adjustment**:
    * Adjust the Resolution in **"Detector Parameters"** (32x32 or 64x64 is recommended for faster speed).
    * Set **Frame Duration** (e.g., 50μs) and **Quantum Efficiency** (QE).

3.  **Run Simulation**:
    * Click **"Run Simulation"**.
    * A progress bar will show the simulation status. The results modal will pop up automatically upon completion.

4.  **Analyze**:
    * Observe the **"Photon Counting"** heatmap, which represents the noisy image actually output by the simulated SPAD array.
    * Compare it with **"Ground Truth"** to understand the true position of the target.
    * Click **"Download Data"** to download the `.bin` file (Uint16Array format, containing ToF counts for all frames).

## 📐 Physics Model Details

This simulator is based on the following core equations:

1.  **Received Photons ($N_{rx}$)**:
    $$N_{rx} = \frac{E_{pulse}}{E_{ph}} \cdot \eta_{sys} \cdot \frac{\rho}{\pi} \cdot \frac{A_{rx}}{R^2} \cdot QE$$
    Where $R$ is the target distance, and $A_{rx}$ is the receiving aperture area.

2.  **Background Noise ($N_{bg}$)**:
    $$N_{bg} = \left( \frac{P_{solar} \cdot \Delta \lambda \cdot A_{rx}}{E_{ph}} \cdot \eta_{sys} \cdot QE + DCR \right) \cdot T_{int}$$
    Where $P_{solar}$ is solar irradiance, $DCR$ is the dark count rate, and $T_{int}$ is the integration time.
