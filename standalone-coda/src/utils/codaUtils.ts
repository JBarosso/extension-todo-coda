export function parseCodaUrl(url: string): { docId: string | null, tableId: string | null } {
    let docId: string | null = null;
    let tableId: string | null = null;

    try {
        const u = new URL(url);
        // Pattern: https://coda.io/d/DOC_NAME_d<DOC_ID>/SECTION_NAME_s<SECTION_ID>/TABLE_NAME_t<TABLE_ID>

        // Extract Doc ID (starts with _d or simply the segment after /d/)
        // Example 1: https://coda.io/d/My-Doc_dABC123456
        // Example 2: https://coda.io/d/_dABC123456
        const docMatch = u.pathname.match(/\/_d([a-zA-Z0-9_-]+)/) || u.pathname.match(/_d([a-zA-Z0-9_-]+)/);
        if (docMatch) {
            docId = docMatch[1];
        }

        // Extract ID from query param if present (modal=true&tableId=...)
        const tableParam = u.searchParams.get('tableId');
        if (tableParam) {
            tableId = tableParam;
        } else {
            // Extract Table ID from path (starts with _t)
            const tableMatch = u.pathname.match(/_t([a-zA-Z0-9_-]+)/);
            if (tableMatch) {
                tableId = tableMatch[1];
            }
        }

    } catch (e) {
        // Not a valid URL, maybe just IDs were pasted? checks later
    }

    return { docId, tableId };
}
