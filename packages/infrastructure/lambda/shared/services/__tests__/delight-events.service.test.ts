import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../logging/enhanced-logger', () => ({
  enhancedLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('DelightEventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('subscribe', () => {
    it('should allow subscribing to plan events', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should receive events after subscribing', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitMessage('plan-123', {
        message: null,
        selectedText: 'Test message',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message',
        planId: 'plan-123',
      }));

      unsubscribe();
    });

    it('should not receive events after unsubscribing', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      unsubscribe();

      delightEventsService.emitMessage('plan-123', {
        message: null,
        selectedText: 'Test message',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should receive history on subscribe', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      // Emit event before subscription
      delightEventsService.emitMessage('plan-history', {
        message: null,
        selectedText: 'Historical message',
      });

      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-history',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message',
        planId: 'plan-history',
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-history');
    });
  });

  describe('emitMessage', () => {
    it('should emit message event with correct structure', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-msg',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitMessage('plan-msg', {
        message: { id: 'msg-1', text: 'Hello', injectionPoint: 'pre_execution' },
        selectedText: 'Hello World',
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'message',
        planId: 'plan-msg',
        timestamp: expect.any(String),
        data: expect.objectContaining({
          type: 'message',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-msg');
    });

    it('should not emit if message is empty', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-empty',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitMessage('plan-empty', {
        message: null,
        selectedText: null,
      });

      expect(callback).not.toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('emitAchievement', () => {
    it('should emit achievement event', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-ach',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitAchievement('plan-ach', {
        id: 'ach-1',
        name: 'First Query',
        celebrationMessage: 'Congratulations!',
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'achievement',
        planId: 'plan-ach',
        data: expect.objectContaining({
          type: 'achievement',
          achievementId: 'ach-1',
          name: 'First Query',
          celebrationMessage: 'Congratulations!',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-ach');
    });
  });

  describe('emitEasterEgg', () => {
    it('should emit easter egg event', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-egg',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitEasterEgg('plan-egg', {
        id: 'egg-1',
        name: 'Secret Feature',
        activationMessage: 'You found it!',
      });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'easter_egg',
        planId: 'plan-egg',
        data: expect.objectContaining({
          type: 'easter_egg',
          easterEggId: 'egg-1',
          name: 'Secret Feature',
          activationMessage: 'You found it!',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-egg');
    });
  });

  describe('emitSound', () => {
    it('should emit sound event', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-sound',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitSound('plan-sound', 'confirm_chime');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'sound',
        planId: 'plan-sound',
        data: expect.objectContaining({
          type: 'sound',
          soundId: 'confirm_chime',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-sound');
    });
  });

  describe('emitStepUpdate', () => {
    it('should emit step update event', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-step',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitStepUpdate(
        'plan-step',
        'step-1',
        'analyze',
        'running',
        'Analyzing your request...'
      );

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'step_update',
        planId: 'plan-step',
        stepId: 'step-1',
        data: expect.objectContaining({
          type: 'step_update',
          stepId: 'step-1',
          stepType: 'analyze',
          status: 'running',
          message: 'Analyzing your request...',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-step');
    });
  });

  describe('emitPlanUpdate', () => {
    it('should emit plan update event', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-update',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitPlanUpdate('plan-update', 'completed', 'All done!');

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        type: 'plan_update',
        planId: 'plan-update',
        data: expect.objectContaining({
          type: 'plan_update',
          status: 'completed',
          message: 'All done!',
        }),
      }));

      unsubscribe();
      delightEventsService.clearHistory('plan-update');
    });
  });

  describe('emitWorkflowDelight', () => {
    it('should emit all components of workflow delight', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-workflow',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitWorkflowDelight('plan-workflow', {
        messages: [
          { message: null, selectedText: 'Message 1' },
          { message: null, selectedText: 'Message 2' },
        ],
        achievements: [
          { id: 'ach-1', name: 'First', celebrationMessage: 'Yay!' },
        ],
        soundEffect: 'confirm_chime',
      });

      // 2 messages + 1 achievement + 1 sound = 4 events
      expect(callback).toHaveBeenCalledTimes(4);

      unsubscribe();
      delightEventsService.clearHistory('plan-workflow');
    });

    it('should handle workflow delight without achievements or sound', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const callback = vi.fn();
      const unsubscribe = delightEventsService.subscribe({
        planId: 'plan-simple',
        userId: 'user-123',
        tenantId: 'tenant-456',
        callback,
      });

      delightEventsService.emitWorkflowDelight('plan-simple', {
        messages: [{ message: null, selectedText: 'Simple message' }],
      });

      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      delightEventsService.clearHistory('plan-simple');
    });
  });

  describe('getHistory', () => {
    it('should return event history for a plan', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      delightEventsService.emitMessage('plan-hist', { message: null, selectedText: 'Event 1' });
      delightEventsService.emitMessage('plan-hist', { message: null, selectedText: 'Event 2' });

      const history = delightEventsService.getHistory('plan-hist');

      expect(history.length).toBe(2);
      expect(history[0].type).toBe('message');
      expect(history[1].type).toBe('message');

      delightEventsService.clearHistory('plan-hist');
    });

    it('should return empty array for unknown plan', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const history = delightEventsService.getHistory('unknown-plan');

      expect(history).toEqual([]);
    });
  });

  describe('clearHistory', () => {
    it('should clear event history for a plan', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      delightEventsService.emitMessage('plan-clear', { message: null, selectedText: 'Event' });

      expect(delightEventsService.getHistory('plan-clear').length).toBe(1);

      delightEventsService.clearHistory('plan-clear');

      expect(delightEventsService.getHistory('plan-clear').length).toBe(0);
    });
  });

  describe('history size limit', () => {
    it('should trim history when exceeding MAX_HISTORY_SIZE', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      // Emit more than 50 events
      for (let i = 0; i < 60; i++) {
        delightEventsService.emitMessage('plan-limit', { message: null, selectedText: `Event ${i}` });
      }

      const history = delightEventsService.getHistory('plan-limit');

      expect(history.length).toBe(50);
      // First event should be trimmed, last event should be present
      expect(history[history.length - 1].data).toEqual(expect.objectContaining({
        message: expect.objectContaining({ selectedText: 'Event 59' }),
      }));

      delightEventsService.clearHistory('plan-limit');
    });
  });

  describe('error handling', () => {
    it('should handle callback errors gracefully', async () => {
      const { delightEventsService } = await import('../delight-events.service');
      
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      const unsub1 = delightEventsService.subscribe({
        planId: 'plan-error',
        userId: 'user-1',
        tenantId: 'tenant-1',
        callback: errorCallback,
      });
      const unsub2 = delightEventsService.subscribe({
        planId: 'plan-error',
        userId: 'user-2',
        tenantId: 'tenant-1',
        callback: successCallback,
      });

      // Should not throw
      delightEventsService.emitMessage('plan-error', { message: null, selectedText: 'Test' });

      // Both callbacks should have been called
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();

      unsub1();
      unsub2();
      delightEventsService.clearHistory('plan-error');
    });
  });
});

