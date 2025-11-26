
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal, computed, effect, WritableSignal, inject } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ISimulationParams, ISimulationResult } from '../../models/simulation-params.model';
import { SimulationService } from '../../services/simulation.service';
import { PhysicsService } from '../../services/physics.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-simulation-view',
  standalone: true,
  templateUrl: './simulation-view.component.html',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationViewComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: true })
  private rendererCanvas!: ElementRef<HTMLCanvasElement>;
  
  @ViewChild('canvasContainer', { static: true })
  private canvasContainer!: ElementRef<HTMLElement>;
  
  @ViewChild('photonCountingCanvas')
  private photonCountingCanvas?: ElementRef<HTMLCanvasElement>;

  @ViewChild('groundTruthCanvas')
  private groundTruthCanvas?: ElementRef<HTMLCanvasElement>;

  // --- Services ---
  private simulationService = inject(SimulationService);
  private physicsService = inject(PhysicsService);

  // --- UI State ---
  isSimulating = signal(false);
  isPreviewing = signal(false);
  simulationProgress = signal(0);
  simulationResult = signal<ISimulationResult | null>(null);
  showResultsModal = signal(false);

  // Accordion state
  ballSettingsOpen = signal(true);
  detectorSettingsOpen = signal(false);
  envSettingsOpen = signal(false);
  simSettingsOpen = signal(false);

  // --- Simulation Parameters ---
  // Ball
  initialPosX = signal(-1.0);
  initialPosY = signal(2.0);
  initialPosZ = signal(1.5);
  initialVelX = signal(1.0);
  initialVelY = signal(0.0);
  initialVelZ = signal(1.0);
  reflectivity = signal(0.01);
  restitution = signal(0.8);

  // Detector
  resolutionW = signal(32);
  resolutionH = signal(32);
  detectorFov = signal(50);
  frameDurationUs = signal(55);
  quantumEfficiency = signal(0.3);
  apertureDiameter = signal(0.025);
  systemEfficiency = signal(0.6);
  filterBandwidth = signal(10);
  darkCountRate = signal(100);

  // Environment & Laser
  solarIrradiance = signal(0.01);
  laserPeakPower = signal(0.01);

  // Simulation
  nFrames = signal(100000);
  
  // Combine all params into a computed signal
  simulationParams = computed<ISimulationParams>(() => ({
    initialPos: { x: this.initialPosX(), y: this.initialPosY(), z: this.initialPosZ() },
    initialVel: { x: this.initialVelX(), y: this.initialVelY(), z: this.initialVelZ() },
    reflectivity: this.reflectivity(),
    restitution: this.restitution(),
    resolution: { width: this.resolutionW(), height: this.resolutionH() },
    detectorFov: this.detectorFov(),
    frameDurationUs: this.frameDurationUs(),
    quantumEfficiency: this.quantumEfficiency(),
    apertureDiameter: this.apertureDiameter(),
    systemEfficiency: this.systemEfficiency(),
    filterBandwidth: this.filterBandwidth(),
    darkCountRate: this.darkCountRate(),
    solarIrradiance: this.solarIrradiance(),
    laserPeakPower: this.laserPeakPower(),
    nFrames: this.nFrames(),
    cameraHeight: 1.0,
  }));

  // --- 3D Scene ---
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private ball!: THREE.Mesh;
  private sun!: THREE.DirectionalLight;
  private frameId: number | null = null;
  private resizeObserver!: ResizeObserver;

  // --- Animation State ---
  private simulationTrajectory: {x: number, y: number, z: number}[] = [];
  private trajectoryLine: THREE.Line | null = null;
  private animationStartTime = 0;

  constructor() {
    effect(() => {
        const irradiance = this.solarIrradiance();
        if(this.sun) {
            this.sun.intensity = irradiance * 100;
        }
    });

    // Effect to reset the trajectory preview when key physics parameters change
    effect(() => {
        // Depend on parameters that affect the trajectory
        this.initialPosX(); this.initialPosY(); this.initialPosZ();
        this.initialVelX(); this.initialVelY(); this.initialVelZ();
        this.restitution(); this.frameDurationUs(); this.nFrames();

        // If not actively previewing, clear the old visual state
        if (!this.isPreviewing()) {
            this.clearTrajectoryLine();
        }
    });
  }

  ngAfterViewInit(): void {
    this.initThreeJs();
    this.setupResizeObserver();
    this.startRenderingLoop();
  }

  ngOnDestroy(): void {
    if (this.frameId != null) {
      cancelAnimationFrame(this.frameId);
    }
    this.resizeObserver.disconnect();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.onResize();
    });
    this.resizeObserver.observe(this.canvasContainer.nativeElement);
  }

  private onResize = () => {
    const { clientWidth, clientHeight } = this.canvasContainer.nativeElement;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
  }

  onNumberInput(signal: WritableSignal<number>, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    signal.set(parseFloat(value));
  }
  
  previewTrajectory() {
    this.clearTrajectoryLine();
    this.isPreviewing.set(true);
    this.animationStartTime = performance.now();
    
    const params = this.simulationParams();
    // Calculate the full trajectory (downsampled for performance) using the centralized physics service
    this.simulationTrajectory = this.physicsService.calculateSampledTrajectoryForPreview(params);

    const points = this.simulationTrajectory.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
    this.trajectoryLine = new THREE.Line(geometry, material);
    this.scene.add(this.trajectoryLine);
  }

  runSimulation() {
    this.clearTrajectoryLine();
    this.isPreviewing.set(false);
    this.isSimulating.set(true);
    this.simulationProgress.set(0);
    this.simulationResult.set(null);

    const params = this.simulationParams();

    this.simulationService.generateData(params, this.simulationProgress)
      .then(result => {
        this.simulationResult.set(result);
        this.isSimulating.set(false);
        this.showResultsModal.set(true);
        // Defer drawing to allow the view to update and canvases to become available
        setTimeout(() => this.drawResultImages(), 0);
      });
  }
  
  downloadData() {
    const data = this.simulationResult()?.dataset;
    if (!data) return;

    const blob = new Blob([data.buffer], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tennis_tof_physics.bin';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
  
  private clearTrajectoryLine() {
    if (this.trajectoryLine) {
        this.scene.remove(this.trajectoryLine);
        this.trajectoryLine.geometry.dispose();
        (this.trajectoryLine.material as THREE.Material).dispose();
        this.trajectoryLine = null;
    }
  }

  private initThreeJs() {
    const { clientWidth, clientHeight } = this.canvasContainer.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827); // gray-900

    this.camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.rendererCanvas.nativeElement, antialias: true });
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;

    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, side: THREE.DoubleSide });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const ballGeo = new THREE.SphereGeometry(0.05, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xDFFF00 });
    this.ball = new THREE.Mesh(ballGeo, ballMat);
    this.ball.position.set(this.initialPosX(), this.initialPosY(), this.initialPosZ());
    this.scene.add(this.ball);

    const detectorGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
    const detectorMat = new THREE.MeshStandardMaterial({ color: 0x9CA3AF });
    const detector = new THREE.Mesh(detectorGeo, detectorMat);
    detector.position.set(0, 1, 0); // Corrected detector position as per text
    this.scene.add(detector);

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.scene.add(ambientLight);
    
    this.sun = new THREE.DirectionalLight(0xffffff, this.solarIrradiance() * 100);
    this.sun.position.set(5, 10, 7.5);
    this.scene.add(this.sun);
  }

  private startRenderingLoop() {
    const render = () => {
      this.frameId = requestAnimationFrame(render);
      this.controls.update();

      if (this.isPreviewing()) {
        if (this.simulationTrajectory.length > 0) {
            const params = this.simulationParams();
            const totalSimulatedSeconds = params.nFrames * params.frameDurationUs * 1e-6;
            const elapsedTimeSeconds = (performance.now() - this.animationStartTime) / 1000;
            const progress = elapsedTimeSeconds / totalSimulatedSeconds;

            if (progress >= 1) {
                // Animation finished
                const finalPos = this.simulationTrajectory[this.simulationTrajectory.length - 1];
                if (finalPos) this.ball.position.set(finalPos.x, finalPos.y, finalPos.z);
                this.isPreviewing.set(false);
            } else {
                // Animation in progress
                const currentIndex = Math.floor(progress * (this.simulationTrajectory.length - 1));
                const pos = this.simulationTrajectory[currentIndex];
                if (pos) this.ball.position.set(pos.x, pos.y, pos.z);
            }
        }
      } else {
        // If no trajectory line is visible, sync ball with UI inputs.
        // If a line is visible, it means a preview just finished, so we leave the ball at the end position.
        if (!this.trajectoryLine) {
            this.ball.position.set(this.initialPosX(), this.initialPosY(), this.initialPosZ());
        }
      }
      
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }
  
  private drawResultImages(): void {
    const result = this.simulationResult();
    const pcCanvas = this.photonCountingCanvas?.nativeElement;
    const gtCanvas = this.groundTruthCanvas?.nativeElement;

    if (!result || !pcCanvas || !gtCanvas) {
      return;
    }

    const { resolution } = this.simulationParams();
    const { width, height } = resolution;
    const totalPixels = width * height;

    // 1. Calculate Photon Counting data
    const photonCounts: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    for (let i = 0; i < result.dataset.length; i++) {
        if (result.dataset[i] < 8000) {
            const pixelIndexInFrame = i % totalPixels;
            const row = Math.floor(pixelIndexInFrame / width);
            const col = pixelIndexInFrame % width;
            photonCounts[row][col]++;
        }
    }
    
    // 2. Calculate Ground Truth data
    const groundTruthCounts: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
    for(const coord of result.signalCoordinates) {
        groundTruthCounts[coord.row][coord.col]++;
    }

    // 3. Draw heatmaps
    this.drawHeatmap(pcCanvas, photonCounts);
    this.drawHeatmap(gtCanvas, groundTruthCounts);
  }
  
  private jet(value: number): [number, number, number] {
    // value is normalized between 0 and 1
    const r = Math.min(Math.max(0, 1.5 - Math.abs(1 - 4 * (value - 0.5))), 1);
    const g = Math.min(Math.max(0, 1.5 - Math.abs(1 - 4 * (value - 0.25))), 1);
    const b = Math.min(Math.max(0, 1.5 - Math.abs(1 - 4 * value)), 1);
    return [r * 255, g * 255, b * 255];
  }

  private drawHeatmap(canvas: HTMLCanvasElement, data: number[][]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const height = data.length;
    if (height === 0) return;
    const width = data[0].length;
    
    canvas.width = width;
    canvas.height = height;

    let maxVal = 0;
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            if (data[r][c] > maxVal) {
                maxVal = data[r][c];
            }
        }
    }
    
    if (maxVal === 0) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        return;
    }

    const imageData = ctx.createImageData(width, height);
    for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
            const normalizedValue = data[r][c] / maxVal;
            const [red, green, blue] = this.jet(normalizedValue);
            const index = (r * width + c) * 4;
            imageData.data[index] = red;
            imageData.data[index + 1] = green;
            imageData.data[index + 2] = blue;
            imageData.data[index + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
  }
}
