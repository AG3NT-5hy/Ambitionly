import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, ScrollView, Dimensions, TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Calendar, Clock } from 'lucide-react-native';
import { useAmbition } from '../hooks/ambition-store'

const { width } = Dimensions.get('window');

const timeCommitmentOptions = [
  { id: '30-60min', label: '30-60 minutes', value: '30-60 minutes per day' },
  { id: '1-2h', label: '1-2 hours', value: '1-2 hours per day' },
  { id: '2+h', label: '2+ hours', value: '2+ hours per day' },
];

export default function OnboardingScreen() {
  const { setGoal, setTimeline, setTimeCommitment } = useAmbition();
  const [currentStep, setCurrentStep] = useState(0);
  const [goalText, setGoalText] = useState('');
  const [timelineText, setTimelineText] = useState('');
  const [selectedTimeCommitment, setSelectedTimeCommitment] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [isCustomSelected, setIsCustomSelected] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const steps = [
    {
      title: "What's your goal?",
      subtitle: "Describe what you want to achieve",
      icon: "🎯",
    },
    {
      title: "When do you want to achieve it?",
      subtitle: "Set your target timeline",
      icon: "📅",
    },
    {
      title: "How much time can you commit daily?",
      subtitle: "Choose your daily commitment",
      icon: "⏰",
    },
  ];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep === 0 && goalText.trim()) {
      setGoal(goalText.trim());
      animateToNextStep();
    } else if (currentStep === 1 && timelineText.trim()) {
      setTimeline(timelineText.trim());
      animateToNextStep();
    } else if (currentStep === 2 && (selectedTimeCommitment || (isCustomSelected && customTime.trim()))) {
      const finalTimeCommitment = isCustomSelected ? `${customTime.trim()} per day` : selectedTimeCommitment;
      setTimeCommitment(finalTimeCommitment);
      router.push('/questions-intro');
    }
  };

  const animateToNextStep = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(currentStep + 1);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const canProceed = () => {
    if (currentStep === 0) return goalText.trim().length > 0;
    if (currentStep === 1) return timelineText.trim().length > 0;
    if (currentStep === 2) return selectedTimeCommitment.length > 0 || (isCustomSelected && customTime.trim().length > 0);
    return false;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Get promoted to senior manager, Learn to play guitar, Start my own business..."
              placeholderTextColor="#666666"
              value={goalText}
              onChangeText={setGoalText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        );
      
      case 1:
        return (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., In 6 months, By the end of this year, Within 2 years..."
              placeholderTextColor="#666666"
              value={timelineText}
              onChangeText={setTimelineText}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit={true}
            />
          </View>
        );
      
      case 2:
        return (
          <View style={styles.optionsContainer}>
            {timeCommitmentOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  selectedTimeCommitment === option.value && !isCustomSelected && styles.selectedOption,
                ]}
                onPress={() => {
                  setSelectedTimeCommitment(option.value);
                  setIsCustomSelected(false);
                }}
              >
                <Text style={[
                  styles.optionLabel,
                  selectedTimeCommitment === option.value && !isCustomSelected && styles.selectedOptionText,
                ]}>
                  {option.label}
                </Text>
                <Text style={[
                  styles.optionSubtext,
                  selectedTimeCommitment === option.value && !isCustomSelected && styles.selectedOptionSubtext,
                ]}>
                  per day
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[
                styles.optionCard,
                styles.customOptionCard,
                isCustomSelected && styles.selectedOption,
              ]}
              onPress={() => {
                setIsCustomSelected(true);
                setSelectedTimeCommitment('');
              }}
            >
              <Text style={[
                styles.optionLabel,
                isCustomSelected && styles.selectedOptionText,
              ]}>
                Custom Time
              </Text>
              {isCustomSelected ? (
                <TextInput
                  style={styles.customTimeInput}
                  placeholder="e.g., 45 minutes, 3 hours"
                  placeholderTextColor="#666666"
                  value={customTime}
                  onChangeText={setCustomTime}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  autoFocus={true}
                />
              ) : (
                <Text style={[
                  styles.optionSubtext,
                  isCustomSelected && styles.selectedOptionSubtext,
                ]}>
                  Enter your own time
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <LinearGradient
        colors={['#000000', '#29202B']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingContainer}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.header}>
                <View style={styles.progressContainer}>
                  {steps.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.progressDot,
                        index <= currentStep && styles.progressDotActive,
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.stepCounter}>
                  {currentStep + 1} of {steps.length}
                </Text>
              </View>

              <Animated.View
                style={[
                  styles.content,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.stepHeader}>
                  <Text style={styles.stepIcon}>{steps[currentStep].icon}</Text>
                  <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
                  <Text style={styles.stepSubtitle}>{steps[currentStep].subtitle}</Text>
                </View>

                {renderStepContent()}
              </Animated.View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  !canProceed() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!canProceed()}
              >
                <LinearGradient
                  colors={canProceed() ? ['#29202b', '#8B5CF6', '#A855F7'] : ['#333333', '#333333']}
                  style={styles.nextButtonGradient}
                >
                  <Text style={[
                    styles.nextButtonText,
                    !canProceed() && styles.nextButtonTextDisabled,
                  ]}>
                    {currentStep === 2 ? 'Continue' : 'Next'}
                  </Text>
                  <ChevronRight 
                    size={20} 
                    color={canProceed() ? '#FFFFFF' : '#666666'} 
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333333',
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: '#00E6E6',
  },
  stepCounter: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  stepIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#9A9A9A',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 32,
  },
  textInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    minHeight: 120,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: '#00E6E6',
    backgroundColor: '#1A2A2A',
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E0E0E0',
    marginBottom: 4,
  },
  selectedOptionText: {
    color: '#00E6E6',
  },
  optionSubtext: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  selectedOptionSubtext: {
    color: '#66B3B3',
  },
  customOptionCard: {
    minHeight: 80,
  },
  customTimeInput: {
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#00E6E6',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  nextButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 8,
  },
  nextButtonTextDisabled: {
    color: '#666666',
  },
});