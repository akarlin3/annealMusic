import '@testing-library/jest-dom/vitest';

class MemoryStorage implements Storage {
  private data: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.data).length;
  }

  clear(): void {
    this.data = {};
  }

  getItem(key: string): string | null {
    return key in this.data ? this.data[key]! : null;
  }

  key(index: number): string | null {
    return Object.keys(this.data)[index] || null;
  }

  removeItem(key: string): void {
    delete this.data[key];
  }

  setItem(key: string, value: string): void {
    this.data[key] = String(value);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [name: string]: any;
}

const mockLocalStorage = new MemoryStorage();
const mockSessionStorage = new MemoryStorage();

// Override globalThis to bypass Node.js 22+/25+ experimental localStorage issues
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
  configurable: true,
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });
}

// Mock Canvas context to suppress JSDOM prototype getContext warnings.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextId: string) {
    if (contextId === '2d') {
      const dummyCtx = {
        setTransform: () => {},
        fillRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        createRadialGradient: () => {
          return {
            addColorStop: () => {},
          };
        },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      };
      return dummyCtx as unknown as CanvasRenderingContext2D;
    }
    return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Mock HTMLMediaElement functions to avoid JSDOM warnings about media playback.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = async () => {};
  HTMLMediaElement.prototype.pause = () => {};
}
