import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { loginApi } from '../services/api';
import { setAuthToken } from '../services/secureStorage';

interface LoginScreenProps {
  onLoginSuccess: (userData: any) => void;
  onNavigateRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onNavigateRegister }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Credentials', 'Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await loginApi(email.trim(), password);
      if (response.token) {
        await setAuthToken(response.token);
      }
      onLoginSuccess(response.user);
    } catch (err: any) {
      Alert.alert('Authentication Failed', err.message || 'Unable to authenticate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131314" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Emblem Header */}
          <View style={styles.emblemWrapper}>
            <View style={styles.emblemCircle}>
              <Text style={styles.emblemIcon}>🛡️</Text>
            </View>
            <Text style={styles.brandTitle}>IRON STEED</Text>
            <Text style={styles.brandSubtitle}>SENTINEL KINETIC SECURITY</Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>OPERATOR AUTHENTICATION</Text>

            <Text style={styles.label}>OPERATOR EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="operator@ironsteed.io"
              placeholderTextColor="#8E9192"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>SECURITY PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor="#8E9192"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.primaryBtn, isSubmitting && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#131314" />
              ) : (
                <Text style={styles.btnText}>AUTHENTICATE & LOG IN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={onNavigateRegister}>
              <Text style={styles.secondaryBtnText}>CREATE NEW OPERATOR ACCOUNT</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerNote}>
            <Text style={styles.footerText}>UPLINK STATUS: ENCRYPTED (TLS 1.3)</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131314',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  emblemWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emblemCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0E0E0F',
    borderWidth: 1,
    borderColor: '#FFEA00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emblemIcon: {
    fontSize: 36,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFEA00',
    letterSpacing: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E9192',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#1C1B1C',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 6,
    padding: 20,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFEA00',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E9192',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0E0E0F',
    borderWidth: 1,
    borderColor: '#363435',
    borderRadius: 4,
    padding: 14,
    fontSize: 14,
    color: '#E2E2E2',
  },
  primaryBtn: {
    backgroundColor: '#FFEA00',
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 24,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#131314',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryBtnText: {
    color: '#8E9192',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footerNote: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    color: '#8E9192',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
