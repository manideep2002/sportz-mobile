jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Tell React 19's concurrent mode that we are inside an act()-aware test
// environment so async state updates don't log spurious act() warnings.
global.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress the residual "not configured to support act" console.error that
// fires when state updates occur in resolved microtasks (e.g. after awaited
// service calls inside components). These are false-positive warnings — all
// assertions use waitFor() and the tests are correct. The warning originates
// from react-reconciler internals and does not indicate a test or code defect.
const _originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('not configured to support act')
  ) {
    return;
  }
  _originalConsoleError(...args);
};
