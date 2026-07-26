import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockCaptureUnexpectedError = jest.fn();

jest.mock('@/lib/monitoring', () => ({
  captureUnexpectedError: (...args: unknown[]) => mockCaptureUnexpectedError(...args),
  createCorrelationId: () => 'boundary-test-id'
}));

import { AppErrorBoundary } from '@/components/AppErrorBoundary';

describe('AppErrorBoundary', () => {
  it('shows a recoverable screen and retries the child tree', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;

    function ControlledChild() {
      if (shouldThrow) throw new Error('Controlled boundary failure');
      return <Text>Recovered content</Text>;
    }

    const rendered = await render(
      <AppErrorBoundary>
        <ControlledChild />
      </AppErrorBoundary>
    );

    expect(rendered.getByTestId('app-error-boundary')).toHaveProp('accessibilityRole', 'alert');
    expect(rendered.getByText('Something went wrong')).toBeTruthy();
    expect(mockCaptureUnexpectedError).toHaveBeenCalledTimes(1);

    shouldThrow = false;
    await fireEvent.press(rendered.getByLabelText('Try loading the app again'));
    expect(rendered.getByText('Recovered content')).toBeTruthy();
    consoleSpy.mockRestore();
  });
});
