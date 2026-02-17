import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class LovableService {
    private supabase: SupabaseClient;

    constructor(projectUrl: string, anonKey: string) {
        this.supabase = createClient(projectUrl, anonKey);
    }

    async validateConnection(): Promise<boolean> {
        try {
            const { error } = await this.supabase.from('clients').select('id').limit(1);
            if (error && error.code === 'PGRST116') return true;
            return !error;
        } catch (e) {
            console.error("Supabase connection invalid", e);
            return false;
        }
    }

    async fetchActiveClients() {
        const { data, error } = await this.supabase
            .from("clients")
            .select("*")
            .eq("is_active", true);
        if (error) throw error;
        return data || [];
    }

    async fetchAllTasks(userId?: string) {
        console.log("Fetching all tasks for user:", userId);

        let query = this.supabase
            .from("tasks")
            .select(`
                *,
                projects!inner(
                    id,
                    month_year,
                    clients!inner(
                        id,
                        name,
                        user_id
                    )
                )
            `);

        if (userId) {
            query = query.eq("projects.clients.user_id", userId);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(200);

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }

        console.log("Tasks fetched:", data?.length || 0);
        return data || [];
    }

    async updateTask(taskId: string, updates: any) {
        const { data, error } = await this.supabase
            .from("tasks")
            .update(updates)
            .eq("id", taskId);
        if (error) throw error;
        return data;
    }

    async createTimeEntry(entry: {
        user_id: string,
        client_id: string,
        task_id: string,
        start_time: string,
        end_time: string,
        duration_minutes: number,
        notes?: string
    }) {
        const { data, error } = await this.supabase
            .from("time_entries")
            .insert(entry);
        if (error) throw error;
        return data;
    }

    async fetchWeeklyTimeEntries(mondayISO: string, userId?: string) {
        let query = this.supabase
            .from("time_entries")
            .select("*")
            .gte("start_time", mondayISO);

        if (userId) {
            query = query.eq("user_id", userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async fetchAvailableMonths(userId?: string) {
        let query = this.supabase
            .from("projects")
            .select(`
                month_year,
                clients!inner(user_id)
            `);

        if (userId) {
            query = query.eq("clients.user_id", userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Return unique sorted month names
        return Array.from(new Set(data?.map(p => p.month_year).filter(Boolean))) as string[];
    }

    // Generic methods
    async debugDump() {
        const tasks = await this.supabase.from('tasks').select('*').limit(3);
        const projects = await this.supabase.from('projects').select('*').limit(3);
        const clients = await this.supabase.from('clients').select('*').limit(3);
        return { tasks: tasks.data, projects: projects.data, clients: clients.data };
    }

    async fetchTableData(tableName: string): Promise<any[]> {
        const { data, error } = await this.supabase
            .from(tableName)
            .select('*')
            .limit(100);

        if (error) throw error;
        return data || [];
    }

    async updateRow(tableName: string, id: string | number, updates: any): Promise<void> {
        const { error } = await this.supabase
            .from(tableName)
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    }
}
