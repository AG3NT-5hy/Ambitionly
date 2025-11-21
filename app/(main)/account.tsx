import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, LogOut, Save, Camera, AtSign, ArrowLeft } from 'lucide-react-native';
import { useUnifiedUser } from '../../lib/unified-user-store'
import { router } from 'expo-router';
import { useUi } from '../../providers/UiProvider'
import * as ImagePicker from 'expo-image-picker';

export default function AccountScreen() {
  const { user, signOut, updateProfile, isGuest } = useUnifiedUser();
  const { showToast } = useUi();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [name, setName] = useState<string>(user?.name || '');
  const [email, setEmail] = useState<string>(user?.email || '');
  const [username, setUsername] = useState<string>(user?.username || '');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Update local state when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setUsername(user.username || '');
    }
  }, [user]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('Please enter a valid email', 'error');
        return;
      }
    }

    if (username.trim() && !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      showToast('Username must be 3-20 characters (letters, numbers, underscore)', 'error');
      return;
    }

    try {
      await updateProfile({
        name: name.trim(),
        username: username.trim() || undefined,
      });
      setIsEditing(false);
      showToast('Account updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update account', 'error');
      console.error('Error updating account:', error);
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast('Permission to access photos is required', 'error');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await updateProfile({
          profilePicture: result.assets[0].uri,
        });
        showToast('Profile picture updated', 'success');
      }
    } catch (error) {
      showToast('Failed to update profile picture', 'error');
      console.error('Error picking image:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your data will remain saved on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // Small delay to ensure all state is cleared
              await new Promise(resolve => setTimeout(resolve, 100));
              showToast('Signed out successfully', 'success');
              // Use replace to prevent going back
              router.replace('/welcome');
            } catch (error) {
              console.error('Sign out error:', error);
              showToast('Failed to sign out', 'error');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <LinearGradient colors={['#000000', '#29202B']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account</Text>
            <Text style={styles.headerSubtitle}>Manage your profile</Text>
          </View>

          <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  {user?.profilePicture ? (
                    <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
                  ) : (
                    <User size={48} color="#00E6E6" />
                  )}
                </View>
                {!isGuest && (
                  <TouchableOpacity 
                    style={styles.cameraButton}
                    onPress={handlePickImage}
                  >
                    <Camera size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.profileName}>{user?.name || (user?.isGuest ? 'Guest User' : 'User')}</Text>
              {user?.username && (
                <Text style={styles.profileUsername}>@{user.username}</Text>
              )}
              <Text style={styles.profileEmail}>{user?.email || (user?.isGuest ? 'No email set' : 'No email')}</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Profile Information</Text>
                {!isEditing && !isGuest && (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Text style={styles.editButton}>Edit</Text>
                  </TouchableOpacity>
                )}
                {isGuest && (
                  <Text style={styles.guestHint}>Sign up to edit</Text>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <User size={18} color="#00E6E6" />
                    <Text style={styles.inputLabelText}>Name</Text>
                  </View>
                  <TextInput
                    style={[styles.input, (!isEditing || isGuest) && styles.inputDisabled]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor="#666666"
                    editable={isEditing && !isGuest}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <AtSign size={18} color="#00E6E6" />
                    <Text style={styles.inputLabelText}>Username</Text>
                  </View>
                  <TextInput
                    style={[styles.input, (!isEditing || isGuest) && styles.inputDisabled]}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter your username (optional)"
                    placeholderTextColor="#666666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={isEditing && !isGuest}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.inputLabel}>
                    <Mail size={18} color="#00E6E6" />
                    <Text style={styles.inputLabelText}>Email</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={email}
                    placeholder={isGuest ? "Sign up to set email" : "Email (cannot be changed)"}
                    placeholderTextColor="#666666"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={false}
                  />
                </View>

                {isEditing && (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      onPress={() => {
                        setName(user?.name || '');
                        setEmail(user?.email || '');
                        setUsername(user?.username || '');
                        setIsEditing(false);
                      }}
                    >
                      <Text style={styles.buttonSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonPrimary]}
                      onPress={handleSave}
                    >
                      <Save size={18} color="#000000" />
                      <Text style={styles.buttonPrimaryText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {!isGuest && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Details</Text>
                <View style={styles.card}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Member Since</Text>
                    <Text style={styles.detailValue}>{formatDate(user?.createdAt)}</Text>
                  </View>
                </View>
              </View>
            )}

            {isGuest && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.signUpButton}
                  onPress={() => router.push('/auth?mode=signin&from=account')}
                >
                  <Text style={styles.signUpButtonText}>Sign Up to Save Your Profile</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isGuest && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={handleSignOut}
                >
                  <LogOut size={20} color="#FF6B6B" />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Your data is stored locally on your device
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A1A',
    borderWidth: 3,
    borderColor: '#00E6E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00E6E6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00E6E6',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#9A9A9A',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9A9A9A',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  editButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00E6E6',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9A9A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#2D2D2D',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3D3D3D',
  },
  inputDisabled: {
    backgroundColor: '#1A1A1A',
    borderColor: '#2D2D2D',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonPrimary: {
    backgroundColor: '#00E6E6',
  },
  buttonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  buttonSecondary: {
    backgroundColor: '#2D2D2D',
    borderWidth: 1,
    borderColor: '#3D3D3D',
  },
  buttonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 16,
    color: '#9A9A9A',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  guestHint: {
    fontSize: 14,
    color: '#9A9A9A',
    fontStyle: 'italic',
  },
  signUpButton: {
    backgroundColor: '#00E6E6',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
