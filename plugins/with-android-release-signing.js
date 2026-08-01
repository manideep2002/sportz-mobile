const { withAppBuildGradle } = require('@expo/config-plugins');

const releaseSigningConfig = `
        release {
            // Credentials are injected only by the local secure Gradle properties file or EAS.
            // A release build without them fails instead of falling back to the debug keystore.
            def releaseStoreFile = findProperty('SPORTZ_RELEASE_STORE_FILE')
            if (releaseStoreFile) {
                storeFile file(releaseStoreFile)
                storePassword findProperty('SPORTZ_RELEASE_STORE_PASSWORD')
                keyAlias findProperty('SPORTZ_RELEASE_KEY_ALIAS')
                keyPassword findProperty('SPORTZ_RELEASE_KEY_PASSWORD')
            }
        }`;

function applyReleaseSigning(contents) {
  const releaseWithSecureSigning = contents.replace(
    /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );

  if (releaseWithSecureSigning === contents) {
    throw new Error('Unable to replace the generated Android release debug signing configuration.');
  }

  const signingConfigBoundary = /(signingConfigs\s*\{[\s\S]*?)(^[ \t]{4}\})(\r?\n[ \t]{4}buildTypes\s*\{)/m;
  if (!signingConfigBoundary.test(releaseWithSecureSigning)) {
    throw new Error('Unable to add the generated Android release signing configuration.');
  }

  return releaseWithSecureSigning.replace(signingConfigBoundary, `$1${releaseSigningConfig}\n$2$3`);
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (androidConfig) => {
    if (androidConfig.modResults.language !== 'groovy') {
      throw new Error('with-android-release-signing supports the generated Groovy app/build.gradle only.');
    }
    androidConfig.modResults.contents = applyReleaseSigning(androidConfig.modResults.contents);
    return androidConfig;
  });
};

module.exports.applyReleaseSigning = applyReleaseSigning;
