import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const fallbackGenerator = path.resolve(process.cwd(), 'scripts/generate-link-fallback.mjs');
const destinationValidator = path.resolve(process.cwd(), 'scripts/validate-product-destinations.mjs');
const productionDestinations = {
  EXPO_PUBLIC_SUPPORT_EMAIL: 'support@company.example',
  EXPO_PUBLIC_APP_STORE_URL: 'https://apps.apple.com/app/id123456789',
  EXPO_PUBLIC_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.company.sportz',
  EXPO_PUBLIC_INSTALL_FALLBACK_URL: 'https://sportz.app/install'
};

describe('product destination release configuration', () => {
  it('validates production destinations and generates a matching fallback page', () => {
    const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sportz-fallback-'));
    const outputFile = path.join(outputDirectory, 'link-fallback.html');
    const env = { ...process.env, ...productionDestinations, LINK_FALLBACK_OUTPUT_FILE: outputFile };
    try {
      execFileSync(process.execPath, [destinationValidator], { cwd: process.cwd(), env });
      execFileSync(process.execPath, [fallbackGenerator], { cwd: process.cwd(), env });

      const generated = fs.readFileSync(outputFile, 'utf8');
      expect(generated).toContain(productionDestinations.EXPO_PUBLIC_APP_STORE_URL);
      expect(generated).toContain(productionDestinations.EXPO_PUBLIC_PLAY_STORE_URL);
      expect(generated).toContain(`mailto:${productionDestinations.EXPO_PUBLIC_SUPPORT_EMAIL}`);
    } finally {
      fs.rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('fails closed when the release configuration is incomplete or unsafe', () => {
    expect(() => execFileSync(process.execPath, [destinationValidator], {
      cwd: process.cwd(),
      env: { ...process.env, EXPO_PUBLIC_SUPPORT_EMAIL: '', EXPO_PUBLIC_SUPPORT_URL: '' },
      stdio: 'pipe'
    })).toThrow('Set EXPO_PUBLIC_SUPPORT_EMAIL or EXPO_PUBLIC_SUPPORT_URL');

    expect(() => execFileSync(process.execPath, [fallbackGenerator], {
      cwd: process.cwd(),
      env: { ...process.env, EXPO_PUBLIC_APP_STORE_URL: 'http://unsafe.example', EXPO_PUBLIC_PLAY_STORE_URL: '' },
      stdio: 'pipe'
    })).toThrow('EXPO_PUBLIC_APP_STORE_URL must be an HTTPS URL');
  });
});
