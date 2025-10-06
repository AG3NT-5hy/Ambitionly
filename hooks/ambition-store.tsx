import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useRef, useCallback } from 'react';
import { httpRequest } from '@/lib/http';
import { useUi } from '@/providers/UiProvider';
import { AppError } from '@/lib/errors';
import { NotificationService } from '@/lib/notifications';
import { analytics } from '@/lib/analytics';

export interface Task {
  id: string;
  title: string;
  description: string;
  estimatedTime: string;
}

export interface TaskTimer {
  taskId: string;
  startTime: number;
  duration: number; // in minutes
  isActive: boolean;
  isCompleted: boolean;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  tasks: Task[];
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  milestones: Milestone[];
}

export interface Roadmap {
  id: string;
  goal: string;
  timeline: string;
  timeCommitment: string;
  phases: Phase[];
  createdAt: Date;
}

const STORAGE_KEYS = {
  GOAL: 'ambitionly_goal',
  TIMELINE: 'ambitionly_timeline',
  TIME_COMMITMENT: 'ambitionly_time_commitment',
  ANSWERS: 'ambitionly_answers',
  ROADMAP: 'ambitionly_roadmap',
  COMPLETED_TASKS: 'ambitionly_completed_tasks',
  STREAK_DATA: 'ambitionly_streak_data',
  TASK_TIMERS: 'ambitionly_task_timers',
};

