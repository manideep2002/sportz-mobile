import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export const storageService = {
  async pickMedia() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.86,
      allowsEditing: false
    });

    if (result.canceled) return null;
    return result.assets[0];
  },

  async uploadMedia(uri: string, bucket: 'post-media' | 'story-media' | 'avatars' | 'event-covers', ownerId: string) {
    if (!env.isSupabaseConfigured) return uri;

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) throw new Error('Selected file no longer exists.');

    const extension = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${ownerId}/${Date.now()}.${extension}`;
    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage.from(bucket).upload(path, blob, {
      contentType: extension === 'mp4' ? 'video/mp4' : 'image/jpeg',
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};
