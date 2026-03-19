/**
 * Rate Limiter Tests
 * Verify rate limiter configurations are properly exported
 */

describe('Rate Limiters', () => {
  it('should export rate limiter factory functions', () => {
    // Just verify the module can be imported
    const rateLimiter = require('./rateLimiter');
    expect(rateLimiter.standardLimiter).toBeDefined();
    expect(rateLimiter.strictLimiter).toBeDefined();
    expect(rateLimiter.shareableLinkLimiter).toBeDefined();
    expect(rateLimiter.authLimiter).toBeDefined();
  });

  it('should have valid handler functions', () => {
    const { standardLimiter } = require('./rateLimiter');
    expect(typeof standardLimiter).toBe('function');
  });
});
