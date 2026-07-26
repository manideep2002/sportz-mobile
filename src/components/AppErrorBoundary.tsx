import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { colors, spacing } from '@/design/tokens';
import { captureUnexpectedError, createCorrelationId } from '@/lib/monitoring';

interface State {
  error: Error | null;
  recoveryKey: number;
}

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = {
    error: null,
    recoveryKey: 0
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureUnexpectedError(error, {
      operation: 'ui.error_boundary',
      correlationId: createCorrelationId('boundary'),
      extra: {
        componentStack: info.componentStack
      }
    });
  }

  private recover = () => {
    this.setState((state) => ({
      error: null,
      recoveryKey: state.recoveryKey + 1
    }));
  };

  render(): ReactNode {
    if (!this.state.error) {
      return <View key={this.state.recoveryKey} style={styles.content}>{this.props.children}</View>;
    }

    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={styles.fallback}
        testID="app-error-boundary"
      >
        <AppText accessibilityRole="header" variant="h1" style={styles.title}>
          Something went wrong
        </AppText>
        <AppText style={styles.message}>
          Your private information has not been included in the report. You can safely try again.
        </AppText>
        <Button accessibilityLabel="Try loading the app again" onPress={this.recover}>
          Try again
        </Button>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  content: {
    flex: 1
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.dark[950]
  },
  title: {
    color: colors.light[0],
    textAlign: 'center'
  },
  message: {
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 420
  }
});
