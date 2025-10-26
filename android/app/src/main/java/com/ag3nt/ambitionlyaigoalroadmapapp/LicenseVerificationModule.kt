package com.ag3nt.ambitionlyaigoalroadmapapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

class LicenseVerificationModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    private var licenseChecker: LicenseChecker? = null
    
    override fun getName(): String {
        return "LicenseVerification"
    }
    
    @ReactMethod
    fun checkLicense(promise: Promise) {
        try {
            if (licenseChecker == null) {
                licenseChecker = LicenseChecker(reactApplicationContext)
            }
            
            licenseChecker?.checkLicense(object : LicenseChecker.LicenseCheckListener {
                override fun onLicenseCheckSuccess() {
                    val result = hashMapOf<String, Any>(
                        "isValid" to true,
                        "message" to "License check passed"
                    )
                    promise.resolve(result)
                }
                
                override fun onLicenseCheckFailure(reason: Int, message: String) {
                    val result = hashMapOf<String, Any>(
                        "isValid" to false,
                        "reason" to reason,
                        "message" to message
                    )
                    promise.resolve(result)
                }
                
                override fun onLicenseCheckError(errorCode: Int) {
                    promise.reject(
                        "LICENSE_ERROR",
                        "License check error: ${getErrorMessage(errorCode)}",
                        null
                    )
                }
            })
        } catch (e: Exception) {
            promise.reject("LICENSE_EXCEPTION", "Exception during license check: ${e.message}", e)
        }
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        licenseChecker?.onDestroy()
        licenseChecker = null
    }
    
    private fun getErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            LicenseChecker.ERROR_INVALID_PACKAGE_NAME -> "Invalid package name"
            LicenseChecker.ERROR_NON_MATCHING_UID -> "Non-matching UID"
            LicenseChecker.ERROR_NOT_MARKET_MANAGED -> "Not market managed"
            LicenseChecker.ERROR_CHECK_IN_PROGRESS -> "Check in progress"
            LicenseChecker.ERROR_INVALID_PUBLIC_KEY -> "Invalid public key"
            LicenseChecker.ERROR_MISSING_PERMISSION -> "Missing permission"
            else -> "Unknown error"
        }
    }
}

