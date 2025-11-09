/**
 * Backend-only Supabase User Data Service
 * This version uses the backend Supabase client
 */

import { supabaseAdmin as supabase } from './supabase';

export interface UserData {
  goal?: string;
  timeline?: string;
  timeCommitment?: string;
  answers?: string[];
  roadmap?: any;
  completedTasks?: string[];
  streakData?: {
    lastCompletionDate: string;
    streak: number;
  };
  taskTimers?: any[];
  lastSyncAt?: string;
}

export class SupabaseUserDataService {
  private static instance: SupabaseUserDataService;
  
  public static getInstance(): SupabaseUserDataService {
    if (!SupabaseUserDataService.instance) {
      SupabaseUserDataService.instance = new SupabaseUserDataService();
    }
    return SupabaseUserDataService.instance;
  }

  async saveUserData(userId: string, data: UserData): Promise<{ success: boolean; lastSyncAt: string }> {
    try {
      const syncData = {
        goal: data.goal || null,
        timeline: data.timeline || null,
        time_commitment: data.timeCommitment || null,
        answers: data.answers ? JSON.stringify(data.answers) : null,
        roadmap: data.roadmap ? JSON.stringify(data.roadmap) : null,
        completed_tasks: data.completedTasks ? JSON.stringify(data.completedTasks) : null,
        streak_data: data.streakData ? JSON.stringify(data.streakData) : null,
        task_timers: data.taskTimers ? JSON.stringify(data.taskTimers) : null,
        last_sync_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_data')
        .upsert({
          user_id: userId,
          ...syncData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[SupabaseUserData] Error saving user data:', error);
        throw error;
      }

      return {
        success: true,
        lastSyncAt: syncData.last_sync_at,
      };
    } catch (error) {
      console.error('[SupabaseUserData] Error in saveUserData:', error);
      throw error;
    }
  }

  async getUserData(userId: string): Promise<UserData | null> {
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          return null;
        }
        console.error('[SupabaseUserData] Error fetching user data:', error);
        throw error;
      }

      if (!data) {
        return null;
      }

      return {
        goal: data.goal || undefined,
        timeline: data.timeline || undefined,
        timeCommitment: data.time_commitment || undefined,
        answers: data.answers ? JSON.parse(data.answers) : undefined,
        roadmap: data.roadmap ? JSON.parse(data.roadmap) : undefined,
        completedTasks: data.completed_tasks ? JSON.parse(data.completed_tasks) : undefined,
        streakData: data.streak_data ? JSON.parse(data.streak_data) : undefined,
        taskTimers: data.task_timers ? JSON.parse(data.task_timers) : undefined,
        lastSyncAt: data.last_sync_at || undefined,
      };
    } catch (error) {
      console.error('[SupabaseUserData] Error in getUserData:', error);
      throw error;
    }
  }

  async deleteUserData(userId: string): Promise<{ success: boolean }> {
    try {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[SupabaseUserData] Error deleting user data:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('[SupabaseUserData] Error in deleteUserData:', error);
      throw error;
    }
  }
}

export const supabaseUserDataService = SupabaseUserDataService.getInstance();