export const [AmbitionProvider, useAmbition] = createContextHook(() => {
  const { showToast } = useUi();
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [goal, setGoalState] = useState<string>('');
  const [timeline, setTimelineState] = useState<string>('');
  const [timeCommitment, setTimeCommitmentState] = useState<string>('');
  const [answers, setAnswersState] = useState<string[]>([]);
  const [roadmap, setRoadmapState] = useState<Roadmap | null>(null);
  const [completedTasks, setCompletedTasksState] = useState<string[]>([]);
  const [streakData, setStreakDataState] = useState<{ lastCompletionDate: string; streak: number }>({
    lastCompletionDate: '',
    streak: 0,
  });
  const [taskTimers, setTaskTimersState] = useState<TaskTimer[]>([]);
  const previousTimerStates = useRef<Map<string, boolean>>(new Map());
  const notificationSentRef = useRef<Set<string>>(new Set());

  // Load data from storage on init
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Storage load timeout')), 5000);
        });
        
        const storagePromise = Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.GOAL),
          AsyncStorage.getItem(STORAGE_KEYS.TIMELINE),
          AsyncStorage.getItem(STORAGE_KEYS.TIME_COMMITMENT),
          AsyncStorage.getItem(STORAGE_KEYS.ANSWERS),
          AsyncStorage.getItem(STORAGE_KEYS.ROADMAP),
          AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_TASKS),
          AsyncStorage.getItem(STORAGE_KEYS.STREAK_DATA),
          AsyncStorage.getItem(STORAGE_KEYS.TASK_TIMERS),
        ]);
        
        const [
          storedGoal,
          storedTimeline,
          storedTimeCommitment,
          storedAnswers,
          storedRoadmap,
          storedCompletedTasks,
          storedStreakData,
          storedTaskTimers,
        ] = await Promise.race([storagePromise, timeoutPromise]) as string[];

        if (!isMounted) return;

        if (storedGoal) setGoalState(storedGoal);
        if (storedTimeline) setTimelineState(storedTimeline);
        if (storedTimeCommitment) setTimeCommitmentState(storedTimeCommitment);
        if (storedAnswers) {
          try {
            const parsed = JSON.parse(storedAnswers);
            setAnswersState(parsed);
          } catch (error) {
            console.error('Failed to parse stored answers:', error);
            console.error('Stored answers value:', storedAnswers?.substring(0, 100));
            setAnswersState([]);
          }
        }
        if (storedRoadmap) {
          try {
            const parsed = JSON.parse(storedRoadmap);
            setRoadmapState(parsed);
          } catch (error) {
            console.error('Failed to parse stored roadmap:', error);
            console.error('Stored roadmap value:', storedRoadmap?.substring(0, 100));
            setRoadmapState(null);
          }
        }
        if (storedCompletedTasks) {
          try {
            const parsed = JSON.parse(storedCompletedTasks);
            setCompletedTasksState(parsed);
          } catch (error) {
            console.error('Failed to parse stored completed tasks:', error);
            console.error('Stored completed tasks value:', storedCompletedTasks?.substring(0, 100));
            setCompletedTasksState([]);
          }
        }
        if (storedStreakData) {
          try {
            const parsed = JSON.parse(storedStreakData);
            setStreakDataState(parsed);
          } catch (error) {
            console.error('Failed to parse stored streak data:', error);
            console.error('Stored streak data value:', storedStreakData?.substring(0, 100));
            setStreakDataState({ lastCompletionDate: '', streak: 0 });
          }
        }
        if (storedTaskTimers) {
          try {
            const parsed = JSON.parse(storedTaskTimers);
            setTaskTimersState(parsed);
          } catch (error) {
            console.error('Failed to parse stored task timers:', error);
            console.error('Stored task timers value:', storedTaskTimers?.substring(0, 100));
            setTaskTimersState([]);
          }
        }
        
        setIsHydrated(true);
      } catch (error) {
        console.error('Error loading stored data:', error);
        if (isMounted) {
          setIsHydrated(true); // Still mark as hydrated even on error
        }
      }
    };
    
    // Add a fallback timeout to ensure hydration completes
    const fallbackTimeout = setTimeout(() => {
      if (isMounted && !isHydrated) {
        console.warn('Hydration timeout, marking as hydrated');
        setIsHydrated(true);
      }
    }, 3000);
    
    loadData();
    
    return () => {
      isMounted = false;
      clearTimeout(fallbackTimeout);
    };
  }, [isHydrated]);

  // Monitor timer completion and send notifications
  useEffect(() => {
    if (!isHydrated || !roadmap) return;

    const checkTimerCompletion = () => {
      taskTimers.forEach(timer => {
        if (!timer.isActive || timer.isCompleted) return;

        const wasComplete = previousTimerStates.current.get(timer.taskId) || false;
        const isNowComplete = isTaskTimerComplete(timer.taskId);
        const notificationKey = `${timer.taskId}-${timer.startTime}`;

        // If timer just completed and we haven't sent a notification for this timer instance
        if (!wasComplete && isNowComplete && !notificationSentRef.current.has(notificationKey)) {
          console.log(`[Notifications] Timer completed for task ${timer.taskId}`);
          
          // Find the task title for the notification
          let taskTitle = 'Task';
          if (roadmap?.phases) {
            for (const phase of roadmap.phases) {
              for (const milestone of phase.milestones) {
                const task = milestone.tasks.find(t => t.id === timer.taskId);
                if (task) {
                  taskTitle = task.title;
                  break;
                }
              }
              if (taskTitle !== 'Task') break;
            }
          }

          // Send notification
          NotificationService.scheduleTaskCompleteNotification(taskTitle);
          
          // Mark notification as sent for this timer instance
          notificationSentRef.current.add(notificationKey);
          
          console.log(`[Notifications] Notification sent for completed task: ${taskTitle}`);
        }

        // Update previous state
        previousTimerStates.current.set(timer.taskId, isNowComplete);
      });
    };

    // Check immediately
    checkTimerCompletion();

    // Set up interval to check every second
    const interval = setInterval(checkTimerCompletion, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [taskTimers, isHydrated, roadmap]);



  const setGoal = async (newGoal: string) => {
    // Input validation and sanitization
    if (!newGoal || typeof newGoal !== 'string') {
      console.warn('Invalid goal provided');
      return;
    }
    const sanitized = newGoal.trim().slice(0, 500);
    if (!sanitized) {
      console.warn('Goal cannot be empty after sanitization');
      return;
    }
    setGoalState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.GOAL, sanitized);
  };

  const setTimeline = async (newTimeline: string) => {
    // Input validation and sanitization
    if (!newTimeline || typeof newTimeline !== 'string') {
      console.warn('Invalid timeline provided');
      return;
    }
    const sanitized = newTimeline.trim().slice(0, 100);
    if (!sanitized) {
      console.warn('Timeline cannot be empty after sanitization');
      return;
    }
    setTimelineState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.TIMELINE, sanitized);
  };

  const setTimeCommitment = async (newTimeCommitment: string) => {
    // Input validation and sanitization
    if (!newTimeCommitment || typeof newTimeCommitment !== 'string') {
      console.warn('Invalid time commitment provided');
      return;
    }
    const sanitized = newTimeCommitment.trim().slice(0, 100);
    if (!sanitized) {
      console.warn('Time commitment cannot be empty after sanitization');
      return;
    }
    setTimeCommitmentState(sanitized);
    await AsyncStorage.setItem(STORAGE_KEYS.TIME_COMMITMENT, sanitized);
  };

  const addAnswer = async (answer: string) => {
    // Input validation and sanitization
    if (!answer || typeof answer !== 'string') {
      console.warn('Invalid answer provided');
      return;
    }
    const sanitized = answer.trim().slice(0, 1000);
    if (!sanitized) {
      console.warn('Answer cannot be empty after sanitization');
      return;
    }
    const newAnswers = [...answers, sanitized];
    setAnswersState(newAnswers);
    await AsyncStorage.setItem(STORAGE_KEYS.ANSWERS, JSON.stringify(newAnswers));
  };

  const inferIndustry = (g: string, contextAnswers: string[]): string => {
    const text = [g, ...contextAnswers].join(' ').toLowerCase();
    const pairs: Array<{ key: string; industry: string; synonyms: string[] }> = [
      { key: 'qsr', industry: 'Quick-Service Restaurants (Fast Food)', synonyms: ['mcdonald', 'burger king', 'wendy', 'kfc', 'taco bell', 'chipotle', 'restaurant', 'shift', 'food service', 'barista', 'server'] },
      { key: 'retail', industry: 'Retail & Store Operations', synonyms: ['retail', 'store', 'cashier', 'target', 'walmart', 'merchandising', 'pos', 'inventory'] },
      { key: 'software', industry: 'Software Engineering', synonyms: ['software', 'developer', 'engineering', 'react', 'frontend', 'backend', 'api', 'sprint', 'jira', 'github'] },
      { key: 'sales', industry: 'Sales & SDR/AE', synonyms: ['sales', 'sdr', 'ae', 'quota', 'crm', 'salesforce', 'pipeline', 'demo', 'outreach'] },
      { key: 'marketing', industry: 'Marketing & Content', synonyms: ['marketing', 'seo', 'sem', 'content', 'copy', 'campaign', 'hubspot'] },
      { key: 'design', industry: 'Product Design & UX', synonyms: ['design', 'figma', 'ux', 'ui', 'prototype'] },
      { key: 'healthcare', industry: 'Healthcare & Nursing', synonyms: ['nurse', 'healthcare', 'clinic', 'patient', 'hospital', 'rn', 'cna'] },
      { key: 'education', industry: 'Education & Teaching', synonyms: ['teacher', 'education', 'classroom', 'curriculum', 'students'] },
      { key: 'finance', industry: 'Finance & Accounting', synonyms: ['finance', 'accounting', 'fp&a', 'bookkeeping', 'quickbooks', 'excel model'] },
      { key: 'operations', industry: 'Operations & Logistics', synonyms: ['operations', 'ops', 'logistics', 'warehouse', 'supply', 'shift report'] },
      { key: 'fitness', industry: 'Fitness & Coaching', synonyms: ['fitness', 'trainer', 'coaching', 'workout', 'nutrition'] },
    ];

    for (const p of pairs) {
      if (p.synonyms.some(s => text.includes(s))) return p.industry;
    }
    return 'General Professional Development';
  };

  const generateRoadmap = async () => {
    try {
      console.log('Generating roadmap with AI...');
      
      // Validate required data before making API call
      if (!goal || !timeline || !timeCommitment) {
        throw new Error('Missing required data: goal, timeline, or timeCommitment');
      }
      
      // Input sanitization
      const sanitizedGoal = goal.trim().slice(0, 500); // Limit goal length
      const sanitizedTimeline = timeline.trim();
      const sanitizedTimeCommitment = timeCommitment.trim();
      const sanitizedAnswers = answers.map(answer => answer.trim().slice(0, 1000)); // Limit answer length
      
      if (!sanitizedGoal || !sanitizedTimeline || !sanitizedTimeCommitment) {
        throw new Error('Invalid input data after sanitization');
      }
      
      const constraints = [
        '3-4 phases (short, mid, long-term)',
        '2-3 milestones per phase',
        '3-5 tasks per milestone',
        'Tasks must be concrete, observable, and context-based with immediate actionable steps',
        'Each task begins with an action verb and includes a clear deliverable or outcome',
        'Each task includes an estimatedTime like "5 min", "10 min", "25 min", "45 min", or "1.5 h"',
        'CRITICAL: The very first task must be 5-10 minutes and immediately actionable (no research, no "identify" tasks)',
        'First 3-5 tasks should be quick wins: "5 min", "8 min", "10 min", "12 min", "15 min" maximum',
        'First tasks should be concrete actions like: create a document, send a message, book a meeting, complete a specific module',
        'Gradually increase task duration as the user progresses through the roadmap',
        'Avoid vague phrases like "identify resources", "learn skills", "research", "explore" in early tasks',
        'Replace generic tasks with specific actions: instead of "research X" use "find 3 specific Y resources and bookmark them"',
        'Prefer specific vendors, programs, or artifacts when possible (company LMS course names, specific templates, exact meeting types)',
        'Bias all content to the given industry; name typical SOPs, certifications, checklists, meeting cadences, and tools for that industry',
        'Make tasks progressively build on each other - each task should use outputs from previous tasks',
        'Include specific deliverables: documents to create, people to contact, courses to complete, templates to fill out',
      ].join('\n- ');

      const examples = `Examples of GOOD first tasks (5-15 min):\n- Create a Google Doc titled "[Goal] Progress Tracker" with sections for phases, milestones, and weekly wins (8 min)\n- Send a Slack message to your manager requesting a 20-min goal alignment meeting this week (5 min)\n- Complete the onboarding quiz for [Specific Course Name] in the company LMS and screenshot your score (10 min)\n- Book a 30-min coffee chat with [Specific Senior Colleague] using Calendly link from their Slack profile (7 min)\n- Download and fill out the first page of the [Industry-Specific Template] from the shared drive (12 min)\n\nExamples of GOOD longer tasks (20+ min):\n- Complete the McDonald's Shift Management 101 course in the LMS (Module 1–3) — take notes on scheduling rules (45 min)\n- Shadow senior manager Jamie M. for one full lunch shift; capture 5 observations on queue management (3 h)\n- Draft the Q2 shift handover template in Google Docs using the Ops template v2; share with Alex for comments (60 min)\n\nExamples of BAD first tasks (too vague/long):\n- Research available resources (vague)\n- Learn about industry best practices (vague)\n- Identify potential mentors (vague)\n- Complete comprehensive training program (too long)`;

      const industry = inferIndustry(sanitizedGoal, sanitizedAnswers);

      const prompt = `Create a production-ready, specific roadmap for this goal: "${sanitizedGoal}"\n\nTimeline: ${sanitizedTimeline}\nDaily time commitment: ${sanitizedTimeCommitment}\nIndustry: ${industry}\n\nAdditional user context:\n${sanitizedAnswers.map((answer, index) => `${index + 1}. ${answer}`).join('\n')}\n\nTime commitment analysis:\n- The user can dedicate ${sanitizedTimeCommitment} to this goal\n- Design tasks and milestones that fit within this daily time constraint\n- Consider cumulative progress over days/weeks based on this daily commitment\n- Ensure realistic pacing that accounts for daily availability\n\nIndustry guidance:\n- Ground tasks in ${industry}. If a company is mentioned (e.g., McDonald's), reference realistic internal artifacts (LMS courses, SOP names, checklists) when reasonable.\n- Prefer concrete tools used in this industry (e.g., QSR: shift logs, food safety checklists; Retail: planograms, POS audits; Software: Jira tickets, PRs).\n\nCRITICAL FIRST TASK REQUIREMENTS:\n- The very first task MUST be 5-10 minutes and immediately actionable\n- NO research, identification, or exploration tasks as the first task\n- First task should create something concrete (document, message, booking) or complete something specific (quiz, form, download)\n- First task should set up infrastructure for the goal (tracking doc, calendar invite, course enrollment)\n\nTask progression strategy:\n- Tasks 1-3: Quick setup and momentum builders (5-15 min each)\n- Tasks 4-8: Foundation building with specific deliverables (15-45 min each)\n- Later tasks: Deeper work and skill building (45 min - 2 hours)\n\nStrict requirements:\n- ${constraints}\n\n${examples}\n\nOutput ONLY valid JSON matching exactly this schema (no extra text):\n{\n  "phases": [\n    {\n      "title": "string",\n      "description": "string",\n      "milestones": [\n        {\n          "title": "string",\n          "description": "string",\n          "tasks": [\n            {\n              "title": "string",\n              "description": "string",\n              "estimatedTime": "string"\n            }\n          ]\n        }\n      ]\n    }\n  ]\n}`;

      // Add timeout and retry logic with rate limiting
      const req = await httpRequest<{ completion: string }>('https://toolkit.rork.com/text/llm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are an elite execution coach. Produce concrete, measurable, company-context tasks with action verbs, artifacts, and durations. Consider the user\'s daily time commitment when designing tasks and pacing. No generic advice. Output valid JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
        timeoutMs: 45000,
        retry: { retries: 3, factor: 2, minTimeoutMs: 500, maxTimeoutMs: 5000 },
        parseJson: true,
      });

      if (!req.ok) {
        throw req.error ?? new Error('Failed request');
      }

      const data = req.data as { completion: string };
      let roadmapData;

      try {
        // Try to parse the AI response as JSON
        let cleanedResponse: string = String(data.completion ?? '');

        // Normalize smart quotes and stray characters
        cleanedResponse = cleanedResponse
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/\u0000/g, '')
          .trim();
        
        // Remove markdown code blocks
        cleanedResponse = cleanedResponse.replace(/```json\n?|```/g, '');
        
        // Try to extract JSON from the response if it's wrapped in text
        const start = cleanedResponse.indexOf('{');
        const end = cleanedResponse.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          cleanedResponse = cleanedResponse.slice(start, end + 1);
        }
        
        console.log('Attempting to parse AI response:', cleanedResponse.substring(0, 200) + '...');
        roadmapData = JSON.parse(cleanedResponse);
        
        // Validate the structure
        if (!roadmapData.phases || !Array.isArray(roadmapData.phases)) {
          throw new Error('Invalid roadmap structure: missing phases array');
        }
        
        console.log('Successfully parsed AI response');
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', data.completion);
        // Fallback roadmap if AI response is malformed
        roadmapData = createFallbackRoadmap(goal);
      }

      // Add IDs to the roadmap structure
      const processedRoadmap: Roadmap = {
        id: `roadmap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal: sanitizedGoal,
        timeline: sanitizedTimeline,
        timeCommitment: sanitizedTimeCommitment,
        phases: roadmapData.phases.map((phase: any, phaseIndex: number) => ({
          id: `phase-${phaseIndex}`,
          title: phase.title,
          description: phase.description,
          milestones: phase.milestones.map((milestone: any, milestoneIndex: number) => ({
            id: `milestone-${phaseIndex}-${milestoneIndex}`,
            title: milestone.title,
            description: milestone.description,
            tasks: milestone.tasks.map((task: any, taskIndex: number) => ({
              id: `task-${phaseIndex}-${milestoneIndex}-${taskIndex}`,
              title: task.title,
              description: task.description,
              estimatedTime: task.estimatedTime,
            })),
          })),
        })),
        createdAt: new Date(),
      };

      setRoadmapState(processedRoadmap);
      await AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, JSON.stringify(processedRoadmap));
      
      // Clear all existing timers when generating a new roadmap
      console.log('[Ambition] Clearing existing timers for new roadmap');
      setTaskTimersState([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS);
      
      console.log('Roadmap generated successfully');
      analytics.trackRoadmapGenerated(sanitizedGoal, sanitizedTimeline, sanitizedTimeCommitment);
    } catch (error) {
      console.error('Error generating roadmap:', error);
      const msg = error instanceof AppError ? error.message : (error as Error)?.message ?? 'Unexpected error';
      showToast(`Generation failed: ${msg}`, 'error');
      // Use fallback roadmap on error - use original values as fallback
      const fallbackRoadmap = createFallbackRoadmap(goal);
      const processedRoadmap: Roadmap = {
        id: `roadmap_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goal,
        timeline,
        timeCommitment,
        phases: fallbackRoadmap.phases.map((phase: any, phaseIndex: number) => ({
          id: `phase-${phaseIndex}`,
          title: phase.title,
          description: phase.description,
          milestones: phase.milestones.map((milestone: any, milestoneIndex: number) => ({
            id: `milestone-${phaseIndex}-${milestoneIndex}`,
            title: milestone.title,
            description: milestone.description,
            tasks: milestone.tasks.map((task: any, taskIndex: number) => ({
              id: `task-${phaseIndex}-${milestoneIndex}-${taskIndex}`,
              title: task.title,
              description: task.description,
              estimatedTime: task.estimatedTime,
            })),
          })),
        })),
        createdAt: new Date(),
      };

      setRoadmapState(processedRoadmap);
      await AsyncStorage.setItem(STORAGE_KEYS.ROADMAP, JSON.stringify(processedRoadmap));
      
      // Clear all existing timers when generating a new roadmap (fallback case)
      console.log('[Ambition] Clearing existing timers for new roadmap (fallback)');
      setTaskTimersState([]);
      await AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS);
    }
  };

  const createFallbackRoadmap = (g: string) => ({
    phases: [
      {
        title: 'Foundation Phase',
        description: 'Set up tracking and get quick wins to build momentum',
        milestones: [
          {
            title: 'Quick Setup',
            description: 'Create tracking infrastructure and get immediate clarity',
            tasks: [
              {
                title: 'Create progress tracking document',
                description: `Create a Google Doc titled "${g || 'Goal'} - Progress Tracker" with sections for weekly wins, challenges, and next steps`,
                estimatedTime: '8 min',
              },
              {
                title: 'Send alignment message to manager',
                description: 'Send a Slack/email to your manager: "Hi [Name], I\'m working on [goal]. Can we schedule 20 min this week to align on success criteria?"',
                estimatedTime: '5 min',
              },
              {
                title: 'Define 3 success indicators',
                description: 'Write 3 specific evidence points that will prove progress (e.g., course certificate, shipped project, positive feedback)',
                estimatedTime: '10 min',
              },
            ],
          },
          {
            title: 'Resources Setup',
            description: 'Assemble concrete tools and templates you will use',
            tasks: [
              {
                title: 'Create a single tracking doc',
                description: `Open a Google Doc named "Ambitionly Roadmap — ${g || 'Goal'}" with sections: Phases, Milestones, Tasks, Evidence`,
                estimatedTime: '12 min',
              },
              {
                title: 'Pick one primary course/resource',
                description: 'Search your company LMS or Coursera and paste 1 course link into the doc; add module list and target dates',
                estimatedTime: '15 min',
              },
              {
                title: 'Identify a shadow/mentor opportunity',
                description: 'DM one senior colleague to request a 2‑hour shadow session; propose two time windows',
                estimatedTime: '7 min',
              },
            ],
          },
        ],
      },
      {
        title: 'Skill and Exposure Phase',
        description: 'Build capability through consistent daily practice and visible artifacts',
        milestones: [
          {
            title: 'Structured Learning',
            description: 'Complete a concrete course/module and capture takeaways',
            tasks: [
              {
                title: 'Complete course Module 1–2',
                description: 'Finish two modules of your selected course and summarize 5 bullet takeaways in the tracking doc',
                estimatedTime: '90 min',
              },
              {
                title: 'Apply one tactic on the job',
                description: 'Pick one concept from the course and implement it in a real scenario; capture before/after notes',
                estimatedTime: '45 min',
              },
              {
                title: 'Share a learning recap',
                description: 'Post a short update in team chat with 3 insights and 1 question; link the doc',
                estimatedTime: '20 min',
              },
            ],
          },
          {
            title: 'Shadow and Feedback',
            description: 'Observe an expert and collect structured notes',
            tasks: [
              {
                title: 'Shadow a senior for one shift/session',
                description: 'Observe a full 2–3 hour block; log 5 process observations and 2 scripts they use',
                estimatedTime: '3 h',
              },
              {
                title: 'Ask 3 targeted questions',
                description: 'After shadowing, ask about their decision criteria, trade-offs, and top mistake to avoid; document answers',
                estimatedTime: '20 min',
              },
              {
                title: 'Draft an improved template/process',
                description: 'Create or refine one template/checklist used in your role and share for feedback',
                estimatedTime: '60 min',
              },
            ],
          },
        ],
      },
      {
        title: 'Execution Phase',
        description: 'Ship measurable outputs through sustained daily effort',
        milestones: [
          {
            title: 'Own a recurring responsibility',
            description: 'Take ownership of deliverables through consistent daily contributions',
            tasks: [
              {
                title: 'Run this week’s deliverable solo',
                description: 'Own the full cycle (prep → execution → report); collect feedback from your lead',
                estimatedTime: '2 h',
              },
              {
                title: 'Publish a one-page summary',
                description: 'Share outcomes and metrics in a one-pager to stakeholders; ask for one improvement suggestion',
                estimatedTime: '45 min',
              },
              {
                title: 'Schedule a calibration check-in',
                description: 'Book a 20‑min review with your manager to assess readiness against criteria; record next steps',
                estimatedTime: '20 min',
              },
            ],
          },
        ],
      },
    ],
  });

  // Helper function to parse time string to minutes
  const parseTimeToMinutes = (timeStr: string): number => {
    console.log(`[Timer] Parsing time string: "${timeStr}"`);
    
    // Handle different time formats
    const lowerTime = timeStr.toLowerCase().trim();
    let estimatedMinutes: number;
    
    if (lowerTime.includes('h')) {
      // Handle hours (e.g., "1.5 h", "2 h")
      const hourMatch = lowerTime.match(/([0-9.]+)\s*h/);
      if (hourMatch) {
        const hours = parseFloat(hourMatch[1]);
        estimatedMinutes = Math.round(hours * 60);
      } else {
        estimatedMinutes = 60; // default to 1 hour
      }
    } else if (lowerTime.includes('min')) {
      // Handle minutes (e.g., "45 min", "30 min")
      const minMatch = lowerTime.match(/([0-9]+)\s*min/);
      if (minMatch) {
        estimatedMinutes = parseInt(minMatch[1]);
      } else {
        estimatedMinutes = 30; // default to 30 minutes
      }
    } else {
      // Try to extract any number and assume it's minutes
      const numberMatch = lowerTime.match(/([0-9]+)/);
      if (numberMatch) {
        estimatedMinutes = parseInt(numberMatch[1]);
      } else {
        estimatedMinutes = 30; // default to 30 minutes
      }
    }
    
    console.log(`[Timer] Parsed "${timeStr}" to ${estimatedMinutes} minutes`);
    return estimatedMinutes;
  };

  const startTaskTimer = async (taskId: string, estimatedTime: string) => {
    console.log(`[Timer] Starting timer for task ${taskId} with estimated time: ${estimatedTime}`);
    
    // Stop any existing active timers for other tasks
    const updatedExistingTimers = taskTimers.map(timer => {
      if (timer.isActive && timer.taskId !== taskId) {
        console.log(`[Timer] Stopping existing timer for task ${timer.taskId}`);
        return { ...timer, isActive: false };
      }
      return timer;
    });
    
    const duration = parseTimeToMinutes(estimatedTime);
    const newTimer: TaskTimer = {
      taskId,
      startTime: Date.now(),
      duration,
      isActive: true,
      isCompleted: false,
    };
    
    console.log(`[Timer] Created new timer:`, newTimer);

    // Remove any existing timer for this task and add the new one
    const updatedTimers = updatedExistingTimers.filter(t => t.taskId !== taskId).concat(newTimer);
    setTaskTimersState(updatedTimers);
    await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(updatedTimers));
    
    console.log(`[Timer] Timer started successfully for task ${taskId}`);
    analytics.track('task_started', { task_id: taskId, duration_minutes: duration });
  };

  const getTaskTimer = (taskId: string): TaskTimer | null => {
    return taskTimers.find(t => t.taskId === taskId) || null;
  };

  const isTaskTimerComplete = (taskId: string): boolean => {
    const timer = getTaskTimer(taskId);
    if (!timer || !timer.isActive) return false;
    
    const elapsed = Date.now() - timer.startTime;
    const requiredTime = timer.duration * 60 * 1000; // convert to milliseconds
    return elapsed >= requiredTime;
  };

  const getTaskTimerProgress = (taskId: string): { elapsed: number; total: number; percentage: number } => {
    const timer = getTaskTimer(taskId);
    if (!timer || !timer.isActive) {
      return { elapsed: 0, total: 0, percentage: 0 };
    }
    
    const elapsed = Math.max(0, Date.now() - timer.startTime);
    const total = timer.duration * 60 * 1000; // convert to milliseconds
    const percentage = Math.min(100, (elapsed / total) * 100);
    
    console.log(`[Timer Progress] TaskId: ${taskId}, Duration: ${timer.duration}min, Elapsed: ${elapsed}ms, Total: ${total}ms, Percentage: ${percentage}%`);
    
    return { elapsed, total, percentage };
  };

  const toggleTask = async (taskId: string) => {
    // Check if timer is required and completed
    const timer = getTaskTimer(taskId);
    const isTimerRequired = timer && timer.isActive;
    const isTimerCompleted = isTaskTimerComplete(taskId);
    
    // If timer is active but not completed, don't allow toggle
    if (isTimerRequired && !isTimerCompleted) {
      return false; // Return false to indicate toggle was not allowed
    }

    const newCompletedTasks = completedTasks.includes(taskId)
      ? completedTasks.filter(id => id !== taskId)
      : [...completedTasks, taskId];
    
    setCompletedTasksState(newCompletedTasks);
    await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_TASKS, JSON.stringify(newCompletedTasks));

    // Mark timer as completed if it exists
    if (timer && !completedTasks.includes(taskId)) {
      const updatedTimers = taskTimers.map(t => 
        t.taskId === taskId ? { ...t, isCompleted: true, isActive: false } : t
      );
      setTaskTimersState(updatedTimers);
      await AsyncStorage.setItem(STORAGE_KEYS.TASK_TIMERS, JSON.stringify(updatedTimers));
    }

    // Update streak if task was completed (not uncompleted)
    if (!completedTasks.includes(taskId)) {
      await updateStreak();
      analytics.trackTaskCompleted(taskId, timer ? Date.now() - timer.startTime : 0);
    }
    
    return true; // Return true to indicate toggle was successful
  };

  const updateStreak = async () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    let newStreak = 1;
    
    if (streakData.lastCompletionDate === yesterday) {
      // Continuing streak
      newStreak = streakData.streak + 1;
    } else if (streakData.lastCompletionDate === today) {
      // Already completed today, keep current streak
      newStreak = streakData.streak;
    }
    // If last completion was more than 1 day ago, streak resets to 1

    const newStreakData = {
      lastCompletionDate: today,
      streak: newStreak,
    };

    setStreakDataState(newStreakData);
    await AsyncStorage.setItem(STORAGE_KEYS.STREAK_DATA, JSON.stringify(newStreakData));
    
    // Track streak achievement
    if (newStreak > 1) {
      analytics.trackStreakAchieved(newStreak);
    }
  };

  const getProgress = () => {
    if (!roadmap) return 0;
    
    const totalTasks = roadmap.phases.reduce((total, phase) => {
      return total + phase.milestones.reduce((milestoneTotal, milestone) => {
        return milestoneTotal + milestone.tasks.length;
      }, 0);
    }, 0);

    if (totalTasks === 0) return 0;
    
    return (completedTasks.length / totalTasks) * 100;
  };

  const getStreak = () => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
    
    // If last completion was today or yesterday, return current streak
    if (streakData.lastCompletionDate === today || streakData.lastCompletionDate === yesterday) {
      return streakData.streak;
    }
    
    // Otherwise, streak is broken
    return 0;
  };

  const getCompletedTasksThisWeek = () => {
    // This is a simplified version - in a real app, you'd track completion dates
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    // For now, return a portion of completed tasks as "this week"
    return Math.min(completedTasks.length, 7);
  };

  // Helper functions for progressive unlocking
  const isTaskUnlocked = (phaseIndex: number, milestoneIndex: number, taskIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First task of first milestone of first phase is always unlocked
    if (phaseIndex === 0 && milestoneIndex === 0 && taskIndex === 0) {
      return true;
    }
    
    // Check if previous task in same milestone is completed
    if (taskIndex > 0) {
      const previousTaskId = `task-${phaseIndex}-${milestoneIndex}-${taskIndex - 1}`;
      return completedTasks.includes(previousTaskId);
    }
    
    // Check if previous milestone in same phase is completed
    if (milestoneIndex > 0) {
      const previousMilestone = roadmap.phases[phaseIndex].milestones[milestoneIndex - 1];
      const allPreviousMilestoneTasks = previousMilestone.tasks.map((_, tIndex) => 
        `task-${phaseIndex}-${milestoneIndex - 1}-${tIndex}`
      );
      return allPreviousMilestoneTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    // Check if previous phase is completed
    if (phaseIndex > 0) {
      const previousPhase = roadmap.phases[phaseIndex - 1];
      const allPreviousPhaseTasks: string[] = [];
      
      previousPhase.milestones.forEach((milestone, mIndex) => {
        milestone.tasks.forEach((_, tIndex) => {
          allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
        });
      });
      
      return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    return false;
  };
  
  const isMilestoneUnlocked = (phaseIndex: number, milestoneIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First milestone of first phase is always unlocked
    if (phaseIndex === 0 && milestoneIndex === 0) {
      return true;
    }
    
    // Check if previous milestone in same phase is completed
    if (milestoneIndex > 0) {
      const previousMilestone = roadmap.phases[phaseIndex].milestones[milestoneIndex - 1];
      const allPreviousMilestoneTasks = previousMilestone.tasks.map((_, tIndex) => 
        `task-${phaseIndex}-${milestoneIndex - 1}-${tIndex}`
      );
      return allPreviousMilestoneTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    // Check if previous phase is completed
    if (phaseIndex > 0) {
      const previousPhase = roadmap.phases[phaseIndex - 1];
      const allPreviousPhaseTasks: string[] = [];
      
      previousPhase.milestones.forEach((milestone, mIndex) => {
        milestone.tasks.forEach((_, tIndex) => {
          allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
        });
      });
      
      return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
    }
    
    return false;
  };
  
  const isPhaseUnlocked = (phaseIndex: number): boolean => {
    if (!roadmap) return false;
    
    // First phase is always unlocked
    if (phaseIndex === 0) {
      return true;
    }
    
    // Check if previous phase is completed
    const previousPhase = roadmap.phases[phaseIndex - 1];
    const allPreviousPhaseTasks: string[] = [];
    
    previousPhase.milestones.forEach((milestone, mIndex) => {
      milestone.tasks.forEach((_, tIndex) => {
        allPreviousPhaseTasks.push(`task-${phaseIndex - 1}-${mIndex}-${tIndex}`);
      });
    });
    
    return allPreviousPhaseTasks.every(taskId => completedTasks.includes(taskId));
  };

  const resetProgress = async () => {
    try {
      console.log('[Ambition] resetProgress: clearing completed tasks, timers, and streak only');
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS),
      ]);
      setCompletedTasksState([]);
      setStreakDataState({ lastCompletionDate: '', streak: 0 });
      setTaskTimersState([]);
    } catch (error) {
      console.error('Error resetting progress:', error);
    }
    analytics.trackFeatureUsed('reset_progress');
  };

  const clearAllData = async () => {
    try {
      console.log('[Ambition] clearAllData: removing all persisted keys');
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.GOAL),
        AsyncStorage.removeItem(STORAGE_KEYS.TIMELINE),
        AsyncStorage.removeItem(STORAGE_KEYS.TIME_COMMITMENT),
        AsyncStorage.removeItem(STORAGE_KEYS.ANSWERS),
        AsyncStorage.removeItem(STORAGE_KEYS.ROADMAP),
        AsyncStorage.removeItem(STORAGE_KEYS.COMPLETED_TASKS),
        AsyncStorage.removeItem(STORAGE_KEYS.STREAK_DATA),
        AsyncStorage.removeItem(STORAGE_KEYS.TASK_TIMERS),
      ]);

      setGoalState('');
      setTimelineState('');
      setTimeCommitmentState('');
      setAnswersState([]);
      setRoadmapState(null);
      setCompletedTasksState([]);
      setStreakDataState({ lastCompletionDate: '', streak: 0 });
      setTaskTimersState([]);
    } catch (error) {
      console.error('Error clearing data:', error);
    }
    analytics.trackFeatureUsed('clear_data');
  };

  return {
    isHydrated,
    goal,
    timeline,
    timeCommitment,
    answers,
    roadmap,
    completedTasks,
    taskTimers,
    setGoal,
    setTimeline,
    setTimeCommitment,
    addAnswer,
    generateRoadmap,
    toggleTask,
    startTaskTimer,
    getTaskTimer,
    isTaskTimerComplete,
    getTaskTimerProgress,
    getProgress,
    getStreak,
    getCompletedTasksThisWeek,
    resetProgress,
    clearAllData,
    isTaskUnlocked,
    isMilestoneUnlocked,
    isPhaseUnlocked,
  };
});