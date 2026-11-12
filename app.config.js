// Extends app.json. Google Sign-In's config plugin needs the iOS URL scheme (the reversed iOS client ID),
// so it is only added once EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set; without it the Google features stay hidden.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return config;
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
  return {
    ...config,
    plugins: [...config.plugins, ['@react-native-google-signin/google-signin', { iosUrlScheme }]],
  };
};
