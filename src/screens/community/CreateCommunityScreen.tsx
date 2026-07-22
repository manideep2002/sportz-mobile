import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { AppText, Button, Chip, IconButton, Input } from '@/components/ui';
import { allSports } from '@/constants/sports';
import { colors, spacing } from '@/design/tokens';
import { useCreateCommunity } from '@/hooks/useCommunities';
import type { AppStackParamList } from '@/navigation/routes';
import type { Community } from '@/types/domain';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

export function CreateCommunityScreen() {
  const navigation = useNavigation<Navigation>();
  const createCommunity = useCreateCommunity();
  const [type, setType] = useState<Community['type']>('group');
  const [name, setName] = useState('');
  const [sport, setSport] = useState(allSports[0]);
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Add a name for your community.');
      return;
    }
    try {
      const community = await createCommunity.mutateAsync({ type, name, sport, city, description, isPrivate });
      navigation.replace(type === 'group' ? 'GroupDetail' : 'PageDetail', { communityId: community.id });
    } catch (error) {
      Alert.alert('Could not create community', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 10}
    >
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={() => navigation.goBack()} />
        <AppText variant="h3">New Community</AppText>
        <Button size="sm" loading={createCommunity.isPending} onPress={submit}>Create</Button>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText style={styles.label}>Type</AppText>
        <View style={styles.wrap}>
          {(['group', 'page'] as const).map((item) => (
            <Chip key={item} selected={type === item} onPress={() => setType(item)}>
              {item === 'group' ? 'Group' : 'Page'}
            </Chip>
          ))}
        </View>
        {type === 'group' ? (
          <>
            <AppText style={styles.label}>Visibility</AppText>
            <View style={styles.wrap}>
              <Chip selected={!isPrivate} onPress={() => setIsPrivate(false)}>Public</Chip>
              <Chip selected={isPrivate} onPress={() => setIsPrivate(true)}>Private</Chip>
            </View>
          </>
        ) : null}
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="City" value={city} onChangeText={setCity} />
        <AppText style={styles.label}>Sport</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {allSports.slice(0, 20).map((item) => (
            <Chip key={item} selected={sport === item} onPress={() => setSport(item)}>{item}</Chip>
          ))}
        </ScrollView>
        <Input label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        <Button full size="lg" loading={createCommunity.isPending} onPress={submit}>Create Community</Button>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  content: {
    padding: spacing.screen,
    gap: spacing.md,
    paddingBottom: 40
  },
  label: {
    color: colors.text.tertiary,
    fontWeight: '700',
    fontSize: 12
  },
  wrap: {
    flexDirection: 'row',
    gap: spacing.xs
  }
});

