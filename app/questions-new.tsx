import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, TouchableWithoutFeedback, Keyboard, Platform, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Target } from 'lucide-react-native';
import { useAmbition } from '../hooks/ambition-store'

const questions = [
  {
    id: 1,
    title: "Do you already have skills that could help you with this goal?",
    subtitle: "Tell us about your existing relevant skills",
    placeholder: "e.g., I have experience in project management, I've taken online courses in...",
  },
  {
    id: 2,
    title: "Have you tried working toward this before?",
    subtitle: "Share your previous attempts and what happened",
    placeholder: "e.g., I tried this 2 years ago but got busy with work, I started but didn't have a clear plan...",
  },
  {
    id: 3,
    title: "Do you have any relevant background or experience?",
    subtitle: "Describe your educational or professional background",
    placeholder: "e.g., I studied business in college, I work in a related field, I have 5 years experience in...",
  },
  {
    id: 4,
    title: "Is there anyone who might support or mentor you?",
    subtitle: "Think about your network and potential mentors",
    placeholder: "e.g., My manager is supportive, I have a friend who's done this, I can find mentors through...",
  },
  {
    id: 5,
    title: "What do you think could stop you from achieving this?",
    subtitle: "Identify potential obstacles or challenges",
    placeholder: "e.g., Time constraints, lack of resources, fear of failure, competing priorities...",
  },
  {
    id: 6,
    title: "How do you personally think you could reach this goal?",
    subtitle: "Share your initial thoughts on the approach",
    placeholder: "e.g., I think I need to start by learning X, then practice Y, and eventually...",
  },
];

export default function QuestionsScreen() {
  const { addAnswer } = useAmbition();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 200 : 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: Platform.OS === 'android' ? 200 : 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentQuestionIndex, slideAnim, fadeAnim]);

  const handleNext = () => {
    if (!answer.trim()) return;

    const answerText = answer.trim();
    const newAnswers = [...answers, answerText];
    setAnswers(newAnswers);
    addAnswer(answerText);

    // Clear answer immediately on Android
    if (Platform.OS === 'android') {
      setAnswer('');
    }

    if (currentQuestionIndex < questions.length - 1) {
      animateToNextQuestion();
    } else {
      // Use replace on Android to prevent navigation issues
      if (Platform.OS === 'android') {
        router.replace('/generating');
      } else {
        router.push('/generating');
      }
    }
  };

  const animateToNextQuestion = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: Platform.OS === 'android' ? 150 : 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 150 : 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // Clear answer for iOS after animation
      if (Platform.OS !== 'android') {
        setAnswer('');
      }
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: Platform.OS === 'android' ? 200 : 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: Platform.OS === 'android' ? 200 : 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const canProceed = () => answer.trim().length > 0;

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <LinearGradient
        colors={['#000000', '#29202B']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
          >
            <View style={styles.header}>
              <View style={styles.progressContainer}>
                {questions.map((question, index) => (
                  <View
                    key={question.id}
                    style={[
                      styles.progressDot,
                      index <= currentQuestionIndex && styles.progressDotActive,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.stepCounter}>
                {currentQuestionIndex + 1} of {questions.length}
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
              <View style={styles.questionHeader}>
                <View style={styles.iconContainer}>
                  <Target size={32} color="#00E6E6" />
                </View>
                <Text style={styles.questionTitle}>{currentQuestion.title}</Text>
                <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder={currentQuestion.placeholder}
                  placeholderTextColor="#666666"
                  value={answer}
                  onChangeText={setAnswer}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  accessibilityLabel={`Answer for: ${currentQuestion.title}`}
                  accessibilityHint="Enter your answer to this question"
                  maxLength={1000}
                  {...Platform.select({
                    android: {
                      underlineColorAndroid: 'transparent',
                      autoCorrect: false,
                      autoCapitalize: 'sentences',
                    },
                  })}
                />
              </View>
            </Animated.View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  !canProceed() && styles.nextButtonDisabled,
                ]}
                onPress={handleNext}
                disabled={!canProceed()}
                accessibilityLabel={currentQuestionIndex === questions.length - 1 ? 'Generate Roadmap' : 'Next Question'}
                accessibilityHint={currentQuestionIndex === questions.length - 1 ? 'Generate your personalized roadmap' : 'Go to next question'}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={canProceed() ? ['#29202b', '#8B5CF6', '#A855F7'] : ['#333333', '#333333']}
                  style={styles.nextButtonGradient}
                >
                  <Text style={[
                    styles.nextButtonText,
                    !canProceed() && styles.nextButtonTextDisabled,
                  ]}>
                    {currentQuestionIndex === questions.length - 1 ? 'Generate Roadmap' : 'Next'}
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
    paddingHorizontal: 24,
  },
  keyboardAvoiding: {
    flex: 1,
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
  },
  questionHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 230, 230, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
    paddingHorizontal: 20,
  },
  questionSubtitle: {
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
  footer: {
    paddingVertical: 24,
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