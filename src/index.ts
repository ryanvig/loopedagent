/**
 * Looped Agent - Core Module
 * Main entry point for the autonomous agent system
 */

export interface AgentConfig {
  name: string;
  model: string;
  maxTokens: number;
}

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Initialize the agent with configuration
 */
export function initializeAgent(config: AgentConfig): void {
  console.log(`Initializing agent: ${config.name}`);
  console.log(`Model: ${config.model}`);
}

/**
 * Process a task
 */
export function processTask(task: Task): Task {
  if (!task.title) {
    throw new Error('Task title is required');
  }

  return {
    ...task,
    status: 'done',
  };
}

export class Agent {
  private config: AgentConfig;
  private name: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.name = config.name;
  }

  public run(input: string): string {
    return `[${this.name}] Processed: ${input}`;
  }
}
