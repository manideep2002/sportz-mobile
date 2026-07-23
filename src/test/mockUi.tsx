import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export function AppText({ children, ...props }: PropsWithChildren<Record<string, any>>) {
  return <Text {...props}>{children}</Text>;
}

export function Button({ children, disabled, loading, onPress, ...props }: PropsWithChildren<Record<string, any>>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={Boolean(disabled || loading)}
      onPress={onPress}
      {...props}
    >
      <Text>{children}</Text>
    </Pressable>
  );
}

export function Chip({ children, selected, onPress }: PropsWithChildren<{ selected?: boolean; onPress?: () => void }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }} onPress={onPress}>
      <Text>{children}</Text>
    </Pressable>
  );
}

export function IconButton({ accessibilityLabel, disabled, onPress }: Record<string, any>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={Boolean(disabled)}
      onPress={onPress}
    />
  );
}

export function Input({ label, ...props }: Record<string, any>) {
  return <TextInput accessibilityLabel={label} {...props} />;
}

export function Screen({ children }: PropsWithChildren<Record<string, any>>) {
  return <View>{children}</View>;
}

export function Card({ children }: PropsWithChildren<Record<string, any>>) {
  return <View>{children}</View>;
}

export function Avatar() {
  return <View />;
}

export function Badge({ children }: PropsWithChildren<Record<string, any>>) {
  return <Text>{children}</Text>;
}

export function ProgressBar() {
  return <View />;
}

export function VideoPlayer({ testID }: Record<string, any>) {
  return <View testID={testID ?? 'video-player'} />;
}

export function VerifiedName({ profile }: Record<string, any>) {
  return <Text>{profile.displayName}</Text>;
}

export function AppRefreshControl() {
  return null;
}

export function SegmentedControl({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (value: any) => void }) {
  return (
    <View>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: option === value }}
          key={option}
          onPress={() => onChange(option)}
        >
          <Text>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BottomSheet({ children, open, title }: { children: ReactNode; open: boolean; title?: string }) {
  if (!open) return null;
  return (
    <View>
      {title ? <Text>{title}</Text> : null}
      {children}
    </View>
  );
}

export function StatCard() {
  return <View />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View>
      <Text>{title}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
