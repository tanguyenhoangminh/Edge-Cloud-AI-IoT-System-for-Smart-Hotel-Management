import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Platform, Alert, Dimensions, ScrollView 
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Svg, Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const IS_WEB = Platform.OS === 'web';
// Lấy chiều rộng 1 lần duy nhất để không gây re-render khi màn hình co giãn
const windowWidth = Dimensions.get('window').width;
const isDesktopWeb = IS_WEB && windowWidth >= 768;

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const handleLogin = () => {
    if (email === 'admin' && password === '123456') {
      onLoginSuccess();
    } else {
      Alert.alert('Login Failed', 'Invalid credentials.');
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContainer} 
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.container}>
        
        {/* ========================================================= */}
        {/* LEFT PANEL - CHỈ HIỂN THỊ TRÊN WEB (MÀN HÌNH RỘNG)          */}
        {/* ========================================================= */}
        {isDesktopWeb && (
          <View style={styles.leftPanel}>
            <View style={StyleSheet.absoluteFill}>
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#0f172a" stopOpacity="1" />
                    <Stop offset="1" stopColor="#1e3a8a" stopOpacity="1" />
                  </LinearGradient>
                </Defs>
                <Path d="M0 0 H 2000 V 2000 H 0 Z" fill="url(#bgGrad)" />
                <Circle cx="20%" cy="25%" r="200" fill="#3b82f6" opacity="0.35" />
                <Circle cx="85%" cy="85%" r="250" fill="#8b5cf6" opacity="0.25" />
              </Svg>
            </View>

            <View style={styles.glassCard}>
              <View style={styles.glassIconWrapper}>
                <MaterialCommunityIcons name="shield-home-outline" size={42} color="#60a5fa" />
              </View>
              <Text style={styles.leftTitle}>Hotel_Technology {'\n'} Management</Text>
              <Text style={styles.leftSub}>
                Experience seamless operations. Control room environments, monitor energy, and manage guests from a unified IoT command center.
              </Text>
              
              <View style={styles.decorativeDashContainer}>
                <View style={[styles.dash, { width: 40, backgroundColor: '#60a5fa' }]} />
                <View style={[styles.dash, { width: 15, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
                <View style={[styles.dash, { width: 8, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              </View>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* RIGHT PANEL - FORM ĐĂNG NHẬP                              */}
        {/* ========================================================= */}
        <View style={styles.rightPanel}>
          <View style={styles.loginBox}>
            
            <View style={styles.logoContainer}>
              <View style={styles.logoIconBg}>
                <MaterialCommunityIcons name="hexagon-multiple-outline" size={26} color="#2563eb" />
              </View>
              <Text style={styles.logoText}>Hotel <Text style={styles.logoTextLight}>Management</Text></Text>
            </View>

            <View style={styles.welcomeWrapper}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.subText}>Please enter your details to sign in.</Text>
            </View>

            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputWrapper, isEmailFocused && styles.inputWrapperFocused]}>
             <MaterialCommunityIcons name="account-outline" size={20} color={isEmailFocused ? "#2563eb" : "#94a3b8"} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="Enter admin" 
                placeholderTextColor="#cbd5e1"
                value={email} 
                onChangeText={setEmail} 
                autoCapitalize="none"
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
              />
            </View>

            <View style={styles.passwordHeader}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputWrapper, isPasswordFocused && styles.inputWrapperFocused]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={isPasswordFocused ? "#2563eb" : "#94a3b8"} style={styles.inputIcon} />
              <TextInput 
                style={styles.input} 
                placeholder="••••••••" 
                placeholderTextColor="#cbd5e1"
                secureTextEntry 
                value={password} 
                onChangeText={setPassword}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
              />
            </View>

            <TouchableOpacity style={styles.btnLogin} onPress={handleLogin} activeOpacity={0.8}>
              <Text style={styles.btnText}>Sign In</Text>
            </TouchableOpacity>

            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.footerLink}>Contact IT Support</Text>
            </Text>
            
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#ffffff'
  },
  container: { 
    flex: 1, 
    flexDirection: 'row',
  },
  leftPanel: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40,
    position: 'relative',
    overflow: 'hidden'
  },
  glassCard: {
    maxWidth: 480,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    ...(IS_WEB ? { backdropFilter: 'blur(16px)' } : {})
  },
  glassIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  leftTitle: { 
    color: '#ffffff', 
    fontSize: 36, 
    fontWeight: '900', 
    lineHeight: 46,
    marginBottom: 15,
    letterSpacing: -0.5
  },
  leftSub: { 
    color: '#cbd5e1', 
    fontSize: 16, 
    lineHeight: 26,
    fontWeight: '400'
  },
  decorativeDashContainer: {
    flexDirection: 'row',
    marginTop: 35,
    gap: 6
  },
  dash: {
    height: 4,
    borderRadius: 2
  },
  
  // ============================
  // CÁCH NEO VỊ TRÍ CHỐNG GIẬT
  // ============================
  rightPanel: { 
    flex: 1, 
    backgroundColor: '#ffffff', 
    // Trên Web giữ nguyên giữa màn hình, trên App Mobile đẩy sát lên đầu
    justifyContent: IS_WEB ? 'center' : 'flex-start', 
    // Cấp khoảng cách cố định từ đầu màn hình cho App Mobile
    paddingTop: IS_WEB ? 0 : 80,
    alignItems: 'center',
  },
  loginBox: { 
    width: '100%', 
    maxWidth: 400,
    paddingHorizontal: 30,
    paddingBottom: 40
  },
  
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 50 },
  logoIconBg: { backgroundColor: '#eff6ff', padding: 10, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: '#dbeafe' },
  logoText: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  logoTextLight: { fontWeight: '300', color: '#2563eb' },
  welcomeWrapper: { marginBottom: 35 },
  welcomeText: { fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 8, letterSpacing: -0.5 },
  subText: { fontSize: 15, color: '#64748b' },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 8 },
  forgotPassword: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#f8fafc',
    // Loại bỏ Shadow/Elevation trên Android để không bị lỗi văng Focus
    ...(Platform.OS !== 'android' ? {
      shadowColor: '#2563eb',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 0 // Đảm bảo tắt hẳn elevation
    } : {})
  },
  inputIcon: { marginRight: 12 },
  input: { 
    flex: 1,
    paddingVertical: 14, 
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    ...(IS_WEB ? { outline: 'none' } : {})
  },
  btnLogin: { 
    backgroundColor: '#2563eb', 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 35,
    shadowColor: '#2563eb',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: IS_WEB ? 5 : 0 // Tương tự, bỏ elevation động trên mobile
  },
  btnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
  footerText: { marginTop: 30, textAlign: 'center', fontSize: 13, color: '#64748b' },
  footerLink: { color: '#2563eb', fontWeight: '700' }
});