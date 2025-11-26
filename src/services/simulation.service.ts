import { Injectable, inject } from '@angular/core';
import { ISimulationParams, ISimulationResult } from '../models/simulation-params.model';
import { PhysicsService } from './physics.service';
import { WritableSignal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SimulationService {
  private physicsService = inject(PhysicsService);

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public generateData(params: ISimulationParams, progress: WritableSignal<number>): Promise<ISimulationResult> {
    return new Promise((resolve) => {
        this.physicsService.updateParams(params);

        const { resolution, nFrames, frameDurationUs, cameraHeight, initialPos, initialVel, restitution } = params;
        const totalPixels = resolution.width * resolution.height;
        const dataset = new Uint16Array(nFrames * totalPixels).fill(8001);

        const fovRad = this.degreesToRadians(params.detectorFov);
        const fPixel = (resolution.width / 2) / Math.tan(fovRad / 2);
        const centerRow = resolution.height / 2;
        const centerCol = resolution.width / 2;

        let pos = { ...initialPos };
        let vel = { ...initialVel };
        const g = 9.8;
        const dt = frameDurationUs * 1e-6;

        let totalSignalPhotons = 0;
        const signalCoordinates: { row: number; col: number }[] = [];
        let currentFrame = 0;
        const CHUNK_SIZE = 5000; // Process frames in chunks to avoid blocking the UI thread

        const processSignalChunk = () => {
            const endFrame = Math.min(currentFrame + CHUNK_SIZE, nFrames);

            for (let frameIdx = currentFrame; frameIdx < endFrame; frameIdx++) {
                // Physics simulation for ball position
                pos.x += vel.x * dt;
                pos.y += vel.y * dt;
                pos.z += vel.z * dt;
                vel.y -= g * dt;

                if (pos.y <= 0) {
                    pos.y = 0;
                    vel.y = -vel.y * restitution;
                }

                // Photon detection simulation
                const distance = Math.sqrt(Math.pow(pos.x, 2) + Math.pow(pos.y - cameraHeight, 2) + Math.pow(pos.z, 2));
                const laserEnergy = params.laserPeakPower * 5e-10; // 0.5ns pulse width
                const expectedPhotons = this.physicsService.calculateReceivedPhotons(laserEnergy, distance);
                
                // Simplified Poisson check for single photon regime
                if (Math.random() < expectedPhotons) {
                    totalSignalPhotons++;

                    const row = Math.round(centerRow - fPixel * ((pos.y - cameraHeight) / pos.z));
                    const col = Math.round(centerCol + fPixel * (pos.x / pos.z));
                    const tofNs = (2 * distance / 3e8) * 1e9;
                    const tofUnits = Math.floor(tofNs / 0.256);

                    if (row >= 0 && row < resolution.height && col >= 0 && col < resolution.width && tofUnits > 0 && tofUnits < 8000) {
                        const index = frameIdx * totalPixels + row * resolution.width + col;
                        dataset[index] = tofUnits;
                        signalCoordinates.push({ row, col });
                    }
                }
            }

            currentFrame = endFrame;
            // Signal processing accounts for 95% of the progress bar
            progress.set(Math.round((currentFrame / nFrames) * 95));

            if (currentFrame < nFrames) {
                // Yield to the browser's event loop before processing the next chunk
                setTimeout(processSignalChunk, 0);
            } else {
                // Signal processing is done, start adding noise
                addNoiseAndFinalize();
            }
        };

        const addNoiseAndFinalize = () => {
            const noisePerFrame = this.physicsService.calculateBackgroundNoise(frameDurationUs);
            let totalNoiseEvents = Math.floor(noisePerFrame * nFrames);

            // CRITICAL FIX: Cap total noise events to prevent browser crash, mirroring the Python script's logic.
            if (totalNoiseEvents > 1000000) {
                console.warn(`High noise count (${totalNoiseEvents}) capped to 1,000,000 to maintain performance.`);
                totalNoiseEvents = 1000000;
            }

            for (let i = 0; i < totalNoiseEvents; i++) {
                const nFrame = Math.floor(Math.random() * nFrames);
                const nRow = Math.floor(Math.random() * resolution.height);
                const nCol = Math.floor(Math.random() * resolution.width);
                const nTof = Math.floor(Math.random() * 7999) + 1;
                const index = nFrame * totalPixels + nRow * resolution.width + nCol;
                // Only add noise to pixels that haven't detected a signal photon
                if (dataset[index] === 8001) {
                    dataset[index] = nTof;
                }
            }

            console.log(`Simulation complete. Signal photons: ${totalSignalPhotons}, Noise events: ${totalNoiseEvents}`);
            progress.set(100);
            resolve({ dataset, signalPhotons: totalSignalPhotons, noiseEvents: totalNoiseEvents, signalCoordinates });
        };

        // Start the simulation with a small delay to allow the UI to update to the "Simulating..." state first.
        setTimeout(processSignalChunk, 50);
    });
  }
}
