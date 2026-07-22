const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
}

export function validateUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Username must be 3–30 characters and use only letters, numbers, or underscores.');
  }
}
