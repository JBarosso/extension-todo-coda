import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class LovableService {
    private supabase: SupabaseClient;

    constructor(projectUrl: string, anonKey: string) {
        this.supabase = createClient(projectUrl, anonKey);
    }

    async validateConnection(): Promise<boolean> {
        try {
            return true;
        } catch (e) {
            console.error("Supabase connection invalid", e);
            return false;
        }
    }

    async fetchTableData(tableName: string): Promise<any[]> {
        const { data, error } = await this.supabase
            .from(tableName)
            .select('*')
            .limit(100);

        if (error) {
            throw error;
        }

        return data || [];
    }

    async findAnyTable(possibleNames: string[]): Promise<string | null> {
        for (const name of possibleNames) {
            const { error } = await this.supabase.from(name).select('*').limit(1);
            if (!error) {
                return name;
            }
        }
        return null;
    }

    async listAllTables(): Promise<string[]> {
        try {
            // Try information_schema first
            const { data, error } = await this.supabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_schema', 'public');

            if (data && !error) {
                return data.map((d: any) => d.table_name);
            }
        } catch (e) {
            console.warn("Schema query failed", e);
        }
        return [];
    }

    async listColumns(tableName: string): Promise<string[]> {
        // 1. Try information_schema
        try {
            const { data, error } = await this.supabase
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_schema', 'public')
                .eq('table_name', tableName);

            if (data && !error && data.length > 0) {
                return data.map((d: any) => d.column_name);
            }
        } catch (e) {
            console.warn("Column schema query failed, falling back to row inspection", e);
        }

        // 2. Fallback: Fetch 1 row and inspect keys
        try {
            const { data } = await this.supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (data && data.length > 0) {
                return Object.keys(data[0]);
            }
        } catch (e) {
            console.error("Column fallback inspection failed", e);
        }

        return [];
    }

    async updateRow(tableName: string, id: string | number, updates: any): Promise<void> {
        const { error } = await this.supabase
            .from(tableName)
            .update(updates)
            .eq('id', id);

        if (error) {
            throw error;
        }
    }
}
