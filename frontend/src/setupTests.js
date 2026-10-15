// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Compatibility alias for existing tests written with Jest APIs
globalThis.jest = vi;
globalThis.jest.setTimeout = (ms) => vi.setConfig({ testTimeout: ms });
