/**
 * Smoke Tests
 * Critical flows that must pass before production deployment
 */

import { initializeAgent, processTask, Agent, Task } from './index';
import { standardLimiter, shareableLinkLimiter, authLimiter } from './rateLimiter';

describe('Smoke Tests', () => {
  describe('Agent Core', () => {
    it('should initialize agent with valid config', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      initializeAgent({
        name: 'smoke-test-agent',
        model: 'gpt-4',
        maxTokens: 2000,
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Initializing agent: smoke-test-agent'
      );
      expect(consoleSpy).toHaveBeenCalledWith('Model: gpt-4');
      
      consoleSpy.mockRestore();
    });

    it('should process valid task end-to-end', () => {
      const task: Task = {
        id: 'smoke-1',
        title: 'Verify portfolio sync',
        status: 'pending',
        priority: 'high',
      };

      const result = processTask(task);

      expect(result.id).toBe('smoke-1');
      expect(result.status).toBe('done');
      expect(result.title).toBe('Verify portfolio sync');
    });

    it('should reject task without title', () => {
      const invalidTask = {
        id: 'smoke-2',
        title: '',
        status: 'pending' as const,
        priority: 'medium' as const,
      };

      expect(() => processTask(invalidTask)).toThrow('Task title is required');
    });
  });

  describe('Agent Class', () => {
    it('should run agent with input', () => {
      const agent = new Agent({
        name: 'TestBot',
        model: 'claude-3',
        maxTokens: 1000,
      });

      const output = agent.run('test input');

      expect(output).toContain('[TestBot]');
      expect(output).toContain('test input');
    });
  });

  describe('Rate Limiters', () => {
    it('should have standard limiter configured', () => {
      expect(standardLimiter).toBeDefined();
      expect(typeof standardLimiter).toBe('function');
    });

    it('should have shareable link limiter configured', () => {
      expect(shareableLinkLimiter).toBeDefined();
      expect(typeof shareableLinkLimiter).toBe('function');
    });

    it('should have auth limiter configured', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('TypeScript Compilation', () => {
    it('should compile without errors', () => {
      // If this test runs, TypeScript compiled successfully
      expect(true).toBe(true);
    });
  });
});
