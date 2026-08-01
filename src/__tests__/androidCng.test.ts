import { readFileSync } from 'node:fs';
import path from 'node:path';

const appConfig = require('../../app.config.js').expo;
const { applyReleaseSigning } = require('../../plugins/with-android-release-signing');

describe('Android Continuous Native Generation', () => {
  it('keeps generated Android output out of source control and declares its native source of truth', () => {
    const gitignore = readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('android/');
    expect(appConfig.android.package).toBe('com.sportz.mobile');
    expect(appConfig.plugins).toContain('./plugins/with-android-release-signing');
  });

  it('replaces generated release debug signing with secure release properties', () => {
    const generatedTemplate = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;

    const result = applyReleaseSigning(generatedTemplate);
    const generatedReleaseBuildType = result.match(/buildTypes\s*\{[\s\S]*?release\s*\{([\s\S]*?)^[ \t]{8}\}/m)?.[1];

    expect(result).toContain("findProperty('SPORTZ_RELEASE_STORE_FILE')");
    expect(result).toContain('signingConfig signingConfigs.release');
    expect(generatedReleaseBuildType).toContain('signingConfig signingConfigs.release');
    expect(generatedReleaseBuildType).not.toContain('signingConfig signingConfigs.debug');
  });
});
