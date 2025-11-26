
import { Injectable } from '@angular/core';
import { ISimulationParams } from '../models/simulation-params.model';

@Injectable({
  providedIn: 'root',
})
export class PhysicsService {
  // --- Physics Constants ---
  private readonly h = 6.626e-34; // Planck's constant
  private readonly c = 3e8; // Speed of light

  // --- System Parameters (from UI) ---
  private params!: ISimulationParams;

  public updateParams(params: ISimulationParams): void {
    this.params = params;
  }

  private getPhotonEnergy(): number {
    const wavelength = 780e-9; // 780nm, fixed for this simulation
    return (this.h * this.c) / wavelength;
  }

  public calculateBackgroundNoise(integrationTimeUs: number): number {
    if (!this.params) return 0;

    const { solarIrradiance, filterBandwidth, apertureDiameter, systemEfficiency, quantumEfficiency, darkCountRate } = this.params;
    
    // Simplified calculation from Python script
    const A_rx = Math.PI * (apertureDiameter / 2) ** 2;
    const P_bg_optical = (solarIrradiance * filterBandwidth) * A_rx * 1e-4; // Rough estimation coefficient

    const bg_photon_rate = (P_bg_optical / this.getPhotonEnergy()) * systemEfficiency * quantumEfficiency;

    const total_rate = bg_photon_rate + darkCountRate;
    const n_noise = total_rate * (integrationTimeUs * 1e-6);

    return n_noise;
  }

  public calculateReceivedPhotons(laserPulseEnergy: number, distanceM: number): number {
    if (distanceM <= 0 || !this.params) return 0;

    const { systemEfficiency, reflectivity, apertureDiameter, quantumEfficiency } = this.params;

    const E_ph = this.getPhotonEnergy();
    const A_rx = Math.PI * (apertureDiameter / 2) ** 2;

    const N_tx = laserPulseEnergy / E_ph;
    const solid_angle = A_rx / (distanceM ** 2);

    const N_rx = N_tx * systemEfficiency * (reflectivity / Math.PI) * solid_angle * quantumEfficiency;

    return N_rx;
  }

  public calculateSampledTrajectoryForPreview(params: ISimulationParams): {x: number; y: number; z: number}[] {
    const { nFrames, frameDurationUs, initialPos, initialVel, restitution } = params;
    const MAX_PREVIEW_POINTS = 30000;
    
    if (nFrames <= 0) return [];

    const sampledTrajectory: {x: number, y: number, z: number}[] = [];
    let pos = { ...initialPos };
    let vel = { ...initialVel };
    const g = 9.8;
    const dt = frameDurationUs * 1e-6;

    // Use a sampling step to avoid creating a massive array for the line visualization,
    // but still calculate the physics for every frame to get the correct final path.
    const step = nFrames > MAX_PREVIEW_POINTS ? Math.ceil(nFrames / MAX_PREVIEW_POINTS) : 1;

    for (let i = 0; i < nFrames; i++) {
        // This physics logic is the single source of truth for trajectory calculation.
        // It is identical to the one used in simulation.service.ts
        pos.x += vel.x * dt;
        pos.y += vel.y * dt;
        pos.z += vel.z * dt;
        vel.y -= g * dt;

        if (pos.y <= 0) {
            pos.y = 0;
            vel.y = -vel.y * restitution;
        }

        if (i % step === 0) {
            sampledTrajectory.push({ ...pos });
        }
    }
    
    // Ensure the very last point is always included for an accurate end position
    // This prevents the line from stopping short if nFrames isn't a multiple of step.
    sampledTrajectory.push({ ...pos });

    return sampledTrajectory;
  }
}
