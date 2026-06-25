import { normalizeUsername, validateUsername } from '@/utils/authValidation';

describe('authValidation', () => {
  it('strips @ and invalid characters from usernames', () => {
    expect(normalizeUsername('@marcusk')).toBe('marcusk');
    expect(normalizeUsername('  @user.name!  ')).toBe('username');
  });

  it('accepts valid usernames', () => {
    validateUsername('marcusk');
    validateUsername('athlete_01');
  });

  it('rejects usernames that are too short', () => {
    let failed = false;
    try {
      validateUsername('ab');
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
  });
});
