import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Bot, User } from 'lucide-react-native';
import { useAmbition } from '../hooks/ambition-store'

interface Message {
  id: string;
  text: string;
  isAI: boolean;
  timestamp: Date;
}

const initialQuestions = [
  "Do you already have skills that could help you with this goal?",
  "Have you tried working toward this before? If yes, what happened?",
  "Do you have any relevant background, education, or experience?",
  "Is there anyone in your network who might support or mentor you?",
  "What do you think could stop you from achieving this?",
  "How do you personally think you could reach this goal?",
];

export default function QuestionsScreen() {
  const { goal, addAnswer } = useAmbition();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Add welcome message and first question
    const welcomeMessage: Message = {
      id: 'welcome',
      text: `Great! I'd like to learn more about your goal: "${goal}". Let me ask you a few questions to create the perfect roadmap for you.`,
      isAI: true,
      timestamp: new Date(),
    };

    const firstQuestion: Message = {
      id: 'q1',
      text: initialQuestions[0],
      isAI: true,
      timestamp: new Date(),
    };

    setMessages([welcomeMessage, firstQuestion]);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [goal, fadeAnim]);

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;

    const inputText = currentInput.trim();
    
    // Clear input immediately on Android to prevent text persistence
    if (Platform.OS === 'android') {
      setCurrentInput('');
    }

    // Dismiss keyboard after sending
    Keyboard.dismiss();

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: inputText,
      isAI: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    addAnswer(inputText);
    
    // Clear input for iOS after state updates
    if (Platform.OS !== 'android') {
      setCurrentInput('');
    }
    
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const nextQuestionIndex = currentQuestionIndex + 1;
      
      if (nextQuestionIndex < initialQuestions.length) {
        const nextQuestion: Message = {
          id: `q${nextQuestionIndex + 1}`,
          text: initialQuestions[nextQuestionIndex],
          isAI: true,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, nextQuestion]);
        setCurrentQuestionIndex(nextQuestionIndex);
      } else {
        // All questions answered, show completion message
        const completionMessage: Message = {
          id: 'completion',
          text: "Perfect! I have all the information I need. Let me create your personalized roadmap now.",
          isAI: true,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, completionMessage]);
        
        // Navigate to generation screen after a short delay
        setTimeout(() => {
          // Force navigation on Android with replace to prevent back navigation issues
          if (Platform.OS === 'android') {
            router.replace('/generating');
          } else {
            router.push('/generating');
          }
        }, 2000);
      }
      
      setIsTyping(false);
    }, 1500);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = (message: Message) => (
    <Animated.View
      key={message.id}
      style={[
        styles.messageContainer,
        message.isAI ? styles.aiMessageContainer : styles.userMessageContainer,
      ]}
    >
      <View style={styles.messageHeader}>
        <View style={[
          styles.avatarContainer,
          message.isAI ? styles.aiAvatar : styles.userAvatar,
        ]}>
          {message.isAI ? (
            <Bot size={16} color="#FFFFFF" />
          ) : (
            <User size={16} color="#FFFFFF" />
          )}
        </View>
        <Text style={styles.senderName}>
          {message.isAI ? 'Ambitionly AI' : 'You'}
        </Text>
      </View>
      
      <View style={[
        styles.messageBubble,
        message.isAI ? styles.aiMessageBubble : styles.userMessageBubble,
      ]}>
        <Text style={[
          styles.messageText,
          message.isAI ? styles.aiMessageText : styles.userMessageText,
        ]}>
          {message.text}
        </Text>
      </View>
    </Animated.View>
  );

  return (
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
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.innerContainer}>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Goal Analysis</Text>
                <Text style={styles.headerSubtitle}>
                  {currentQuestionIndex + 1} of {initialQuestions.length} questions
                </Text>
              </View>

              <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.messagesContainer}
                  contentContainerStyle={styles.messagesContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {messages.map(renderMessage)}
                  
                  {isTyping && (
                    <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                      <View style={styles.messageHeader}>
                        <View style={[styles.avatarContainer, styles.aiAvatar]}>
                          <Bot size={16} color="#FFFFFF" />
                        </View>
                        <Text style={styles.senderName}>Ambitionly AI</Text>
                      </View>
                      <View style={[styles.messageBubble, styles.aiMessageBubble]}>
                        <View style={styles.typingIndicator}>
                          <View style={styles.typingDot} />
                          <View style={styles.typingDot} />
                          <View style={styles.typingDot} />
                        </View>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>

              <View style={styles.inputContainer}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type your answer..."
                    placeholderTextColor="#666666"
                    value={currentInput}
                    onChangeText={setCurrentInput}
                    multiline
                    maxLength={500}
                    returnKeyType="send"
                    blurOnSubmit={true}
                    onSubmitEditing={currentInput.trim() && !isTyping ? handleSendMessage : undefined}
                    {...Platform.select({
                      android: {
                        textAlignVertical: 'top',
                        underlineColorAndroid: 'transparent',
                        autoCorrect: false,
                        autoCapitalize: 'sentences',
                      },
                    })}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !currentInput.trim() && styles.sendButtonDisabled,
                    ]}
                    onPress={handleSendMessage}
                    disabled={!currentInput.trim() || isTyping}
                  >
                    <LinearGradient
                      colors={currentInput.trim() ? ['#29202b', '#8B5CF6', '#A855F7'] : ['#333333', '#333333']}
                      style={styles.sendButtonGradient}
                    >
                      <Send size={20} color={currentInput.trim() ? '#FFFFFF' : '#666666'} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  keyboardAvoidingContainer: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D2D',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9A9A9A',
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 24,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  aiAvatar: {
    backgroundColor: '#6C63FF',
  },
  userAvatar: {
    backgroundColor: '#FF6B6B',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9A9A9A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 20,
    padding: 16,
  },
  aiMessageBubble: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2D2D2D',
  },
  userMessageBubble: {
    backgroundColor: '#2D2D2D',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  aiMessageText: {
    color: '#E0E0E0',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666666',
  },
  inputContainer: {
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#2D2D2D',
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D2D2D',
    maxHeight: 100,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});