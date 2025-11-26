
export interface ISimulationParams {
  // Tennis Ball
  initialPos: { x: number; y: number; z: number };
  initialVel: { x: number; y: number; z: number };
  reflectivity: number;
  restitution: number;

  // Detector
  resolution: { width: number; height: number };
  detectorFov: number;
  frameDurationUs: number;
  quantumEfficiency: number;
  apertureDiameter: number;
  systemEfficiency: number;
  filterBandwidth: number;
  darkCountRate: number;

  // Environment & Laser
  solarIrradiance: number;
  laserPeakPower: number;

  // Simulation
  nFrames: number;

  // Fixed params
  cameraHeight: number;
}

export interface ISimulationResult {
  dataset: Uint16Array;
  signalPhotons: number;
  noiseEvents: number;
  signalCoordinates: { row: number; col: number }[];
}
