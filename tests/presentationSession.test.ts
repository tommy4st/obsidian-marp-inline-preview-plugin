import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PresentationSession } from '../src/presentation/session';

describe('PresentationSession', () => {
  const testPath = 'slides/test-deck.md';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    PresentationSession.get(testPath)?.destroy();
  });

  it('creates a session with initial values and allows retrieval', () => {
    const session = PresentationSession.getOrCreate(testPath, 5);
    expect(session).toBeDefined();
    expect(session.filePath).toBe(testPath);
    expect(session.currentSlide).toBe(0);
    expect(session.totalSlides).toBe(5);
    expect(session.isBlackout).toBe(false);
    expect(session.isWhiteout).toBe(false);
    expect(session.timer.isRunning).toBe(false);
    expect(session.timer.elapsedSeconds).toBe(0);

    // Re-getting returns the same instance
    const same = PresentationSession.getOrCreate(testPath, 5);
    expect(same).toBe(session);
    same.release();
    session.release();
  });

  it('navigates slides within bounds', () => {
    const session = PresentationSession.getOrCreate(testPath, 3);
    const slideEvents: number[] = [];
    session.on('slide-change', (idx) => slideEvents.push(idx));

    expect(session.prev()).toBe(false); // already at 0
    expect(session.currentSlide).toBe(0);

    expect(session.next()).toBe(true);
    expect(session.currentSlide).toBe(1);

    expect(session.next()).toBe(true);
    expect(session.currentSlide).toBe(2);

    expect(session.next()).toBe(false); // at last slide
    expect(session.currentSlide).toBe(2);

    expect(session.prev()).toBe(true);
    expect(session.currentSlide).toBe(1);

    session.last();
    expect(session.currentSlide).toBe(2);

    session.first();
    expect(session.currentSlide).toBe(0);

    // Clamping on direct goTo
    session.goTo(100);
    expect(session.currentSlide).toBe(2);

    session.goTo(-10);
    expect(session.currentSlide).toBe(0);

    expect(slideEvents).toEqual([1, 2, 1, 2, 0, 2, 0]);
    session.release();
  });

  it('toggles blackout and whiteout and clears on navigation', () => {
    const session = PresentationSession.getOrCreate(testPath, 3);
    const blankEvents: string[] = [];
    session.on('blank-change', (b) => blankEvents.push(b));

    session.toggleBlackout();
    expect(session.isBlackout).toBe(true);
    expect(session.isWhiteout).toBe(false);

    session.toggleWhiteout();
    expect(session.isBlackout).toBe(false);
    expect(session.isWhiteout).toBe(true);

    // Navigation clears whiteout/blackout
    session.next();
    expect(session.isBlackout).toBe(false);
    expect(session.isWhiteout).toBe(false);

    session.toggleBlackout();
    expect(session.isBlackout).toBe(true);
    session.clearBlank();
    expect(session.isBlackout).toBe(false);

    expect(blankEvents).toEqual(['black', 'white', 'none', 'black', 'none']);
    session.release();
  });

  it('controls the timer accurately', () => {
    const session = PresentationSession.getOrCreate(testPath, 3);
    const ticks: number[] = [];
    session.on('timer-tick', (t) => ticks.push(t.elapsedSeconds));

    session.startTimer();
    expect(session.timer.isRunning).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(session.timer.elapsedSeconds).toBe(3);

    session.pauseTimer();
    expect(session.timer.isRunning).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(session.timer.elapsedSeconds).toBe(3); // stays paused

    session.startTimer();
    vi.advanceTimersByTime(2000);
    expect(session.timer.elapsedSeconds).toBe(5);

    session.resetTimer();
    expect(session.timer.elapsedSeconds).toBe(0);

    session.release();
  });

  it('updates totalSlides dynamically when slides change', () => {
    const session = PresentationSession.getOrCreate(testPath, 5);
    session.goTo(4);
    expect(session.currentSlide).toBe(4);

    // Reduce deck size to 3 slides
    session.setTotalSlides(3);
    expect(session.totalSlides).toBe(3);
    expect(session.currentSlide).toBe(2); // auto-clamped to last slide

    session.release();
  });
});
