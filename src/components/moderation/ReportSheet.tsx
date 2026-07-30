/**
 * ReportSheet
 *
 * A shared bottom-sheet component that handles the full report lifecycle:
 *   pending → success | duplicate | error
 *
 * It accepts any supported entity type and renders a reason-selection list.
 * All callers (PostDetailScreen, EventDetailScreen, GroupDetailScreen,
 * PageDetailScreen, PostOptionsSheet via onReport prop) use this component so
 * the UX is consistent across the app.
 */

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View
} from 'react-native';
import { CheckCircle, Flag } from 'lucide-react-native';
import NetInfo from '@react-native-community/netinfo';

import { AppText, BottomSheet, Button } from '@/components/ui';
import { useAppTheme } from '@/design/ThemeProvider';
import { colors, spacing, typography } from '@/design/tokens';
import {
  reportReasons,
  reportService,
  type ReportEntityType,
  type ReportReason
} from '@/services/reportService';

type SheetState = 'idle' | 'pending' | 'success' | 'duplicate' | 'error';

export interface ReportSheetProps {
  /** Whether the sheet is visible. */
  open: boolean;
  /** Human-readable label for the thing being reported, e.g. "post", "event". */
  entityLabel: string;
  entityType: ReportEntityType;
  entityId: string;
  onClose: () => void;
}

export function ReportSheet({
  open,
  entityLabel,
  entityType,
  entityId,
  onClose
}: ReportSheetProps) {
  const { colors: theme } = useAppTheme();
  const [state, setState] = useState<SheetState>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<ReportReason | null>(null);
  const submittingRef = useRef(false);

  const handleClose = () => {
    // Reset to idle so next open starts fresh
    setState('idle');
    setLastError(null);
    setLastReason(null);
    submittingRef.current = false;
    onClose();
  };

  const submitReport = async (reason: ReportReason) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState('pending');
    setLastError(null);
    setLastReason(reason);

    try {
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        React.startTransition(() => {
          setState('error');
          setLastError("You're offline. Please reconnect and try again.");
        });
        return;
      }

      const outcome = await reportService.reportEntity(entityType, entityId, reason);
      React.startTransition(() => {
        setState(outcome === 'duplicate' ? 'duplicate' : 'success');
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';

      if (
        message.toLowerCase().includes('sign') ||
        message.toLowerCase().includes('auth') ||
        message.toLowerCase().includes('permission')
      ) {
        // Permission / auth errors — show Alert rather than in-sheet error so
        // the user gets a clear prompt even if the sheet is dismissed.
        handleClose();
        Alert.alert('Permission denied', message);
        return;
      }

      React.startTransition(() => {
        setState('error');
        setLastError(message);
      });
    } finally {
      submittingRef.current = false;
    }
  };

  const renderContent = () => {
    if (state === 'pending') {
      return (
        <View style={styles.centred}>
          <ActivityIndicator color={theme.accent} />
          <AppText variant="bodyMuted">Submitting report…</AppText>
        </View>
      );
    }

    if (state === 'success') {
      return (
        <View style={styles.centred}>
          <CheckCircle size={44} color={theme.accent} />
          <AppText variant="h4" style={styles.feedbackTitle}>
            Report submitted
          </AppText>
          <AppText variant="bodyMuted" style={styles.feedbackBody}>
            Thank you. Our team will review this {entityLabel}.
          </AppText>
          <Button full onPress={handleClose}>
            Done
          </Button>
        </View>
      );
    }

    if (state === 'duplicate') {
      return (
        <View style={styles.centred}>
          <CheckCircle size={44} color={theme.textMuted} />
          <AppText variant="h4" style={styles.feedbackTitle}>
            Already reported
          </AppText>
          <AppText variant="bodyMuted" style={styles.feedbackBody}>
            You have already reported this {entityLabel}. We will review it shortly.
          </AppText>
          <Button full onPress={handleClose}>
            Done
          </Button>
        </View>
      );
    }

    if (state === 'error') {
      return (
        <View style={styles.centred}>
          <AppText variant="h4" style={[styles.feedbackTitle, { color: theme.danger }]}>
            Report failed
          </AppText>
          <AppText variant="bodyMuted" style={styles.feedbackBody}>
            {lastError ?? 'Something went wrong. Please try again.'}
          </AppText>
          <Button full onPress={() => lastReason ? void submitReport(lastReason) : setState('idle')}>
            Try Again
          </Button>
          <Button full variant="ghost" onPress={handleClose}>
            Cancel
          </Button>
        </View>
      );
    }

    // Idle — show reason selection list
    return (
      <View>
        <AppText variant="bodyMuted" style={styles.subtitle}>
          Why are you reporting this {entityLabel}?
        </AppText>
        {reportReasons.map((reason) => (
          <Pressable
            key={reason}
            accessibilityRole="button"
            accessibilityLabel={`Report for ${reason}`}
            style={[styles.reasonRow, { borderBottomColor: theme.border }]}
            onPress={() => void submitReport(reason)}
          >
            <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
              <Flag size={18} color={theme.accent} strokeWidth={2.1} />
            </View>
            <AppText style={[styles.reasonLabel, { color: theme.text }]}>{reason}</AppText>
          </Pressable>
        ))}
        <View style={styles.cancelRow}>
          <Button full variant="ghost" onPress={handleClose}>
            Cancel
          </Button>
        </View>
      </View>
    );
  };

  return (
    <BottomSheet
      open={open}
      title={`Report ${entityLabel}`}
      onClose={handleClose}
    >
      {renderContent()}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.dark[700]
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlays.orangeSoft
  },
  reasonLabel: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14,
    flex: 1
  },
  centred: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md
  },
  feedbackTitle: {
    textAlign: 'center'
  },
  feedbackBody: {
    textAlign: 'center',
    maxWidth: 280
  },
  cancelRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm
  }
});
