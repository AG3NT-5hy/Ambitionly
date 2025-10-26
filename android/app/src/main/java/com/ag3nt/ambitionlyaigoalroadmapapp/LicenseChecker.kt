package com.ag3nt.ambitionlyaigoalroadmapapp

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

class LicenseChecker(private val context: Context) {
    
    // Your BASE64-encoded public key from Google Play Console
    // Note: The old LVL library is deprecated. This key is stored for future use with Play Integrity API
    private val BASE64_PUBLIC_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuHQBbl2WGgwds8yVSSLOxh0cYm8YufNWJw9qVvnkP50Pvez+XpsgiCd5a0emgRZ4LanXu9+y8ThZyG+elbLyMLozyCRw8hm1oV5Qd5jzk/+J8kmRA31UQkO+ZXTIAWHSQUkGUWEbn1qnIs0nBfd/nkenUID1MurBh3FLdvmUbvcY52hl3bc7Jjhsa8dXjp0nElHOnG1zDMTYFlC50l/iDr1q59BU9EzD4IwNMkv57yvkJ0VlneS3z+kojtlot02LXLI6K8JviS39IO79pg8ipt8CiwIUD6mz/jv44LG2MEDiq1E3rDOtyN6BDIbtRbov3sMLMr//DxLMxKdMBuVUgQIDAQAB"
    
    interface LicenseCheckListener {
        fun onLicenseCheckSuccess()
        fun onLicenseCheckFailure(reason: Int, message: String)
        fun onLicenseCheckError(errorCode: Int)
    }
    
    fun checkLicense(listener: LicenseCheckListener) {
        try {
            // Check if app is installed from Google Play Store
            val installerPackageName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getInstallerPackageName(context.packageName)
            }
            
            // Valid Play Store installer package names
            val validInstallers = listOf(
                "com.android.vending",  // Google Play Store
                "com.google.android.feedback"  // Google Play Services
            )
            
            when {
                installerPackageName == null -> {
                    // App was sideloaded or installed via ADB (common in development)
                    // In production, you might want to fail this check
                    if (android.os.Build.TYPE == "eng" || android.os.Build.TYPE == "userdebug") {
                        // Development/debug build
                        listener.onLicenseCheckSuccess()
                    } else {
                        listener.onLicenseCheckFailure(Policy.NOT_LICENSED, "NOT_LICENSED: App not installed from Play Store")
                    }
                }
                validInstallers.contains(installerPackageName) -> {
                    // Installed from Play Store
                    listener.onLicenseCheckSuccess()
                }
                else -> {
                    // Installed from unknown source
                    listener.onLicenseCheckFailure(Policy.NOT_LICENSED, "NOT_LICENSED: Invalid installer: $installerPackageName")
                }
            }
        } catch (e: Exception) {
            listener.onLicenseCheckError(ERROR_CHECK_FAILED)
        }
    }
    
    fun onDestroy() {
        // No cleanup needed for this implementation
    }
    
    object Policy {
        const val NOT_LICENSED = 0x0100
        const val RETRY = 0x0123
    }
    
    companion object {
        // License check error codes
        const val ERROR_INVALID_PACKAGE_NAME = 1
        const val ERROR_NON_MATCHING_UID = 2
        const val ERROR_NOT_MARKET_MANAGED = 3
        const val ERROR_CHECK_IN_PROGRESS = 4
        const val ERROR_INVALID_PUBLIC_KEY = 5
        const val ERROR_MISSING_PERMISSION = 6
        const val ERROR_CHECK_FAILED = 7
    }
}

