import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, spacing, typography } from '@/design/tokens';

export interface StoryReactionOverlayRef {
  triggerReaction: (emoji: string) => void;
}

interface Particle {
  id: string;
  emoji: string;
  anim: Animated.Value;
  startX: number;
  endX: number;
  maxScale: number;
  rotation: string;
  duration: number;
  delay: number;
}

interface ToastState {
  id: number;
  emoji: string;
}

export const StoryReactionOverlay = forwardRef<StoryReactionOverlayRef, {}>((_, ref) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastAnim = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({
    triggerReaction: (emoji: string) => {
      // 1. Spawn floating emoji particles
      const now = Date.now();
      const particleCount = 8;
      const newParticles: Particle[] = [];

      for (let i = 0; i < particleCount; i++) {
        const anim = new Animated.Value(0);
        const startX = (Math.random() - 0.5) * 80;
        const endX = startX + (Math.random() - 0.5) * 120;
        const maxScale = 1.2 + Math.random() * 1.0;
        const rotationDeg = (Math.random() - 0.5) * 40;
        const duration = 1300 + Math.random() * 500;
        const delay = i * 45;

        newParticles.push({
          id: `${now}-${i}-${Math.random()}`,
          emoji,
          anim,
          startX,
          endX,
          maxScale,
          rotation: `${rotationDeg}deg`,
          duration,
          delay
        });
      }

      setParticles((prev) => [...prev, ...newParticles]);

      // Animate each particle
      newParticles.forEach((particle) => {
        Animated.sequence([
          Animated.delay(particle.delay),
          Animated.timing(particle.anim, {
            toValue: 1,
            duration: particle.duration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          })
        ]).start(() => {
          setParticles((prev) => prev.filter((p) => p.id !== particle.id));
        });
      });

      // 2. Trigger feedback Toast badge
      setToast({ id: now, emoji });
      toastAnim.setValue(0);
      Animated.sequence([
        Animated.spring(toastAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true
        }),
        Animated.delay(1200),
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => {
        setToast((current) => (current?.id === now ? null : current));
      });
    }
  }));

  const toastScale = toastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1]
  });

  const toastTranslateY = toastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0]
  });

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Floating particles */}
      {particles.map((p) => {
        const translateY = p.anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -420]
        });

        const translateX = p.anim.interpolate({
          inputRange: [0, 0.3, 0.7, 1],
          outputRange: [0, p.startX, p.endX, p.endX * 1.2]
        });

        const scale = p.anim.interpolate({
          inputRange: [0, 0.15, 0.75, 1],
          outputRange: [0.2, p.maxScale, p.maxScale * 0.9, 0.1]
        });

        const opacity = p.anim.interpolate({
          inputRange: [0, 0.1, 0.65, 1],
          outputRange: [0, 1, 0.85, 0]
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particleContainer,
              {
                opacity,
                transform: [
                  { translateY },
                  { translateX },
                  { scale },
                  { rotate: p.rotation }
                ]
              }
            ]}
          >
            <AppText style={styles.particleEmoji}>{p.emoji}</AppText>
          </Animated.View>
        );
      })}

      {/* Confirmation Toast */}
      {toast ? (
        <Animated.View
          style={[
            styles.toastBanner,
            {
              opacity: toastAnim,
              transform: [{ translateY: toastTranslateY }, { scale: toastScale }]
            }
          ]}
        >
          <AppText style={styles.toastText}>Reaction sent {toast.emoji}</AppText>
        </Animated.View>
      ) : null}
    </View>
  );
});

StoryReactionOverlay.displayName = 'StoryReactionOverlay';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 999,
    elevation: 999,
    paddingBottom: 110
  },
  particleContainer: {
    position: 'absolute',
    bottom: 120
  },
  particleEmoji: {
    fontSize: 32
  },
  toastBanner: {
    position: 'absolute',
    bottom: 110,
    backgroundColor: 'rgba(18, 18, 20, 0.88)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: colors.dark[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6
  },
  toastText: {
    color: colors.light[0],
    fontFamily: typography.bodyBold,
    fontSize: 13
  }
});
