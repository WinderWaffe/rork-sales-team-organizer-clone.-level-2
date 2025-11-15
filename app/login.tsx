import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, Sparkles } from 'lucide-react-native';

import { GOOGLE_CLIENT_CONFIG } from '../constants/auth';
import { useUser } from '../contexts/user-context';

WebBrowser.maybeCompleteAuthSession();

interface GoogleProfileResponse {
  email: string;
  name?: string;
  picture?: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, isAuthenticated, isLoading } = useUser();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const clientConfig = useMemo(() => GOOGLE_CLIENT_CONFIG, []);
  const requestConfig = useMemo(() => ({
    expoClientId: clientConfig.expo || undefined,
    iosClientId: clientConfig.ios || undefined,
    androidClientId: clientConfig.android || undefined,
    webClientId: clientConfig.web || undefined,
    scopes: ['openid', 'profile', 'email'],
  }), [clientConfig.android, clientConfig.expo, clientConfig.ios, clientConfig.web]);

  const [request, response, promptAsync] = Google.useAuthRequest(requestConfig);

  const rootSafeAreaStyle = useMemo(() => ({
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  }), [insets.bottom, insets.left, insets.right, insets.top]);

  const overlayStyle = useMemo(() => ({
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 24,
  }), []);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!response) {
      return;
    }
    if (response.type === 'success' && response.authentication?.accessToken) {
      const processProfile = async () => {
        try {
          const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
              Authorization: `Bearer ${response.authentication?.accessToken ?? ''}`,
            },
          });
          if (!profileResponse.ok) {
            throw new Error('Profile request failed');
          }
          const profile = await profileResponse.json() as GoogleProfileResponse;
          if (!profile.email) {
            throw new Error('Google account missing email');
          }
          await signInWithGoogle({
            email: profile.email,
            name: profile.name ?? profile.email,
            picture: profile.picture,
          });
          router.replace('/');
        } catch (error) {
          console.error('[LoginScreen] Failed to process Google profile', error);
          setAuthError('Unable to complete Google sign-in. Try again.');
        } finally {
          setIsSubmitting(false);
        }
      };
      void processProfile();
      return;
    }
    if (response.type === 'error') {
      console.error('[LoginScreen] Google auth error', response.error);
      setAuthError('Google sign-in failed. Try again.');
      setIsSubmitting(false);
      return;
    }
    if (response.type === 'dismiss' || response.type === 'cancel') {
      setIsSubmitting(false);
    }
  }, [response, router, signInWithGoogle]);

  const handleGoogleSignIn = async () => {
    if (!request) {
      setAuthError('Google sign-in is not available right now.');
      return;
    }
    try {
      setAuthError(null);
      setIsSubmitting(true);
      const result = await promptAsync({
        useProxy: Platform.OS !== 'web',
        showInRecents: true,
      });
      if (!result) {
        setIsSubmitting(false);
        return;
      }
      if (result.type === 'dismiss' || result.type === 'cancel') {
        setIsSubmitting(false);
      }
      if (result.type === 'error') {
        setAuthError('Google sign-in failed. Try again.');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('[LoginScreen] Google prompt failed', error);
      setAuthError('Unable to launch Google sign-in.');
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = isSubmitting || isLoading || !request;

  return (
    <View style={[styles.root, rootSafeAreaStyle]} testID="login-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0F172A', '#1E3A8A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.overlay, overlayStyle]}>
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'rgba(14,165,233,0.16)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroIconWrapper}>
              <LinearGradient
                colors={['#38BDF8', '#0EA5E9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroIconBackground}
              >
                <ShieldCheck color="#FFFFFF" size={32} />
              </LinearGradient>
              <Sparkles color="#FACC15" size={22} style={styles.sparkleIcon} />
            </View>
            <Text style={styles.heroTitle}>Pulse Sales HQ</Text>
            <Text style={styles.heroSubtitle}>
              Keep every rep aligned and every leader informed with a single tap.
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to continue</Text>
          <Text style={styles.cardSubtitle}>
            Use your Gmail account to access admin or leader dashboards instantly.
          </Text>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={isButtonDisabled}
            style={({ pressed }) => {
              return [
                styles.googleButton,
                pressed && !isButtonDisabled ? styles.googleButtonPressed : null,
                isButtonDisabled ? styles.googleButtonDisabled : null,
              ];
            }}
            testID="google-sign-in-button"
          >
            <View style={styles.googleButtonContent}>
              <Image
                source="https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Google_%22G%22_Logo.svg/512px-Google_%22G%22_Logo.svg.png"
                style={styles.googleLogo}
                contentFit="contain"
              />
              <Text style={styles.googleButtonText}>
                {isSubmitting ? 'Signing in...' : 'Continue with Google'}
              </Text>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.placeholder} />}
            </View>
          </Pressable>

          {authError ? (
            <View style={styles.errorBanner} testID="login-error-banner">
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Secure by Design · Role-based visibility</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 18,
  },
  heroGradient: {
    padding: 28,
    gap: 18,
  },
  heroIconWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroIconBackground: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  sparkleIcon: {
    marginTop: 12,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(241,245,249,0.75)',
    lineHeight: 24,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  cardSubtitle: {
    fontSize: 15,
    color: 'rgba(226,232,240,0.75)',
    lineHeight: 22,
  },
  googleButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  googleButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  googleButtonDisabled: {
    backgroundColor: 'rgba(37,99,235,0.4)',
    shadowOpacity: 0.1,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  googleLogo: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  googleButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 24,
    height: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(248,113,113,0.18)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(226,232,240,0.6)',
    letterSpacing: 0.4,
  },
});
