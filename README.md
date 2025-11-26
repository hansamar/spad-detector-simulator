# 动态目标单光子 LiDAR/SPAD 仿真器
(Dynamic Object Single-Photon LiDAR Simulator)

![Angular](https://img.shields.io/badge/Angular-18%2B-dd0031.svg?logo=angular&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.164-black.svg?logo=three.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6.svg?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg)

> **关键词**: SPAD, LiDAR, 单光子成像, 动态目标追踪, 物理仿真, Three.js, Angular

## 📖 项目简介 (Introduction)

**动态目标单光子 LiDAR/SPAD 仿真器** 是一个基于 Web 的高保真物理仿真工具，专门用于模拟 **单光子雪崩二极管 (SPAD)** 阵列对高速运动目标（如弹跳的网球）的探测与追踪过程。

与传统的基于几何的仿真不同，本项目深入到了**光子统计级 (Photon-statistical level)**。它结合了经典弹道物理学与量子探测理论，能够生成包含光子散粒噪声（Shot Noise）、暗计数（Dark Count）和环境背景光噪声的逼真原始数据。

该工具非常适合用于：
* **深度感知 (Depth Sensing)** 算法的开发与验证。
* **低信噪比 (Low-SNR)** 环境下的目标追踪研究。
* **SPAD 传感器参数**（如 PDE、DCR、时间分辨率）的系统级评估。

## ✨ 核心功能 (Key Features)

### 1. 高精度物理仿真引擎
* **弹道运动物理**: 模拟受重力 ($g$) 和空气阻力影响的抛体运动，支持自定义**恢复系数 (Restitution)** 来模拟真实的地面反弹效果。
* **光子链路预算 (Link Budget)**: 基于雷达方程计算回波光子数，考虑了激光峰值功率、目标反射率 ($0-1$)、孔径直径和大气衰减。
* **统计噪声模型**:
    * **信号光子**: 基于泊松分布 (Poisson Distribution) 的光子到达概率。
    * **背景噪声**: 根据太阳辐照度 (Solar Irradiance)、滤光片带宽和视场角计算环境光子率。
    * **探测器噪声**: 集成暗计数率 (Dark Count Rate, DCR) 模拟。

### 2. 交互式 3D 可视化
* **实时预览**: 集成 **Three.js** 引擎，提供 3D 场景漫游。支持在仿真前预览目标的**运动轨迹 (Trajectory Preview)**，直观调整初始速度和位置。
* **热力图可视化**: 仿真结束后，提供**光子计数直方图 (Photon Counting)** 与 **真值深度图 (Ground Truth)** 的对比展示。

### 3. 灵活的参数配置
支持对实验环境进行细粒度控制：
* **探测器**: 分辨率 (如 32x32, 64x64)、量子效率 (QE)、系统效率、时间分辨率。
* **环境**: 太阳背景光强度 ($W/m^2/nm$)。
* **目标**: 初始位置 $(x,y,z)$、初始速度向量、反射率。

### 4. 纯前端高性能计算
* 采用 **Angular Signals** 实现响应式状态管理。
* 使用 **分块计算 (Chunked Processing)** 策略，在主线程中执行密集的蒙特卡洛仿真循环而不阻塞 UI 渲染。
* 支持一键导出二进制原始数据 (`.bin`)。

## 🛠️ 技术栈 (Tech Stack)

* **核心框架**: [Angular](https://angular.io/) (Standalone Components, Signals)
* **3D 渲染**: [Three.js](https://threejs.org/)
* **样式库**: [Tailwind CSS](https://tailwindcss.com/)
* **语言**: TypeScript

## 🚀 快速开始 (Getting Started)

### 前置要求
* Node.js (推荐 v18+)
* npm

### 安装步骤

1.  克隆仓库：
    ```bash
    git clone [https://github.com/hansamar/spad-detector-simulator.git](https://github.com/hansamar/spad-detector-simulator.git)
    cd spad-detector-simulator
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  启动开发服务器：
    ```bash
    npm run dev
    ```

4.  打开浏览器访问 `http://localhost:4200` (或终端提示的端口)。

## 📖 使用指南 (Usage Guide)

1.  **场景配置 (Setup)**:
    * 在左侧面板的 **"Tennis Ball Parameters"** 中设置网球的初始位置 (Pos) 和速度 (Vel)。
    * 点击 **"Preview Trajectory"** (预览轨迹) 按钮，在 3D 视图中确认蓝色轨迹线是否符合预期。

2.  **传感器调整 (Detector)**:
    * 在 **"Detector Parameters"** 中调整分辨率 (建议 32x32 或 64x64 以获得更快的速度)。
    * 设置 **Frame Duration** (如 50μs) 和 **Quantum Efficiency** (量子效率)。

3.  **运行仿真 (Simulate)**:
    * 点击 **"Run Simulation"**。
    * 进度条会显示仿真进度。计算完成后，结果模态框将自动弹出。

4.  **数据分析 (Analyze)**:
    * 观察 **"Photon Counting"** 热力图，这是模拟 SPAD 阵列实际输出的含噪声图像。
    * 对比 **"Ground Truth"** 了解目标的真实位置。
    * 点击 **"Download Data"** 下载 `.bin` 文件（Uint16Array 格式，包含所有帧的 ToF 计数值）。

## 📐 物理模型细节 (Physics Model)

本仿真器基于以下核心方程：

1.  **接收光子数 ($N_{rx}$)**:
    $$N_{rx} = \frac{E_{pulse}}{E_{ph}} \cdot \eta_{sys} \cdot \frac{\rho}{\pi} \cdot \frac{A_{rx}}{R^2} \cdot QE$$
    其中 $R$ 为目标距离，$A_{rx}$ 为接收孔径面积。

2.  **背景噪声 ($N_{bg}$)**:
    $$N_{bg} = \left( \frac{P_{solar} \cdot \Delta \lambda \cdot A_{rx}}{E_{ph}} \cdot \eta_{sys} \cdot QE + DCR \right) \cdot T_{int}$$
    其中 $P_{solar}$ 为太阳辐照度，$DCR$ 为暗计数率，$T_{int}$ 为积分时间。

