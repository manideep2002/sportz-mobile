import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render } from '@testing-library/react-native';

import { LEGAL_DOCUMENT_VERSIONS } from '@/constants/legalDocuments';
import { LegalDocumentScreen } from '@/screens/legal/LegalDocumentScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';
import { SplashScreen } from '@/screens/auth/SplashScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@/components/ui', () => require('@/test/mockUi'));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate })
}));
jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      profile: { sports: ['Cricket'], isAdmin: false },
      signOut: jest.fn()
    })
}));

describe('legal document navigation and accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens both legal documents from the signed-out splash agreement', async () => {
    const navigation = { navigate: mockNavigate };
    const view = await render(<SplashScreen navigation={navigation as never} route={{} as never} />);

    const terms = view.getByRole('link', { name: 'Read Terms of Service' });
    const privacy = view.getByRole('link', { name: 'Read Privacy Policy' });
    expect(terms).toHaveStyle({ minHeight: 44 });
    expect(privacy).toHaveStyle({ minHeight: 44 });

    await fireEvent.press(terms);
    await fireEvent.press(privacy);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, 'TermsOfService');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, 'PrivacyPolicy');
  });

  it('opens both legal documents from Settings', async () => {
    const view = await render(<SettingsScreen />);

    await fireEvent.press(view.getByRole('button', { name: /Terms of Service/ }));
    await fireEvent.press(view.getByRole('button', { name: /Privacy Policy/ }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, 'TermsOfService');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, 'PrivacyPolicy');
  });

  it('renders a versioned, readable document and an accessible back control', async () => {
    const view = await render(<LegalDocumentScreen kind="privacy" onBack={mockGoBack} />);

    expect(view.getByRole('header', { name: 'Privacy Policy' })).toBeTruthy();
    expect(view.getByText(`Version ${LEGAL_DOCUMENT_VERSIONS.privacy}`)).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Back from Privacy Policy' }));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('legal consent migration', () => {
  const migration = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20260728000001_legal_consents.sql'),
    'utf8'
  );

  it('keeps consent immutable to clients and readable only by its owner', () => {
    expect(migration).toMatch(/alter table public\.legal_consents enable row level security/i);
    expect(migration).toMatch(/using \(auth\.uid\(\) = user_id\)/i);
    expect(migration).toMatch(/revoke insert, update, delete[\s\S]+from anon, authenticated/i);
    expect(migration).toMatch(/after insert on auth\.users/i);
  });

  it('server-validates the exact versions shipped by the app', () => {
    expect(migration).toContain(`accepted_terms_version constant text := '${LEGAL_DOCUMENT_VERSIONS.terms}'`);
    expect(migration).toContain(`accepted_privacy_version constant text := '${LEGAL_DOCUMENT_VERSIONS.privacy}'`);
  });
});
