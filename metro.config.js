const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const tanstackLegacyBuilds = {
  '@tanstack/query-async-storage-persister': 'node_modules/@tanstack/query-async-storage-persister/build/legacy/index.cjs',
  '@tanstack/query-core': 'node_modules/@tanstack/query-core/build/legacy/index.cjs',
  '@tanstack/query-persist-client-core': 'node_modules/@tanstack/query-persist-client-core/build/legacy/index.cjs',
  '@tanstack/react-query': 'node_modules/@tanstack/react-query/build/legacy/index.cjs',
  '@tanstack/react-query-persist-client': 'node_modules/@tanstack/react-query-persist-client/build/legacy/index.cjs'
};

config.resolver.sourceExts = Array.from(new Set([...config.resolver.sourceExts, 'cjs', 'mjs']));
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const tanstackBuild = tanstackLegacyBuilds[moduleName];

  if (tanstackBuild) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, tanstackBuild)
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
