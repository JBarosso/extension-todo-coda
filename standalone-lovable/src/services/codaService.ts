const CODA_API_BASE = 'https://coda.io/apis/v1';

export interface CodaDoc {
    id: string;
    name: string;
    href: string;
    browserLink: string;
}

export interface CodaTable {
    id: string;
    name: string;
    href: string;
}

export interface CodaPrice {
    id: string; // The "row" id
    name: string; // "todo name"
    status: string; // e.g., "Done", "In Progress"
}

export class CodaService {
    private apiToken: string;

    constructor(apiToken: string) {
        this.apiToken = apiToken;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const headers = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const response = await fetch(`${CODA_API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            throw new Error(`Coda API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async validateToken(): Promise<boolean> {
        try {
            await this.request('/whoami');
            return true;
        } catch (e) {
            console.error('Token validation failed', e);
            return false;
        }
    }

    async listDocs(): Promise<CodaDoc[]> {
        const data = await this.request('/docs?limit=50');
        return data.items || [];
    }

    async getTable(docId: string, tableId: string): Promise<CodaTable | null> {
        try {
            const data = await this.request(`/docs/${docId}/tables/${tableId}`);
            return data;
        } catch (e) {
            return null;
        }
    }

    // New Scan method
    async findDocIdForTable(tableId: string): Promise<string | null> {
        const docs = await this.listDocs();
        // Parallel search - be careful with rate limits, maybe batches of 5
        const results = await Promise.all(docs.map(async (doc) => {
            const table = await this.getTable(doc.id, tableId);
            return table ? doc.id : null;
        }));

        return results.find(id => id !== null) || null;
    }

    async listColumns(docId: string, tableId: string): Promise<any[]> {
        const data = await this.request(`/docs/${docId}/tables/${tableId}/columns?limit=100`);
        return data.items || [];
    }

    // We will assume simpler logic for now: User selects a doc, then we find a table named "Tasks" or "Todo"
    async listTables(docId: string): Promise<CodaTable[]> {
        const data = await this.request(`/docs/${docId}/tables?limit=50`);
        return data.items || [];
    }

    // Example for fetching rows
    async listRows(docId: string, tableId: string, query?: string): Promise<any[]> {
        let url = `/docs/${docId}/tables/${tableId}/rows?valueFormat=simple&limit=100`;
        if (query) {
            url += `&query=${encodeURIComponent(query)}`;
        }
        const data = await this.request(url);
        return data.items || [];
    }

    async updateRow(docId: string, tableId: string, rowId: string, values: Record<string, any>) {
        const payload = {
            row: {
                cells: Object.entries(values).map(([column, value]) => ({ column, value }))
            }
        };
        // Note: This endpoint is slightly different in Coda API v1 for updating
        // It's usually PUT /docs/{docId}/tables/{tableId}/rows/{rowId} 
        // to update cells

        await this.request(`/docs/${docId}/tables/${tableId}/rows/${rowId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }
}
