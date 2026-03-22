import fs from 'node:fs';
import path from 'node:path';

export type DeployEnvironment = 'staging' | 'production';

export interface DeployRecord {
  environment: DeployEnvironment;
  deploymentId: string;
  deployedAt: string;
}

export interface DeployState {
  stabilityWindowMinutes: number;
  staging?: DeployRecord;
  production?: DeployRecord;
}

export interface StabilityWindowStatus {
  active: boolean;
  reason?: string;
  currentDeploy?: DeployRecord;
  windowEndsAt?: string;
  remainingMs?: number;
}

export const DEFAULT_STABILITY_WINDOW_MINUTES = 15;

function parseStabilityWindowMinutes(): number {
  const rawValue = process.env.STABILITY_WINDOW_MINUTES?.trim();
  const parsedValue = Number(rawValue);

  if (!rawValue) {
    return DEFAULT_STABILITY_WINDOW_MINUTES;
  }

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_STABILITY_WINDOW_MINUTES;
  }

  return parsedValue;
}

export function getDeployStateFilePath(): string {
  return process.env.DEPLOY_STATE_FILE?.trim() || path.join(process.cwd(), 'data', 'deploy-state.json');
}

function createDefaultState(): DeployState {
  return {
    stabilityWindowMinutes: parseStabilityWindowMinutes(),
  };
}

export function readDeployState(): DeployState {
  const stateFilePath = getDeployStateFilePath();

  if (!fs.existsSync(stateFilePath)) {
    return createDefaultState();
  }

  const rawState = fs.readFileSync(stateFilePath, 'utf8').trim();
  if (!rawState) {
    return createDefaultState();
  }

  const parsedState = JSON.parse(rawState) as Partial<DeployState>;

  return {
    ...createDefaultState(),
    ...parsedState,
    stabilityWindowMinutes: parseStabilityWindowMinutes(),
  };
}

export function writeDeployState(state: DeployState): void {
  const stateFilePath = getDeployStateFilePath();
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

export function recordDeploy(
  environment: DeployEnvironment,
  deploymentId: string,
  deployedAt: Date = new Date()
): DeployState {
  const state = readDeployState();
  const nextState: DeployState = {
    ...state,
    stabilityWindowMinutes: parseStabilityWindowMinutes(),
    [environment]: {
      environment,
      deploymentId,
      deployedAt: deployedAt.toISOString(),
    },
  };

  writeDeployState(nextState);
  return nextState;
}

export function getProductionStabilityWindowStatus(now: Date = new Date()): StabilityWindowStatus {
  const state = readDeployState();
  const productionDeploy = state.production;

  if (!productionDeploy) {
    return {
      active: false,
      reason: 'No production deploy has been recorded.',
    };
  }

  const deployedAtMs = new Date(productionDeploy.deployedAt).getTime();
  if (Number.isNaN(deployedAtMs)) {
    return {
      active: false,
      reason: 'Recorded production deploy timestamp is invalid.',
      currentDeploy: productionDeploy,
    };
  }

  const windowDurationMs = state.stabilityWindowMinutes * 60 * 1000;
  const remainingMs = deployedAtMs + windowDurationMs - now.getTime();

  if (remainingMs <= 0) {
    return {
      active: false,
      reason: 'Production deploy is outside the stability window.',
      currentDeploy: productionDeploy,
      windowEndsAt: new Date(deployedAtMs + windowDurationMs).toISOString(),
      remainingMs,
    };
  }

  return {
    active: true,
    currentDeploy: productionDeploy,
    windowEndsAt: new Date(deployedAtMs + windowDurationMs).toISOString(),
    remainingMs,
  };
}
