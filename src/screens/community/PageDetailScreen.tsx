import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MoreHorizontal, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PostCard } from '@/components/feed/PostCard';
import { AppText, Badge, Button, IconButton, Screen } from '@/components/ui';
import { communities, posts } from '@/data/mockData';
import { colors, spacing } from '@/design/tokens';
import type { AppStackParamList } from '@/navigation/routes';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type Route = RouteProp<AppStackParamList, 'PageDetail'>;

export function PageDetailScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const community = communities.find((item) => item.id === route.params.communityId) ?? communities[2];

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <IconButton icon={MoreHorizontal} />
      </View>
      <LinearGradient colors={['#1A0800', colors.orange[600], '#1A0800']} style={styles.cover}>
        <AppText variant="h1" color={colors.light[0]}>BASA</AppText>
      </LinearGradient>
      <View style={styles.body}>
        <AppText variant="h2">{community.name}</AppText>
        <AppText variant="bodyMuted">Official Academy Page - Est. 2018</AppText>
        <View style={styles.badges}>
          <Badge tone="blue">Verified</Badge>
          <Badge>Training</Badge>
          <Badge>{community.followerCount} followers</Badge>
        </View>
        <AppText variant="bodyMuted">{community.description}</AppText>
        <View style={styles.actions}>
          <Button variant="dark" style={styles.actionButton}>Following</Button>
          <Button style={styles.actionButton}>Message</Button>
          <IconButton icon={Share2} />
        </View>
        <AppText variant="h4">Latest Posts</AppText>
      </View>
      <PostCard post={posts[2]} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screen,
    gap: spacing.sm,
    zIndex: 2
  },
  cover: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -52
  },
  body: {
    padding: spacing.screen,
    gap: spacing.sm
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center'
  },
  actionButton: {
    flex: 1
  }
});
