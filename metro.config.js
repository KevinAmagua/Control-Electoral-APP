const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const enhanceMiddleware = config.server.enhanceMiddleware;

config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware, server) => {
  const enhancedMiddleware = enhanceMiddleware(middleware, server);

  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    enhancedMiddleware(req, res, next);
  };
};

module.exports = config;