describe('createDelightEventStream', () => {
  it('should create a readable stream', async () => {
    const { createDelightEventStream } = await import('../delight-events.service');
    
    const { stream, close } = createDelightEventStream('plan-stream', 'user-123', 'tenant-456');

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(typeof close).toBe('function');

    close();
  });
});

describe('emitDelightForPlanExecution', () => {
  it('should emit step update with message', async () => {
    const { emitDelightForPlanExecution, delightEventsService } = await import('../delight-events.service');
    
    const callback = vi.fn();
    const unsubscribe = delightEventsService.subscribe({
      planId: 'plan-exec',
      userId: 'user-123',
      tenantId: 'tenant-456',
      callback,
    });

    await emitDelightForPlanExecution('plan-exec', 'step_start', {
      stepId: 'step-1',
      stepType: 'analyze',
      message: 'Starting analysis...',
    });

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      type: 'step_update',
    }));

    unsubscribe();
    delightEventsService.clearHistory('plan-exec');
  });

  it('should emit plan update without step info', async () => {
    const { emitDelightForPlanExecution, delightEventsService } = await import('../delight-events.service');
    
    const callback = vi.fn();
    const unsubscribe = delightEventsService.subscribe({
      planId: 'plan-exec2',
      userId: 'user-123',
      tenantId: 'tenant-456',
      callback,
    });

    await emitDelightForPlanExecution('plan-exec2', 'complete', {
      message: 'All done!',
    });

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      type: 'plan_update',
    }));

    unsubscribe();
    delightEventsService.clearHistory('plan-exec2');
  });

  it('should emit delight response if provided', async () => {
    const { emitDelightForPlanExecution, delightEventsService } = await import('../delight-events.service');
    
    const callback = vi.fn();
    const unsubscribe = delightEventsService.subscribe({
      planId: 'plan-exec3',
      userId: 'user-123',
      tenantId: 'tenant-456',
      callback,
    });

    await emitDelightForPlanExecution('plan-exec3', 'complete', {
      delight: {
        messages: [{ message: null, selectedText: 'Delight message' }],
        soundEffect: 'confirm_chime',
      },
    });

    // Should have 2 events: message + sound
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    delightEventsService.clearHistory('plan-exec3');
  });
});
