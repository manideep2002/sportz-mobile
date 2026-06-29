import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/routes';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

