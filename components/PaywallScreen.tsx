import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Zap, Check, Sparkles, Target, TrendingUp, Users, Award, ArrowRight, AlertTriangle, Star, Flame, Shield, Trophy, Rocket, Clock, BarChart3, Eye, Heart } from 'lucide-react-native';
import { useSubscription, type SubscriptionPlan } from '../hooks/subscription-store';
import { useUi } from '../providers/UiProvider';
import { analytics } from '../lib/analytics';
import Purchases from 'react-native-purchases';

interface TrailSegment {
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
}

interface ShootingStar {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  initialY: number;
  trail: TrailSegment[];
  angle: number;
}

interface PaywallScreenProps {
  onClose: () => void;
  onSubscribe: () => void;
}

export default function PaywallScreen({ onClose, onSubscribe }: PaywallScreenProps) {
  const { width, height } = useWindowDimensions();
  const { purchaseSubscription, restoreSubscription, getAnnualSavings, syncRevenueCatStatus } = useSubscription();
  const { showToast } = useUi();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('annual');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [purchaseCompleted, setPurchaseCompleted] = useState<boolean>(false);
  
  // RevenueCat product fetching
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Individual element animations for staggered flow
  const heroAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const pricingAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  
  // Slide animations for each element
  const heroSlide = useRef(new Animated.Value(40)).current;
  const featuresSlide = useRef(new Animated.Value(50)).current;
  const pricingSlide = useRef(new Animated.Value(60)).current;
  const ctaSlide = useRef(new Animated.Value(30)).current;
  
  // Floating animations
  const floatAnim1 = useRef(new Animated.Value(0)).current;
  const floatAnim2 = useRef(new Animated.Value(0)).current;
  const floatAnim3 = useRef(new Animated.Value(0)).current;
  
  // Background flow animations
  const backgroundFlow1 = useRef(new Animated.Value(0)).current;
  const backgroundFlow2 = useRef(new Animated.Value(0)).current;
  const backgroundFlow3 = useRef(new Animated.Value(0)).current;
  
  // Progress bar animations
  const progressAnim1 = useRef(new Animated.Value(0)).current;
  const progressAnim2 = useRef(new Animated.Value(0)).current;
  const progressAnim3 = useRef(new Animated.Value(0)).current;
  const progressAnim4 = useRef(new Animated.Value(0)).current;
  
  // Pulse animations for visual elements
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  
  const timeouts = useRef<NodeJS.Timeout[]>([]).current;
  
  const shootingStars = useRef<ShootingStar[]>(
    Array.from({ length: 6 }, (_, i) => {
      const initialY = Math.random() * height * 0.6;
      const angle = 15 + Math.random() * 20;
      const trailSegments = Array.from({ length: 15 }, () => ({
        x: new Animated.Value(-100),
        y: new Animated.Value(initialY),
        opacity: new Animated.Value(0),
      }));
      
      return {
        id: i,
        x: new Animated.Value(-100),
        y: new Animated.Value(initialY),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.8 + Math.random() * 0.4),
        initialY,
        trail: trailSegments,
        angle,
      };
    })
  ).current;

  const animateShootingStar = useCallback((star: ShootingStar) => {
    const newY = Math.random() * height * 0.4;
    const newAngle = 25 + Math.random() * 15;
    const duration = 4000 + Math.random() * 3000;
    const distance = width + 300;
    const verticalDistance = Math.tan((newAngle * Math.PI) / 180) * distance;
    
    star.x.setValue(-100);
    star.y.setValue(newY);
    star.opacity.setValue(0);
    star.initialY = newY;
    star.angle = newAngle;
    
    star.trail.forEach((segment, index) => {
      segment.x.setValue(-100 - (index * 6));
      segment.y.setValue(newY - (Math.tan((newAngle * Math.PI) / 180) * index * 6));
      segment.opacity.setValue(0);
    });
    
    const starAnimation = Animated.parallel([
      Animated.timing(star.x, {
        toValue: distance,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(star.y, {
        toValue: newY + verticalDistance,
        duration,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(star.opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(star.opacity, {
          toValue: 0,
          duration: duration - 200,
          delay: 100,
          useNativeDriver: true,
        }),
      ]),
    ]);
    
    const trailAnimations = star.trail.map((segment, index) => {
      const delay = index * 60;
      const segmentDuration = duration - delay;
      const segmentDistance = distance + (index * 6);
      const segmentVerticalDistance = Math.tan((newAngle * Math.PI) / 180) * segmentDistance;
      
      return Animated.parallel([
        Animated.timing(segment.x, {
          toValue: segmentDistance,
          duration: segmentDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(segment.y, {
          toValue: newY + segmentVerticalDistance,
          duration: segmentDuration,
          delay,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(segment.opacity, {
            toValue: Math.max(0.05, 0.9 - (index * 0.06)),
            duration: 150,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(segment.opacity, {
            toValue: 0,
            duration: segmentDuration - 300,
            delay: 150,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });
    
    Animated.parallel([starAnimation, ...trailAnimations]).start(() => {
      const timeout = setTimeout(() => animateShootingStar(star), Math.random() * 2000 + 2000) as unknown as NodeJS.Timeout;
      timeouts.push(timeout);
    });
  }, [width, height, timeouts]);

  useEffect(() => {
    // Staggered entrance animations
    const staggerDelay = 200;

    // Overall fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    // Hero animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(heroSlide, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 0);

    // Features animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(featuresAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.spring(featuresSlide, {
          toValue: 0,
          tension: 55,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 1);

    // Pricing animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(pricingAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(pricingSlide, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 2);

    // CTA animation
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(ctaAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(ctaSlide, {
          toValue: 0,
          tension: 70,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, staggerDelay * 3);

    // Continuous floating animations
    const createFloatingAnimation = (animValue: Animated.Value, duration: number, delay: number = 0) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };

      setTimeout(() => animate(), delay);
    };

    createFloatingAnimation(floatAnim1, 3000, 0);
    createFloatingAnimation(floatAnim2, 4000, 1000);
    createFloatingAnimation(floatAnim3, 3500, 2000);

    // Background flow animations - Android optimized
    const createBackgroundFlow = (animValue: Animated.Value, duration: number, delay: number = 0) => {
      const animate = () => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true, // Use native driver for better Android performance
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: duration,
              useNativeDriver: true,
            }),
          ]),
          { iterations: -1 } // Infinite loop
        ).start();
      };

      setTimeout(() => animate(), delay);
    };

    // Platform-specific animation durations for better performance
    const flowDuration1 = Platform.OS === 'android' ? 8000 : 6000; // Faster for more visible flow
    const flowDuration2 = Platform.OS === 'android' ? 10000 : 8000;
    
    createBackgroundFlow(backgroundFlow1, flowDuration1, 0);
    createBackgroundFlow(backgroundFlow2, flowDuration2, 2000); // Reduced delay for better overlap
    createBackgroundFlow(backgroundFlow3, flowDuration1 + 2000, 4000); // Third layer for more complexity
    
    // Progress bar animations
    const animateProgress = (animValue: Animated.Value, delay: number, targetValue: number) => {
      setTimeout(() => {
        Animated.timing(animValue, {
          toValue: targetValue,
          duration: 2000,
          useNativeDriver: false,
        }).start();
      }, delay + 1000);
    };
    
    animateProgress(progressAnim1, 0, 0.85);
    animateProgress(progressAnim2, 200, 0.92);
    animateProgress(progressAnim3, 400, 0.78);
    animateProgress(progressAnim4, 600, 0.95);
    
    // Pulse animations
    const createPulseAnimation = (animValue: Animated.Value, duration: number, delay: number = 0) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(animValue, {
            toValue: 1.1,
            duration: duration,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 1,
            duration: duration,
            useNativeDriver: true,
          }),
        ]).start(() => animate());
      };
      
      setTimeout(() => animate(), delay);
    };
    
    createPulseAnimation(pulseAnim1, 2000, 500);
    createPulseAnimation(pulseAnim2, 2500, 1000);
    createPulseAnimation(pulseAnim3, 1800, 1500);

    // Start shooting stars
    shootingStars.forEach((star, index) => {
      const timeout = setTimeout(() => animateShootingStar(star), index * 600 + Math.random() * 1000) as unknown as NodeJS.Timeout;
      timeouts.push(timeout);
    });

    // Track paywall view
    analytics.track('paywall_viewed');

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      timeouts.length = 0;
    };
  }, [
    animateShootingStar,
    fadeAnim,
    heroAnim,
    featuresAnim,
    pricingAnim,
    ctaAnim,
    heroSlide,
    featuresSlide,
    pricingSlide,
    ctaSlide,
    floatAnim1,
    floatAnim2,
    floatAnim3,
    backgroundFlow1,
    backgroundFlow2,
    backgroundFlow3,
    progressAnim1,
    progressAnim2,
    progressAnim3,
    progressAnim4,
    pulseAnim1,
    pulseAnim2,
    pulseAnim3,
    shootingStars,
    timeouts
  ]);

  // RevenueCat product fetching
  useEffect(() => {
    const getPackages = async () => {
      try {
        setIsLoadingProducts(true);
        
        // Try to use RevenueCat SDK if available
        try {
          const offerings = await Purchases.getOfferings();
          if (offerings.current && offerings.current.availablePackages.length > 0) {
            // Sort packages: Annual first, Monthly second, Lifetime third
            const sortedPackages = offerings.current.availablePackages.sort((a, b) => {
              const getOrder = (pkg: any) => {
                const type = pkg.packageType?.toString().toLowerCase() || '';
                if (type.includes('annual') || type.includes('year')) return 0;
                if (type.includes('month')) return 1;
                if (type.includes('lifetime') || type.includes('forever')) return 2;
                return 3;
              };
              return getOrder(a) - getOrder(b);
            });
            
            // Update descriptions for better display
            const packagesWithDescriptions = sortedPackages.map((pkg, index) => {
              const type = pkg.packageType?.toString().toLowerCase() || '';
              let description = pkg.product.description || "Premium features included";
              
              // Override descriptions based on package type
              if (type.includes('annual') || type.includes('year')) {
                description = 'Save 28%, only $10/ Month';
              } else if (type.includes('lifetime') || type.includes('forever')) {
                description = 'Save 10%, • Pay once, own forever';
              } else if (type.includes('month')) {
                description = 'Cancel anytime';
              }
              
              return {
                ...pkg,
                product: {
                  ...pkg.product,
                  description: description,
                }
              };
            });
            
            setPackages(packagesWithDescriptions);
            setIsLoadingProducts(false);
            return;
          }
        } catch (e) {
          console.log("RevenueCat SDK not available, using fallback:", e);
        }
        
        // Fallback: Use mock packages when RevenueCat is not available
        // Ordered: Annual (yearly) first, Monthly second, Lifetime third
        const mockPackages = [
          {
            identifier: 'annual',
            packageType: 'ANNUAL',
            product: {
              identifier: 'ambitionly_annual',
              title: 'Annual Plan',
              description: 'Save 28%, only $10/ Month',
              priceString: '$120.90/year',
            }
          },
          {
            identifier: 'monthly',
            packageType: 'MONTHLY',
            product: {
              identifier: 'ambitionly_monthly',
              title: 'Monthly Plan',
              description: 'Cancel anytime',
              priceString: '$12.09/month',
            }
          },
          {
            identifier: 'lifetime',
            packageType: 'LIFETIME',
            product: {
              identifier: 'ambitionly_lifetime',
              title: 'Lifetime Access',
              description: 'Save 10%, • Pay once, own forever',
              priceString: '$220 once',
            }
          }
        ];
        
        setPackages(mockPackages);
      } catch (e) {
        console.log("Error fetching offerings", e);
        // Don't show error toast for fallback scenario
        if (e instanceof Error && !e.message.includes('RevenueCat')) {
          showToast('Failed to load subscription options', 'error');
        }
      } finally {
        setIsLoadingProducts(false);
      }
    };
    getPackages();
  }, []);

  const handlePurchase = async () => {
    if (isLoading || !selectedPlan) return;
    
    setIsLoading(true);
    analytics.track('purchase_started', { plan: selectedPlan });

    try {
      // Check if RevenueCat is properly configured
      let isRevenueCatConfigured = false;
      try {
        isRevenueCatConfigured = await Purchases.isConfigured();
      } catch (e) {
        console.log("RevenueCat not configured, using fallback:", e);
        isRevenueCatConfigured = false;
      }
      
      if (isRevenueCatConfigured && packages.length > 0) {
        // Use RevenueCat if available
        const selectedPackage = packages.find(pkg => {
          const planType = convertToSubscriptionPlan(pkg.packageType);
          return planType === selectedPlan;
        });
        
        if (selectedPackage) {
          console.log(`[Purchase] Using RevenueCat package for plan ${selectedPlan}`);
          await handleRevenueCatPurchase(selectedPackage);
          return;
        } else {
          console.log(`[Purchase] No RevenueCat package found for plan ${selectedPlan}, using fallback`);
        }
      }
      
      // Fallback to mock purchase system
      const success = await purchaseSubscription(selectedPlan);
      
      if (success) {
        showToast('Welcome to Ambitionly Pro! 🎉', 'success');
        setPurchaseCompleted(true);
        // Don't automatically call onSubscribe - let user click "Start Your Journey"
        // onSubscribe(); // Commented out to prevent automatic activation
      } else {
        showToast('Purchase failed. Please try again.', 'error');
        analytics.track('purchase_failed', { plan: selectedPlan, error: 'Purchase returned false' });
      }
    } catch (error) {
      console.error('Purchase error:', error);
      showToast('Purchase failed. Please try again.', 'error');
      analytics.track('purchase_failed', { plan: selectedPlan, error: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  // RevenueCat purchase handling
  const handleRevenueCatPurchase = async (pkg: any) => {
    if (isLoading) return;
    
    setIsLoading(true);
    analytics.track('purchase_started', { productId: pkg.identifier });

    try {
      // Try RevenueCat SDK first
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        if (customerInfo.entitlements.active.premium_access) {
          // Sync subscription state with RevenueCat
          await syncRevenueCatStatus();
          
          showToast('✅ Premium unlocked!', 'success');
          setPurchaseCompleted(true);
          analytics.track('purchase_succeeded', { productId: pkg.identifier });
          // Don't automatically call onSubscribe - let user click "Start Your Journey"
          // onSubscribe(); // Commented out to prevent automatic activation
        } else {
          showToast('Purchase completed but premium not activated', 'warning');
        }
        return;
      } catch (e) {
        console.log("RevenueCat purchase failed, using fallback:", e);
      }
      
      // Fallback: Use the regular purchase handler
      const planType = convertToSubscriptionPlan(pkg.packageType);
      const success = await purchaseSubscription(planType);
      
      if (success) {
        showToast('✅ Premium unlocked!', 'success');
        setPurchaseCompleted(true);
        // Don't automatically call onSubscribe - let user click "Start Your Journey"
        // onSubscribe(); // Commented out to prevent automatic activation
      } else {
        showToast('Purchase failed. Please try again.', 'error');
        analytics.track('purchase_failed', { productId: pkg.identifier, error: 'Purchase returned false' });
      }
    } catch (e) {
      if (!(e as any)?.userCancelled) {
        console.log("Purchase error", e);
        showToast('Purchase failed. Please try again.', 'error');
        analytics.track('purchase_failed', { productId: pkg.identifier, error: (e as Error).message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartJourney = () => {
    if (purchaseCompleted) {
      onSubscribe();
    }
  };

  // Helper function to convert RevenueCat package type to SubscriptionPlan
  const convertToSubscriptionPlan = (packageType: any): SubscriptionPlan => {
    if (!packageType) return 'annual'; // Default fallback
    
    const type = packageType.toString().toLowerCase();
    
    switch (type) {
      case 'monthly':
      case 'month':
        return 'monthly';
      case 'annual':
      case 'year':
      case 'yearly':
        return 'annual';
      case 'lifetime':
      case 'forever':
        return 'lifetime';
      default:
        console.warn('Unknown package type:', packageType, 'defaulting to annual');
        return 'annual';
    }
  };

  const handleRestore = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Try RevenueCat restore first
      try {
        const customerInfo = await Purchases.restorePurchases();
        if (customerInfo.entitlements.active.premium_access) {
          // Sync subscription state with RevenueCat
          await syncRevenueCatStatus();
          
          showToast('Subscription restored successfully! 🎉', 'success');
          setPurchaseCompleted(true);
          analytics.track('restore_purchases_succeeded');
          // Don't automatically call onSubscribe - let user click "Start Your Journey"
          // onSubscribe(); // Commented out to prevent automatic activation
          return;
        }
      } catch (e) {
        console.log("RevenueCat restore failed, using fallback:", e);
      }
      
      // Fallback: Use the regular restore handler
      const restored = await restoreSubscription();
      
      if (restored) {
        showToast('Subscription restored successfully! 🎉', 'success');
        setPurchaseCompleted(true);
        // Don't automatically call onSubscribe - let user click "Start Your Journey"
        // onSubscribe(); // Commented out to prevent automatic activation
      } else {
        showToast('No previous purchases found.', 'warning');
      }
    } catch (error) {
      console.error('Restore error:', error);
      showToast('Failed to restore purchases.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const savings = getAnnualSavings();

  const insecurities = [
    { 
      icon: Target, 
      title: 'Become the Man Capable of Achieving his Ambitions', 
      description: 'Stop being the person who sets goals but never follows through',
      problem: 'Still making excuses?',
      solution: 'Take control of your destiny',
      progress: progressAnim1,
      stats: '85% of people never achieve their goals'
    },
    { 
      icon: TrendingUp, 
      title: 'Be the Person who takes Actions, not Dreams of it', 
      description: 'Transform from a dreamer into someone who actually executes',
      problem: 'Tired of watching others succeed?',
      solution: 'Start building your empire today',
      progress: progressAnim2,
      stats: '92% stay in the planning phase forever'
    },
    { 
      icon: Users, 
      title: 'Stop Being Left Behind by Your Peers', 
      description: 'While you procrastinate, others are already winning',
      problem: 'Everyone else is moving forward',
      solution: 'Join the top 1% who actually achieve',
      progress: progressAnim3,
      stats: '78% feel left behind by their peers'
    },
    { 
      icon: Award, 
      title: 'Become Someone Others Look Up To', 
      description: 'Stop being invisible and start commanding respect',
      problem: 'Feeling overlooked and undervalued?',
      solution: 'Build the life that inspires others',
      progress: progressAnim4,
      stats: '95% want to be respected and admired'
    },
  ];

  const PlanCard = ({ plan, title, price, subtitle, isPopular = false, onPress }: {
    plan: SubscriptionPlan;
    title: string;
    price: string;
    subtitle?: string;
    isPopular?: boolean;
    onPress?: () => void;
  }) => {
    const handlePlanSelect = () => {
      try {
        console.log('Plan selected:', plan);
        setSelectedPlan(plan);
      } catch (error) {
        console.error('Error selecting plan:', error);
        showToast('Error selecting plan. Please try again.', 'error');
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.planCard,
          selectedPlan === plan && styles.selectedPlanCard,
          isPopular && styles.popularPlanCard,
        ]}
        onPress={onPress || handlePlanSelect}
        accessibilityLabel={`Select ${title} plan`}
      >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Sparkles size={12} color="#FFFFFF" />
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}
      
      <View style={styles.planHeader}>
        <Text style={[styles.planTitle, selectedPlan === plan && styles.selectedPlanTitle]}>
          {title}
        </Text>
        <Text style={[styles.planPrice, selectedPlan === plan && styles.selectedPlanPrice]}>
          {price}
        </Text>
        {subtitle && (
          <Text style={[styles.planSubtitle, selectedPlan === plan && styles.selectedPlanSubtitle]}>
            {subtitle}
          </Text>
        )}
      </View>
      
      <View style={styles.planCheckmark}>
        {selectedPlan === plan ? (
          <View style={styles.selectedCheckmark}>
            <Check size={16} color="#FFFFFF" />
          </View>
        ) : (
          <View style={styles.unselectedCheckmark} />
        )}
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Animated background with same colors as generating screen */}
      <LinearGradient
        colors={['#000000', '#1A1A1A', '#000000']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Additional Android-optimized gradient overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: backgroundFlow1.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.02, 0.08, 0.02],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={['#8B5CF6', 'transparent', '#7C3AED', 'transparent', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      
      {/* Continuous linear gradient flow - Top to Bottom */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: backgroundFlow1.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.1, 0.3, 0.1],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: height * 2, // Make it twice the screen height for smooth flow
              transform: [
                {
                  translateY: backgroundFlow1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-height, 0], // Move from above screen to below
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#8B5CF6', '#7C3AED', '#8B5CF6', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </Animated.View>
      
      {/* Secondary gradient flow - Bottom to Top */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: backgroundFlow2.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.05, 0.2, 0.05],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: height * 2, // Make it twice the screen height for smooth flow
              transform: [
                {
                  translateY: backgroundFlow2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -height], // Move from below screen to above
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#1A1A1A', '#2D2D2D', '#1A1A1A', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </Animated.View>
      
      {/* Third gradient flow - Diagonal flow */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: backgroundFlow3.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.03, 0.12, 0.03],
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: height * 1.5,
              transform: [
                {
                  translateY: backgroundFlow3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-height * 0.5, height * 0.5],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#6B46C1', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </Animated.View>
      
      {/* Shooting stars */}
      {shootingStars.map((star) => (
        <View key={star.id}>
          {/* Trail segments */}
          {star.trail.map((segment, index) => (
            <Animated.View
              key={`${star.id}-trail-${index}`}
              style={[
                styles.trailSegment,
                {
                  transform: [
                    { translateX: segment.x },
                    { translateY: segment.y },
                    { rotate: `${star.angle}deg` },
                  ],
                  opacity: segment.opacity,
                },
              ]}
            >
              <LinearGradient
                colors={[
                  index < 2 ? '#B0B0B0' : index < 4 ? '#9090A0' : index < 6 ? '#6B46C1' : index < 8 ? '#553C9A' : '#4C1D95',
                  index < 3 ? '#6B46C1' : index < 6 ? '#553C9A' : index < 9 ? '#4C1D95' : '#3C1361',
                  'transparent'
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.trailGradient,
                  {
                    width: Math.max(3, 35 - (index * 2)),
                    height: Math.max(0.3, 1.0 - (index * 0.05)),
                  }
                ]}
              />
            </Animated.View>
          ))}
          
          {/* Main star */}
          <Animated.View
            style={[
              styles.shootingStar,
              {
                transform: [
                  { translateX: star.x },
                  { translateY: star.y },
                  { scale: star.scale },
                  { rotate: `${star.angle}deg` },
                ],
                opacity: star.opacity,
              },
            ]}
          >
            <View style={styles.starCore} />
            <View style={styles.starGlow} />
          </Animated.View>
        </View>
      ))}
      
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close paywall"
            >
              <X size={24} color="#FF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Hero Section */}
            <Animated.View 
              style={[
                styles.heroSection,
                {
                  opacity: heroAnim,
                  transform: [
                    { translateY: heroSlide },
                    { translateY: Animated.multiply(floatAnim1, 3) },
                  ],
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.heroIconContainer,
                  {
                    transform: [
                      { scale: Animated.add(1, Animated.multiply(floatAnim2, 0.05)) },
                      { rotate: floatAnim3.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['-3deg', '3deg'],
                      }) },
                    ],
                  }
                ]}
              >
                <LinearGradient
                  colors={['#29202b', '#8B5CF6', '#7C3AED']}
                  style={styles.heroIcon}
                >
                  <Image 
                    source={require('../assets/images/logo-paywall.png')}
                    style={styles.logoImage}
                    contentFit="contain"
                    transition={200}
                  />
                </LinearGradient>
              </Animated.View>
              
              <Animated.View
                style={[
                  {
                    transform: [
                      { scale: Animated.add(1, Animated.multiply(floatAnim1, 0.02)) },
                    ],
                  }
                ]}
              >
                <Text style={styles.heroTitle}>
                  Stop Settling for Average
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  {
                    transform: [
                      { translateY: Animated.multiply(floatAnim2, -2) },
                    ],
                  }
                ]}
              >
                <Text style={styles.heroSubtitle}>
                  While others make excuses, you can become unstoppable.
                </Text>
              </Animated.View>
              
              {/* Urgency indicator */}
              <Animated.View 
                style={[
                  styles.urgencyBadge,
                  {
                    transform: [
                      { scale: Animated.add(1, Animated.multiply(floatAnim3, 0.05)) },
                    ],
                  }
                ]}
              >
                <AlertTriangle size={16} color="#8B5CF6" />
                <Text style={styles.urgencyText}>Don&apos;t let another year pass by</Text>
              </Animated.View>
              
              {/* Visual success indicators */}
              <View style={styles.successIndicators}>
                <Animated.View 
                  style={[
                    styles.successIndicator,
                    {
                      transform: [{ scale: pulseAnim1 }],
                    }
                  ]}
                >
                  <Star size={14} color="#FFD700" fill="#FFD700" />
                  <Text style={styles.successText}>10,000+ Lives Changed</Text>
                </Animated.View>
                
                <Animated.View 
                  style={[
                    styles.successIndicator,
                    {
                      transform: [{ scale: pulseAnim2 }],
                    }
                  ]}
                >
                  <Flame size={14} color="#FF6B35" />
                  <Text style={styles.successText}>97% Success Rate</Text>
                </Animated.View>
                
                <Animated.View 
                  style={[
                    styles.successIndicator,
                    {
                      transform: [{ scale: pulseAnim3 }],
                    }
                  ]}
                >
                  <Trophy size={14} color="#8B5CF6" />
                  <Text style={styles.successText}>Top Rated App</Text>
                </Animated.View>
              </View>
            </Animated.View>

            {/* Insecurity-targeting section */}
            <Animated.View 
              style={[
                styles.featuresSection,
                {
                  opacity: featuresAnim,
                  transform: [
                    { translateY: featuresSlide },
                  ],
                }
              ]}
            >
              <Text style={styles.sectionTitle}>What&apos;s Holding You Back?</Text>
              {insecurities.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <Animated.View 
                    key={`insecurity-${item.title}`} 
                    style={[
                      styles.insecurityItem,
                      {
                        transform: [
                          { translateY: Animated.multiply(index % 2 === 0 ? floatAnim1 : floatAnim2, 2) },
                          { scale: Animated.add(1, Animated.multiply(index % 2 === 0 ? floatAnim1 : floatAnim2, 0.01)) },
                        ],
                      }
                    ]}
                  >
                    {/* Background gradient overlay */}
                    <LinearGradient
                      colors={['transparent', '#8B5CF6', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.insecurityGradientOverlay}
                    />
                    
                    <View style={styles.insecurityHeader}>
                      <View style={styles.insecurityIconContainer}>
                        <LinearGradient
                          colors={['#8B5CF6', '#7C3AED']}
                          style={styles.insecurityIconGradient}
                        >
                          <IconComponent size={16} color="#FFFFFF" />
                        </LinearGradient>
                        
                        {/* Pulsing ring around icon */}
                        <Animated.View 
                          style={[
                            styles.iconPulseRing,
                            {
                              transform: [{ scale: index % 2 === 0 ? pulseAnim1 : pulseAnim2 }],
                            }
                          ]}
                        />
                      </View>
                      <View style={styles.insecurityContent}>
                        <Text style={styles.insecurityProblem}>{item.problem}</Text>
                        <Text style={styles.insecurityTitle}>{item.title}</Text>
                        
                        {/* Statistics */}
                        <View style={styles.statsContainer}>
                          <BarChart3 size={12} color="#FF6B35" />
                          <Text style={styles.statsText}>{item.stats}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.insecurityBody}>
                      <Text style={styles.insecurityDescription}>{item.description}</Text>
                      
                      {/* Progress visualization */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                          <Eye size={14} color="#9A9A9A" />
                          <Text style={styles.progressLabel}>People stuck here:</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                          <Animated.View 
                            style={[
                              styles.progressBar,
                              {
                                width: item.progress.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0%', '100%'],
                                }),
                              }
                            ]}
                          />
                        </View>
                      </View>
                      
                      <View style={styles.solutionContainer}>
                        <Rocket size={16} color="#00E6E6" />
                        <Text style={styles.solutionText}>{item.solution}</Text>
                      </View>
                    </View>
                    
                    {/* Visual emphasis bars */}
                    <View style={styles.emphasisBars}>
                      <View style={[styles.emphasisBar, { width: '30%' }]} />
                      <View style={[styles.emphasisBar, { width: '60%' }]} />
                      <View style={[styles.emphasisBar, { width: '90%' }]} />
                    </View>
                    
                    {/* Corner accent */}
                    <View style={styles.cornerAccent}>
                      <Shield size={12} color="#8B5CF6" />
                    </View>
                  </Animated.View>
                );
              })}
              
              {/* Comparison section */}
              <Animated.View 
                style={[
                  styles.comparisonSection,
                  {
                    transform: [
                      { translateY: Animated.multiply(floatAnim1, 3) },
                      { scale: Animated.add(1, Animated.multiply(floatAnim2, 0.02)) },
                    ],
                  }
                ]}
              >
                <Text style={styles.comparisonTitle}>Two Paths. One Choice.</Text>
                
                <View style={styles.comparisonContainer}>
                  <View style={styles.pathContainer}>
                    <View style={styles.pathHeader}>
                      <View style={[styles.pathIndicator, styles.pathIndicatorNegative]} />
                      <Text style={styles.pathTitle}>Without Ambitionly Pro</Text>
                    </View>
                    <Text style={styles.pathDescription}>• Keep making the same excuses</Text>
                    <Text style={styles.pathDescription}>• Watch others achieve your dreams</Text>
                    <Text style={styles.pathDescription}>• Stay stuck in the planning phase</Text>
                    <Text style={styles.pathDescription}>• Regret wasted potential</Text>
                  </View>
                  
                  <View style={styles.pathDivider} />
                  
                  <View style={styles.pathContainer}>
                    <View style={styles.pathHeader}>
                      <View style={[styles.pathIndicator, styles.pathIndicatorPositive]} />
                      <Text style={styles.pathTitle}>With Ambitionly Pro</Text>
                    </View>
                    <Text style={[styles.pathDescription, styles.pathDescriptionPositive]}>• Become the person who executes</Text>
                    <Text style={[styles.pathDescription, styles.pathDescriptionPositive]}>• Build the life others envy</Text>
                    <Text style={[styles.pathDescription, styles.pathDescriptionPositive]}>• Turn ambitions into achievements</Text>
                    <Text style={[styles.pathDescription, styles.pathDescriptionPositive]}>• Command respect and admiration</Text>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>

            {/* Pricing Plans */}
            <Animated.View 
              style={[
                styles.pricingSection,
                {
                  opacity: pricingAnim,
                  transform: [
                    { translateY: pricingSlide },
                  ],
                }
              ]}
            >
              <Text style={styles.sectionTitle}>Choose Your Plan</Text>
              
              {isLoadingProducts ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading subscription options...</Text>
                </View>
              ) : packages.length > 0 ? (
                packages.map((pkg, index) => (
                  <View key={pkg.identifier} style={styles[`animatedPlanCard${index + 1}` as keyof typeof styles] as any}>
                    <PlanCard
                      plan={convertToSubscriptionPlan(pkg.packageType)}
                      title={pkg.product.title}
                      price={pkg.product.priceString}
                      subtitle={pkg.product.description || "Premium features included"}
                      isPopular={index === 0}
                    />
                    
                    {index === 0 && (
                      <View style={styles.valueIndicators}>
                        <View style={styles.valueIndicator}>
                          <Clock size={12} color="#00E6E6" />
                          <Text style={styles.valueText}>Best Value</Text>
                        </View>
                        <View style={styles.valueIndicator}>
                          <Heart size={12} color="#FF6B35" />
                          <Text style={styles.valueText}>Most Loved</Text>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.fallbackContainer}>
                  {/* Yearly plan first - encouraged */}
                  <View>
                    <PlanCard
                      plan="annual"
                      title="Annual Plan"
                      price="$120.90/year"
                      subtitle="Save 28%, only $10/ Month"
                      isPopular={true}
                    />
                    <View style={styles.valueIndicators}>
                      <View style={styles.valueIndicator}>
                        <Clock size={12} color="#00E6E6" />
                        <Text style={styles.valueText}>Best Value</Text>
                      </View>
                      <View style={styles.valueIndicator}>
                        <Heart size={12} color="#FF6B35" />
                        <Text style={styles.valueText}>Most Loved</Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Monthly plan second */}
                  <PlanCard
                    plan="monthly"
                    title="Monthly Plan"
                    price="$12.09/month"
                    subtitle="Cancel anytime"
                  />
                  
                  {/* Lifetime plan last */}
                  <PlanCard
                    plan="lifetime"
                    title="Lifetime Access"
                    price="$220 once"
                    subtitle="Save 10%, • Pay once, own forever"
                  />
                </View>
              )}
            </Animated.View>

            {/* CTA Section */}
            <Animated.View 
              style={[
                styles.ctaSection,
                {
                  opacity: ctaAnim,
                  transform: [
                    { translateY: ctaSlide },
                    { translateY: Animated.multiply(floatAnim2, 3) },
                  ],
                }
              ]}
            >
              <View style={styles.animatedCtaButton}>
                
                <TouchableOpacity
                  style={[styles.purchaseButton, isLoading && styles.disabledButton]}
                  onPress={purchaseCompleted ? handleStartJourney : handlePurchase}
                  disabled={isLoading}
                  accessibilityLabel={purchaseCompleted ? "Start Your Journey" : `Purchase ${selectedPlan} plan`}
                >
                  <LinearGradient
                    colors={isLoading ? ['#666666', '#666666'] : ['#29202b', '#8B5CF6', '#7C3AED']}
                    style={styles.purchaseButtonGradient}
                  >
                    <Zap size={20} color="#FFFFFF" />
                    <Text style={styles.purchaseButtonText}>
                      {purchaseCompleted ? "Start Your Journey" : `Purchase ${selectedPlan === 'annual' ? 'annual' : selectedPlan === 'monthly' ? 'monthly' : 'lifetime'} Plan`}
                    </Text>
                    
                    {/* Static arrow */}
                    <View style={styles.buttonArrow}>
                      <ArrowRight size={16} color="#FFFFFF" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
                
                {/* Urgency indicators around button */}
                <View style={styles.urgencyIndicators}>
                  <View style={styles.urgencyDot} />
                  <View style={styles.urgencyDot} />
                  <View style={styles.urgencyDot} />
                </View>
              </View>

              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={isLoading}
                accessibilityLabel="Restore previous purchases"
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                • Cancel anytime in your device settings{'\n'}
                • Subscription auto-renews unless cancelled{'\n'}
                • Terms of Service and Privacy Policy apply
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 40,
    marginTop: 20,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  heroIconContainer: {
    marginBottom: 16,
  },
  shootingStar: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailSegment: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailGradient: {
    borderRadius: 1,
  },
  starCore: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#D0D0D0',
    position: 'absolute',
    zIndex: 2,
    shadowColor: '#D0D0D0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
  },
  starGlow: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6B46C1',
    opacity: 0.5,
    position: 'absolute',
    zIndex: 1,
  },
  featuresSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#9A9A9A',
    lineHeight: 20,
  },
  pricingSection: {
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#2D2D2D',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  selectedPlanCard: {
    borderColor: '#00E6E6',
    backgroundColor: '#0A2A2A',
  },
  popularPlanCard: {
    borderColor: '#6C63FF',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    backgroundColor: '#6C63FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planHeader: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  selectedPlanTitle: {
    color: '#00E6E6',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#E0E0E0',
    marginBottom: 2,
  },
  selectedPlanPrice: {
    color: '#FFFFFF',
  },
  planSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  selectedPlanSubtitle: {
    color: '#B3B3B3',
  },
  planCheckmark: {
    marginLeft: 16,
  },
  selectedCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00E6E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unselectedCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2D2D2D',
  },
  ctaSection: {
    marginBottom: 24,
  },
  purchaseButton: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  purchaseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 8,
  },
  purchaseButtonText: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  restoreButtonText: {
    fontSize: 16,
    color: '#9A9A9A',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  fallbackContainer: {
    gap: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 18,
  },
  animatedPlanCard1: {
    // Base style for animated plan card 1
  },
  animatedPlanCard2: {
    // Base style for animated plan card 2
  },
  animatedPlanCard3: {
    // Base style for animated plan card 3
  },
  animatedCtaButton: {
    // Base style for animated CTA button
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1810',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#8B5CF6',
    gap: 8,
  },
  urgencyText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#8B5CF6',
  },
  insecurityItem: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    position: 'relative',
    overflow: 'hidden',
  },
  insecurityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insecurityIconContainer: {
    marginRight: 16,
    marginTop: 2,
  },
  insecurityIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  insecurityContent: {
    flex: 1,
  },
  insecurityProblem: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#8B5CF6',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insecurityTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  insecurityBody: {
    marginLeft: 56,
  },
  insecurityDescription: {
    fontSize: 14,
    color: '#B3B3B3',
    lineHeight: 20,
    marginBottom: 12,
  },
  solutionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  solutionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#00E6E6',
  },
  emphasisBars: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  emphasisBar: {
    height: 2,
    backgroundColor: '#8B5CF6',
    borderRadius: 1,
  },
  comparisonSection: {
    marginTop: 24,
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  comparisonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  pathContainer: {
    flex: 1,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  pathIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pathIndicatorNegative: {
    backgroundColor: '#FF4444',
  },
  pathIndicatorPositive: {
    backgroundColor: '#00E6E6',
  },
  pathTitle: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
  },
  pathDescription: {
    fontSize: 12,
    color: '#9A9A9A',
    lineHeight: 18,
    marginBottom: 4,
  },
  pathDescriptionPositive: {
    color: '#B3B3B3',
  },
  pathDivider: {
    width: 1,
    backgroundColor: '#2D2D2D',
    marginHorizontal: 8,
  },
  successIndicators: {
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    minWidth: 200,
    justifyContent: 'center',
  },
  successText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#B3B3B3',
    textAlign: 'center',
  },
  insecurityGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.3,
  },
  iconPulseRing: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    opacity: 0.3,
    top: -5,
    left: -5,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statsText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#FF6B35',
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: '#9A9A9A',
    fontWeight: '500' as const,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#2D2D2D',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 2,
  },
  cornerAccent: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.4,
  },
  planGlowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: '#8B5CF6',
    borderRadius: 26,
    zIndex: -1,
  },
  valueIndicators: {
    position: 'absolute',
    top: -8,
    right: 20,
    flexDirection: 'row',
    gap: 8,
  },
  valueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  valueText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: '#B3B3B3',
  },
  buttonGlowEffect: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: '#8B5CF6',
    borderRadius: 32,
    zIndex: -1,
  },
  buttonArrow: {
    marginLeft: 8,
  },
  urgencyIndicators: {
    position: 'absolute',
    top: -12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  urgencyDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  logoImage: {
    width: 50,
    height: 50,
    tintColor: '#FFFFFF',
  },
});