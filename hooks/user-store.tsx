import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'ambitionly_user';

export interface User {
  email: string;
  name: string;
  username?: string;
  signedUpAt: Date | string;
  profilePicture?: string;
}

export const [UserProvider, useUser] = createContextHook(() => {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [user, setUserState] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem(STORAGE_KEY);
        
        if (!isMounted) return;

        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.signedUpAt && typeof parsedUser.signedUpAt === 'string') {
              parsedUser.signedUpAt = new Date(parsedUser.signedUpAt);
            }
            setUserState(parsedUser);
          } catch (error) {
            console.error('Failed to parse stored user:', error);
            console.error('Stored user value:', storedUser?.substring(0, 100));
            setUserState(null);
          }
        }
        
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading user data:', error);
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };
    
    loadUser();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = useCallback(async (email: string, name: string, username?: string) => {
    if (!email || !name) {
      throw new Error('Email and name are required');
    }

    const sanitizedEmail = email.trim().toLowerCase().slice(0, 255);
    const sanitizedName = name.trim().slice(0, 100);
    const sanitizedUsername = username?.trim().slice(0, 50);

    if (!sanitizedEmail || !sanitizedName) {
      throw new Error('Invalid email or name');
    }

    const newUser: User = {
      email: sanitizedEmail,
      name: sanitizedName,
      username: sanitizedUsername || user?.username,
      signedUpAt: user?.signedUpAt || new Date(),
      profilePicture: user?.profilePicture,
    };

    setUserState(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    
    console.log('User updated:', sanitizedEmail);
  }, [user]);

  const updateProfilePicture = useCallback(async (uri: string) => {
    if (!user) {
      throw new Error('User not signed in');
    }

    const updatedUser: User = {
      ...user,
      profilePicture: uri,
    };

    setUserState(updatedUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    console.log('Profile picture updated');
  }, [user]);

  const signOut = useCallback(async () => {
    setUserState(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('User signed out');
  }, []);

  const isSignedUp = useCallback((): boolean => {
    return user !== null;
  }, [user]);

  return useMemo(() => ({
    isHydrated,
    user,
    signUp,
    signOut,
    isSignedUp,
    updateProfilePicture,
  }), [isHydrated, user, signUp, signOut, isSignedUp, updateProfilePicture]);
});
