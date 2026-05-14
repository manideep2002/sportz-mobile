import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BarChart3, ChevronLeft, Image, MapPin, Users, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Avatar, Button, Chip, IconButton } from '@/components/ui';
import { currentUser } from '@/data/mockData';
import { colors, radii, spacing, typography } from '@/design/tokens';
import { useCreatePost } from '@/hooks/useFeed';
import type { AppStackParamList } from '@/navigation/routes';
import { storageService } from '@/services/storageService';
import { useAuthStore } from '@/store/authStore';
import type { Sport } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

const sports: Sport[] = ['Basketball', 'Football', 'Tennis', 'Cricket'];

export function CreatePostScreen() {
  const navigation = useNavigation<Navigation>();
  const profile = useAuthStore((state) => state.profile) ?? currentUser;
  const [body, setBody] = useState('');
  const [sport, setSport] = useState<Sport>('Basketball');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const createPost = useCreatePost();

  const handlePickMedia = async () => {
    try {
      const media = await storageService.pickMedia();
      setMediaUri(media?.uri ?? null);
    } catch (error) {
      Alert.alert('Media picker failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handlePublish = async () => {
    if (!body.trim()) return;
    try {
      await createPost.mutateAsync({ body: body.trim(), sport, mediaUrl: mediaUri });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Could not publish', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">New Post</AppText>
        <Button size="sm" loading={createPost.isPending} onPress={handlePublish}>
          Publish
        </Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.author}>
          <Avatar initials={profile.initials} size={42} />
          <View style={styles.authorMeta}>
            <AppText style={styles.authorName}>{profile.displayName}</AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Public', 'Friends', 'Group'].map((item, index) => (
                <Chip key={item} selected={index === 0}>
                  {item}
                </Chip>
              ))}
            </ScrollView>
          </View>
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What is happening on the court?"
          placeholderTextColor={colors.text.tertiary}
          multiline
          style={styles.composer}
        />
        <View style={styles.mediaActions}>
          <ComposerAction icon={Image} label={mediaUri ? 'Media added' : 'Photo/Video'} onPress={handlePickMedia} />
          <ComposerAction icon={BarChart3} label="Stats" />
          <ComposerAction icon={MapPin} label="Location" />
        </View>
        <AppText style={styles.label}>Tag Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          {sports.map((item) => (
            <Chip key={item} selected={item === sport} onPress={() => setSport(item)}>
              {item}
            </Chip>
          ))}
        </ScrollView>
        <View style={styles.tagPeople}>
          <Users size={16} color={colors.text.tertiary} />
          <AppText style={styles.tagText}>Tag people...</AppText>
        </View>
      </ScrollView>
    </View>
  );
}

function ComposerAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.composerAction} onPress={onPress}>
      <Icon size={20} color={colors.text.tertiary} />
      <AppText variant="small">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark[950]
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  content: {
    padding: spacing.screen,
    paddingBottom: 40
  },
  author: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginBottom: 16
  },
  authorMeta: {
    flex: 1,
    gap: 6
  },
  authorName: {
    color: colors.text.primary,
    fontFamily: typography.bodyBold,
    fontSize: 14
  },
  composer: {
    minHeight: 140,
    borderRadius: radii.md,
    backgroundColor: colors.dark[800],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700],
    color: colors.text.primary,
    padding: spacing.md,
    fontFamily: typography.bodyFamily,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 14
  },
  mediaActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 14
  },
  composerAction: {
    flex: 1,
    height: 80,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[600],
    borderStyle: 'dashed',
    backgroundColor: colors.dark[800],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs
  },
  label: {
    color: colors.text.tertiary,
    fontFamily: typography.bodyBold,
    fontSize: 12,
    marginBottom: 8
  },
  chips: {
    marginBottom: 14
  },
  tagPeople: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.dark[800],
    borderRadius: radii.md,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.dark[700]
  },
  tagText: {
    color: colors.text.tertiary
  }
});
