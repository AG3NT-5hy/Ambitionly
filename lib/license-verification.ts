import { NativeModules, Platform } from 'react-native';

const { LicenseVerification } = NativeModules;

export interface LicenseCheckResult {
  isValid: boolean;
  message: string;
  reason?: number;
}

export class LicenseVerificationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LicenseVerificationError';
  }
}

/**
 * Check if the app has a valid license from Google Play Store
 * 
 * @returns Promise<LicenseCheckResult> - Result of the license check
 * @throws LicenseVerificationError - If an error occurs during the check
 * 
 * @example
 * ```typescript
 * import { checkLicense } from './lib/license-verification';
 * 
 * try {
 *   const result = await checkLicense();
 *   if (result.isValid) {
 *     console.log('License is valid');
 *     // Continue normal app operation
 *   } else {
 *     console.log('License is invalid:', result.message);
 *     // Handle invalid license (show message, restrict features, etc.)
 *   }
 * } catch (error) {
 *   console.error('License check error:', error);
 *   // Handle error appropriately
 * }
 * ```
 */
export async function checkLicense(): Promise<LicenseCheckResult> {
  // On iOS or other platforms, skip license check
  if (Platform.OS !== 'android') {
    return {
      isValid: true,
      message: 'License check not required on this platform',
    };
  }

  if (!LicenseVerification) {
    throw new LicenseVerificationError(
      'LicenseVerification module not available',
      'MODULE_NOT_AVAILABLE'
    );
  }

  try {
    const result = await LicenseVerification.checkLicense();
    return result as LicenseCheckResult;
  } catch (error: any) {
    throw new LicenseVerificationError(
      error.message || 'Unknown license verification error',
      error.code,
      error
    );
  }
}

/**
 * Policy reasons for license check failure
 */
export const LicensePolicy = {
  NOT_LICENSED: 0x0100,
  RETRY: 0x0123,
} as const;

/**
 * Error codes for license check
 */
export const LicenseErrorCodes = {
  ERROR_INVALID_PACKAGE_NAME: 1,
  ERROR_NON_MATCHING_UID: 2,
  ERROR_NOT_MARKET_MANAGED: 3,
  ERROR_CHECK_IN_PROGRESS: 4,
  ERROR_INVALID_PUBLIC_KEY: 5,
  ERROR_MISSING_PERMISSION: 6,
} as const;

