import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, Linking } from 'react-native';
import { checkLicense } from '@/lib/license-verification';

interface LicenseCheckerProps {
  children: React.ReactNode;
  onLicenseValid?: () => void;
  onLicenseInvalid?: () => void;
}

/**
 * Component that checks license on mount and renders children only if licensed
 * 
 * @example
 * ```tsx
 * <LicenseChecker>
 *   <YourAppContent />
 * </LicenseChecker>
 * ```
 */
export function LicenseChecker({ 
  children, 
  onLicenseValid, 
  onLicenseInvalid 
}: LicenseCheckerProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isLicensed, setIsLicensed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyLicense();
  }, []);

  async function verifyLicense() {
    try {
      setIsChecking(true);
      const result = await checkLicense();

      if (result.isValid) {
        setIsLicensed(true);
        onLicenseValid?.();
      } else {
        setIsLicensed(false);
        setError(result.message);
        onLicenseInvalid?.();
        
        // Show alert to user
        Alert.alert(
          'License Verification Failed',
          'This app is not properly licensed. Please purchase it from the Google Play Store.',
          [
            {
              text: 'Open Play Store',
              onPress: () => {
                Linking.openURL(
                  'https://play.google.com/store/apps/details?id=com.ag3nt.ambitionlyaigoalroadmapapp'
                );
              },
            },
            {
              text: 'Exit',
              onPress: () => {
                // Could close the app or show restricted view
              },
              style: 'cancel',
            },
          ]
        );
      }
    } catch (err: any) {
      console.error('License check error:', err);
      setError(err.message);
      
      // In case of error, you might want to allow access anyway
      // or show an error and restrict access
      setIsLicensed(true); // Change to false to restrict on error
    } finally {
      setIsChecking(false);
    }
  }

  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Verifying license...</Text>
      </View>
    );
  }

  if (!isLicensed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          License Verification Failed
        </Text>
        <Text style={{ textAlign: 'center', color: '#666' }}>
          {error || 'This app is not properly licensed.'}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Hook to manually check license status
 * 
 * @example
 * ```tsx
 * const { isLicensed, isChecking, checkLicense } = useLicenseCheck();
 * 
 * useEffect(() => {
 *   checkLicense();
 * }, []);
 * ```
 */
export function useLicenseCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [isLicensed, setIsLicensed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performCheck = async () => {
    try {
      setIsChecking(true);
      setError(null);
      const result = await checkLicense();
      setIsLicensed(result.isValid);
      return result;
    } catch (err: any) {
      setError(err.message);
      setIsLicensed(null);
      throw err;
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isLicensed,
    isChecking,
    error,
    checkLicense: performCheck,
  };
}

