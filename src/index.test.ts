import { initializeAgent, processTask, Agent } from '../src/index';

describe('Agent', () => {
  describe('initializeAgent', () => {
    it('should initialize with config', () => {
      expect(() => {
        initializeAgent({
          name: 'test-agent',
          model: 'minimax',
          maxTokens: 8192,
        });
      }).not.toThrow();
    });
  });

  describe('processTask', () => {
    it('should process a valid task', () => {
      const task = processTask({
        id: '1',
        title: 'Test task',
        status: 'pending',
        priority: 'medium',
      });

      expect(task.status).toBe('done');
    });

    it('should throw for empty title', () => {
      expect(() => {
        processTask({
          id: '1',
          title: '',
          status: 'pending',
          priority: 'low',
        });
      }).toThrow();
    });
  });

  describe('Agent class', () => {
    it('should run with input', () => {
      const agent = new Agent({
        name: 'test',
        model: 'minimax',
        maxTokens: 8192,
      });

      expect(agent.run('hello')).toBe('[test] Processed: hello');
    });
  });
});
