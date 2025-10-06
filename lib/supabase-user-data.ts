import { supabase } from './supabase';

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
        ...data,
        lastSyncAt: new Date().toISOString(),
        user_id: userId,
      };

      // Use upsert to either insert or update the user data
      const { error } = await supabase
        .from('user_data')
        .upsert(syncData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[Supabase User Data] Save error:', error);
        throw error;
      }

      console.log(`[Supabase User Data] Data saved successfully for user ${userId}`);
      
      return {
        success: true,
        lastSyncAt: syncData.lastSyncAt,
      };
    } catch (error) {
      console.error('[Supabase User Data] Save failed:', error);
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
          // No data found
          console.log(`[Supabase User Data] No data found for user ${userId}`);
          return null;
        }
        console.error('[Supabase User Data] Fetch error:', error);
        throw error;
      }

      console.log(`[Supabase User Data] Data retrieved for user ${userId}`);
      
      // Remove the user_id field from the returned data
      const { user_id, ...userData } = data;
      return userData as UserData;
    } catch (error) {
      console.error('[Supabase User Data] Fetch failed:', error);
      throw error;
    }
  }

  async clearUserData(userId: string): Promise<{ success: boolean; clearedAt: string }> {
    try {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('[Supabase User Data] Clear error:', error);
        throw error;
      }

      console.log(`[Supabase User Data] Data cleared for user ${userId}`);
      
      return {
        success: true,
        clearedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Supabase User Data] Clear failed:', error);
      throw error;
    }
  }

  async getUserDataBySupabaseId(supabaseUserId: string): Promise<UserData | null> {
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', supabaseUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[Supabase User Data] No data found for Supabase user ${supabaseUserId}`);
          return null;
        }
        console.error('[Supabase User Data] Fetch by Supabase ID error:', error);
        throw error;
      }

      console.log(`[Supabase User Data] Data retrieved for Supabase user ${supabaseUserId}`);
      
      const { user_id, ...userData } = data;
      return userData as UserData;
    } catch (error) {
      console.error('[Supabase User Data] Fetch by Supabase ID failed:', error);
      throw error;
    }
  }
}

export const supabaseUserDataService = SupabaseUserDataService.getInstance();
