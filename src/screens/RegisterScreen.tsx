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
import { registerApi } from '../services/api';
import { setAuthToken } from '../services/secureStorage';

interface RegisterScreenProps {
  onRegisterSuccess: (userData: any) => void;
  onNavigateLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegisterSuccess, onNavigateLogin }) => {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || password.length < 8) {
      Alert.alert('Invalid Input', 'Please enter a valid email and a password of at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await registerApi(email.trim(), password, name.trim());
      if (response.token) {
        await setAuthToken(response.token);
      }
      onRegisterSuccess(response.user);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to register.');
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
          <View style={styles.emblemWrapper}>
            <View style={styles.emblemCircle}>
              <Text style={styles.emblemIcon}>⚡</Text>
            </View>
            <Text style={styles.brandTitle}>IRON STEED</Text>
            <Text style={styles.brandSubtitle}>NEW OPERATOR REGISTRATION</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeaderTitle}>OPERATOR PROFILE SETUP</Text>

            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex Vance"
              placeholderTextColor="#8E9192"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>EMAIL ADDRESS</Text>
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

            <Text style={styles.label}>PASSWORD (MIN 8 CHARACTERS)</Text>
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
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#131314" />
              ) : (
                <Text style={styles.btnText}>REGISTER OPERATOR PROFILE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={onNavigateLogin}>
              <Text style={styles.secondaryBtnText}>ALREADY HAVE AN ACCOUNT? LOG IN</Text>
            </TouchableOpacity>
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
    marginBottom: 28,
  },
  emblemCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0E0E0F',
    borderWidth: 1,
    borderColor: '#FFEA00',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emblemIcon: {
    fontSize: 32,
  },
  brandTitle: {
    fontSize: 20,
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
});
