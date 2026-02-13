/* global global */
import "@testing-library/jest-dom";

// Mock ResizeObserver for Recharts compatibility
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};
