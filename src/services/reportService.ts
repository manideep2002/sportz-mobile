import { supabase } from '@/lib/supabase';
import { assertSupabaseConfigured } from '@/lib/supabaseOnly';

export type ReportEntityType = 'user' | 'post' | 'comment' | 'event' | 'community';

export const reportReasons = [
  'Spam',
  'Harassment',
  'Inappropriate content',
  'Fake profile',
  'Other'
] as const;

export const reportService = {
  async reportEntity(entityType: ReportEntityType, entityId: string, reason: string): Promise<void> {
    assertSupabaseConfigured();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error('You must be signed in to report content.');

    const { error } = await supabase.from('reports').insert({
      reporter_id: authData.user.id,
      entity_type: entityType,
      entity_id: entityId,
      reason
    });
    if (error) throw error;
  }
};

