import { useState, useEffect, useCallback, useRef } from 'react';
import { CodaService } from '../services/codaService';
import { parseCodaUrl } from '../utils/codaUtils';

interface CodaConfig {
    docId: string;
    tableId: string;
    groupColumnId: string; // Used for Kanban groups (e.g. Day)
    assigneeColId?: string;
    progressColId?: string;
    priorityColId?: string;
    commentsColId?: string;
}

export default function CodaTab() {
    const [apiToken, setApiToken] = useState('');
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data State
    const [columns, setColumns] = useState<any[]>([]);
    const [rows, setRows] = useState<any[]>([]);
    const [filteredRows, setFilteredRows] = useState<any[]>([]);

    // Refresh State
    const [nextRefreshTime, setNextRefreshTime] = useState<number | null>(null);
    const [timeDisplay, setTimeDisplay] = useState('5m');

    // Selection State
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [selectedGroupColId, setSelectedGroupColId] = useState<string | null>(null);
    const [selectedAssigneeColId, setSelectedAssigneeColId] = useState<string | null>(null);
    const [selectedProgressColId, setSelectedProgressColId] = useState<string | null>(null);
    const [selectedPriorityColId, setSelectedPriorityColId] = useState<string | null>(null);
    const [selectedCommentsColId, setSelectedCommentsColId] = useState<string | null>(null);

    // View State
    const [configMode, setConfigMode] = useState(false);
    const [inputUrl, setInputUrl] = useState('');
    // Remove showAll, rely on filterGroupValue === '' for showing all
    const [filterGroupValue, setFilterGroupValue] = useState<string>('');
    const [filterAssigneeValue, setFilterAssigneeValue] = useState<string>('');

    // Modal State
    const [editingRow, setEditingRow] = useState<any | null>(null);
    const [newComment, setNewComment] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    // showDebug removed
    const [isProgressInteger, setIsProgressInteger] = useState(false); // New: Detect if 0-100 or 0-1

    // Refs for intervals
    const refreshIntervalRef = useRef<any | null>(null);
    const countdownIntervalRef = useRef<any | null>(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('coda_api_token');
        const savedConfig = localStorage.getItem('coda_config');

        if (savedToken) {
            setApiToken(savedToken);
            validateAndConnect(savedToken, savedConfig ? JSON.parse(savedConfig) : null);
        }

        return () => {
            stopAutoRefresh();
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, []);

    // Countdown Effect
    useEffect(() => {
        if (!nextRefreshTime) return;

        const updateTimer = () => {
            const now = Date.now();
            const diff = Math.max(0, nextRefreshTime - now);

            if (diff === 0) {
                setTimeDisplay('Refreshing...');
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeDisplay(`Refresh: ${minutes}m ${seconds}s`);
        };

        updateTimer(); // Initial call
        countdownIntervalRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [nextRefreshTime]);

    const startAutoRefresh = useCallback((config: CodaConfig) => {
        stopAutoRefresh();

        // precise 5 minutes
        const interval = 5 * 60 * 1000;
        setNextRefreshTime(Date.now() + interval);

        refreshIntervalRef.current = setInterval(() => {
            // Don't refresh if modal is open to avoid overwriting edits
            if (!document.getElementById('coda-detail-modal')) {
                console.log("Auto-refreshing Coda...");
                const service = new CodaService(localStorage.getItem('coda_api_token') || '');
                fetchRows(service, config, true);

                // Reset timer for next cycle
                setNextRefreshTime(Date.now() + interval);
            }
        }, interval);
    }, []);

    const stopAutoRefresh = () => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        setNextRefreshTime(null);
        setTimeDisplay('Stopped');
    };

    const validateAndConnect = async (token: string, savedConfig: CodaConfig | null) => {
        setLoading(true);
        setError(null);
        const service = new CodaService(token);
        const isValid = await service.validateToken();

        if (isValid) {
            setConnected(true);
            localStorage.setItem('coda_api_token', token);

            if (savedConfig) {
                setSelectedDocId(savedConfig.docId);
                setSelectedTableId(savedConfig.tableId);
                // Cast to any to allow migration from old dateColumnId
                setSelectedGroupColId(savedConfig.groupColumnId || (savedConfig as any).dateColumnId);
                setSelectedAssigneeColId(savedConfig.assigneeColId || null);
                setSelectedProgressColId(savedConfig.progressColId || null);
                setSelectedPriorityColId(savedConfig.priorityColId || null);
                setSelectedCommentsColId(savedConfig.commentsColId || null);
                fetchRows(service, savedConfig);
                startAutoRefresh(savedConfig);
            }
        } else {
            setError('Invalid API Token');
            setConnected(false);
        }
        setLoading(false);
    };

    const fetchColumnsInternal = async (docId: string, tableId: string) => {
        setLoading(true);
        try {
            const service = new CodaService(apiToken);
            const colList = await service.listColumns(docId, tableId);
            setColumns(colList);
            setSelectedTableId(tableId);

            // Auto-Mapping Logic
            // We define keywords to look for in column names (case-insensitive)
            const findCol = (keywords: string[]) =>
                colList.find((c: any) => keywords.some(k => c.name.toLowerCase().includes(k)));

            // 1. Group / Status (Required)
            const groupCol = findCol(['status', 'statut', 'etat', 'état', 'stage', 'jour', 'day', 'group']);
            if (groupCol && !selectedGroupColId) setSelectedGroupColId(groupCol.id);

            // 2. Assignee
            const assigneeCol = findCol(['assign', 'owner', 'respo', 'user', 'person']);
            if (assigneeCol && !selectedAssigneeColId) setSelectedAssigneeColId(assigneeCol.id);

            // 3. Progress
            const progressCol = findCol(['progress', 'avanc', 'complete', 'complétion', '%', 'done']);
            if (progressCol && !selectedProgressColId) setSelectedProgressColId(progressCol.id);

            // 4. Priority
            const priorityCol = findCol(['priorit', 'prio', 'urgen', 'importan']);
            if (priorityCol && !selectedPriorityColId) setSelectedPriorityColId(priorityCol.id);

            // 5. Comments
            const commentsCol = findCol(['comment', 'note', 'desc', 'detail', 'text']);
            // If we found the required Group column, AUTO-SAVE and START immediately.
            if (groupCol) {
                const autoConfig: CodaConfig = {
                    docId,
                    tableId,
                    groupColumnId: groupCol.id,
                    assigneeColId: assigneeCol?.id,
                    progressColId: progressCol?.id,
                    priorityColId: priorityCol?.id,
                    commentsColId: commentsCol?.id
                };

                // Save & Apply
                localStorage.setItem('coda_config', JSON.stringify(autoConfig));

                // Update State
                setSelectedGroupColId(autoConfig.groupColumnId);
                setSelectedAssigneeColId(autoConfig.assigneeColId || null);
                setSelectedProgressColId(autoConfig.progressColId || null);
                setSelectedPriorityColId(autoConfig.priorityColId || null);
                setSelectedCommentsColId(autoConfig.commentsColId || null);

                // Skip Config Mode
                setConfigMode(false);

                // Fetch & Start
                const service = new CodaService(apiToken);
                fetchRows(service, autoConfig);
                startAutoRefresh(autoConfig);
            }

        } catch (e) {
            console.error("Failed to fetch columns", e);
        }
        setLoading(false);
    }

    const saveConfigAndFetch = () => {
        if (selectedDocId && selectedTableId && selectedGroupColId) {
            const config: CodaConfig = {
                docId: selectedDocId,
                tableId: selectedTableId,
                groupColumnId: selectedGroupColId,
                assigneeColId: selectedAssigneeColId || undefined,
                progressColId: selectedProgressColId || undefined,
                priorityColId: selectedPriorityColId || undefined,
                commentsColId: selectedCommentsColId || undefined
            };
            localStorage.setItem('coda_config', JSON.stringify(config));
            setConfigMode(false);
            const service = new CodaService(apiToken);
            fetchRows(service, config);
            startAutoRefresh(config);
        }
    };

    const fetchRows = async (service: CodaService, config: CodaConfig, silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const rowList = await service.listRows(config.docId, config.tableId);
            setRows(rowList);
        } catch (e) {
            console.error("Failed to fetch rows", e);
            if (!silent) setError("Failed to fetch rows. Check your connection.");
        }
        if (!silent) setLoading(false);
    };

    const handleRefresh = () => {
        const savedConfig = localStorage.getItem('coda_config');
        if (savedConfig && apiToken) {
            const service = new CodaService(apiToken);
            fetchRows(service, JSON.parse(savedConfig));
        }
    }

    // Detect Progress Format (Integer vs Decimal)
    useEffect(() => {
        if (!selectedProgressColId || rows.length === 0) return;

        // Check if any value is > 1. If so, it's Integer Mode (0-100).
        const hasIntegerValues = rows.some(r => {
            const val = Number(r.values[selectedProgressColId]);
            return !isNaN(val) && val > 1;
        });

        setIsProgressInteger(hasIntegerValues);
    }, [rows, selectedProgressColId]);

    // Auto-select Today's group on first load
    useEffect(() => {
        if (rows.length > 0 && selectedGroupColId && filterGroupValue === '') {
            const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
            const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

            // Check if this group exists in our data
            const hasTodayGroup = rows.some(r => {
                const val = String(r.values[selectedGroupColId] || '').trim();
                return val.toLowerCase() === todayCapitalized.toLowerCase();
            });

            if (hasTodayGroup) {
                // But we need to match the exact case from the row if possible, or just Capitalized
                // Let's Find the exact string value from the rows that matches today
                const exactMatch = rows.find(r => String(r.values[selectedGroupColId] || '').trim().toLowerCase() === todayCapitalized.toLowerCase());
                if (exactMatch) {
                    setFilterGroupValue(String(exactMatch.values[selectedGroupColId]).trim());
                }
            }
        }
    }, [rows, selectedGroupColId]); // Be careful not to override user selection if they want 'All'

    // Filtering Logic
    useEffect(() => {
        if (rows.length === 0) return;

        let filtered = [...rows];

        // 1. Filter by Group (e.g. Day/Status)
        if (filterGroupValue) {
            filtered = filtered.filter(row => {
                const val = String(row.values[selectedGroupColId!] || '').trim();
                return val === filterGroupValue;
            });
        }

        // 2. Filter by Assignee
        if (filterAssigneeValue && selectedAssigneeColId) {
            filtered = filtered.filter(row => {
                const val = String(row.values[selectedAssigneeColId] || '').trim();
                return val === filterAssigneeValue;
            });
        }

        setFilteredRows(filtered);
    }, [rows, filterGroupValue, filterAssigneeValue, selectedGroupColId, selectedAssigneeColId]);

    // Derived lists for filters
    const availableGroups = Array.from(new Set(rows.map(r => selectedGroupColId ? String(r.values[selectedGroupColId] || '').trim() : '').filter(Boolean))).sort();
    const availableAssignees = Array.from(new Set(rows.map(r => selectedAssigneeColId ? String(r.values[selectedAssigneeColId] || '').trim() : '').filter(Boolean))).sort();


    const handleDisconnect = () => {
        stopAutoRefresh();
        setConnected(false);
        setApiToken('');
        localStorage.removeItem('coda_api_token');
        localStorage.removeItem('coda_config');
        setRows([]);
        setFilteredRows([]);
        setConfigMode(false);
        setSelectedDocId(null);
        setError(null);
    };

    const resetConfig = () => {
        stopAutoRefresh();
        setConfigMode(false);
        localStorage.removeItem('coda_config');
        setSelectedDocId(null);
        setSelectedTableId(null);
        setSelectedGroupColId(null);
        setSelectedAssigneeColId(null);
        setSelectedProgressColId(null);
        setSelectedPriorityColId(null);
        setSelectedCommentsColId(null);
        setRows([]);
        setFilteredRows([]);
        setError(null);
    };

    const saveChanges = async () => {
        if (!editingRow || !selectedDocId || !selectedTableId) return;

        setSaveStatus('saving');
        try {
            const service = new CodaService(apiToken);
            const updates: any = {};

            // 1. Progress
            if (selectedProgressColId) {
                const val = editingRow.values[selectedProgressColId];
                // Convert decimal back to integer if detected
                if (isProgressInteger) {
                    updates[selectedProgressColId] = Math.round(val * 100);
                } else {
                    updates[selectedProgressColId] = val;
                }
            }

            // 2. Comments (Append)
            if (newComment && selectedCommentsColId) {
                const currentComments = editingRow.values[selectedCommentsColId] || '';
                const dateStr = new Date().toLocaleString();
                const appended = `${currentComments}\n\n[${dateStr}]\n${newComment}`;
                updates[selectedCommentsColId] = appended;

                // Update local state immediately for UI
                const updatedRow = { ...editingRow };
                updatedRow.values[selectedCommentsColId] = appended;
                setEditingRow(updatedRow);
            }

            if (Object.keys(updates).length > 0) {
                await service.updateRow(selectedDocId, selectedTableId, editingRow.id, updates);
                setSaveStatus('saved');
                setNewComment('');

                // Refresh list in background to ensure consistency
                handleRefresh();

                setTimeout(() => setSaveStatus('idle'), 2000);
            } else {
                setSaveStatus('idle');
            }

        } catch (e) {
            console.error(e);
            setSaveStatus('error');
        }
    };

    const getPriorityColor = (val: any) => {
        const v = String(val).trim();
        // UPDATED MAPPING: 1=Minor(Green), 2=Medium(Orange), 3=Max(Red)
        if (v === '1') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
        if (v === '2') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
        if (v === '3') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
        return 'bg-gray-100 text-gray-800';
    };

    const formatProgress = (val: any) => {
        const num = Number(val || 0);
        if (num > 1) return Math.round(num); // Assume 26 -> 26%
        return Math.round(num * 100); // Assume 0.26 -> 26%
    };

    if (loading && !rows.length) {
        return <div className="p-4 text-center text-gray-500">Loading...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4">
            {!connected ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                    {/* Connection UI skipped for brevity, same as before but ensured persistence */}
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Connect to Coda</h2>
                    <input
                        type="password"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        placeholder="Coda API Token"
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => validateAndConnect(apiToken, null)}
                        disabled={!apiToken}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                        Connect
                    </button>
                </div>
            ) : (
                <div className="flex flex-col h-full relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Coda Todo</h2>
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className={`p-1 transition-colors ${loading ? 'text-blue-600 cursor-not-allowed' : 'text-gray-400 hover:text-blue-500'}`}
                                title="Refresh Now"
                            >
                                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>
                        <div className="space-x-2">
                            <button onClick={resetConfig} className="text-xs text-blue-500 hover:text-blue-700">Config</button>
                            <button onClick={handleDisconnect} className="text-xs text-red-500 hover:text-red-700">Disconnect</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                        {/* Configuration View */}
                        {(!selectedDocId || configMode) && (
                            <div className="space-y-4">
                                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

                                {/* Manual ID Input */}
                                {!selectedDocId && (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                        {/* ... Same Search UI ... */}
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Enter Kanban ID / Table ID
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={inputUrl}
                                                onChange={(e) => setInputUrl(e.target.value)}
                                                placeholder="e.g. grid-AbC123..."
                                                className="flex-1 text-sm p-2 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                                            />
                                            <button onClick={async () => {
                                                setLoading(true);
                                                setError(null);
                                                const service = new CodaService(apiToken);
                                                let idToSearch = inputUrl.trim();
                                                const { tableId } = parseCodaUrl(idToSearch);
                                                if (tableId) idToSearch = tableId;
                                                const foundDocId = await service.findDocIdForTable(idToSearch);
                                                if (foundDocId) {
                                                    setSelectedDocId(foundDocId);
                                                    setSelectedTableId(idToSearch);
                                                    setConfigMode(true);
                                                    fetchColumnsInternal(foundDocId, idToSearch);
                                                } else {
                                                    setError("Could not find this Kanban ID.");
                                                }
                                                setLoading(false);
                                            }}
                                                disabled={loading || !inputUrl}
                                                className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                Search
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Columns Config Input */}
                                {selectedDocId && (
                                    <div className="space-y-4 mt-4 border-t pt-4 dark:border-gray-600">
                                        <p className="text-sm text-green-600 dark:text-green-400">✓ Found Kanban/Table!</p>

                                        {selectedTableId && (
                                            <div className="space-y-3">
                                                {/* Standard Columns */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Select Status / Day Column (Required)</label>
                                                    <p className="text-[10px] text-gray-500 mb-1">Select the column that defines your groups (e.g. "Status", "Jour", "Lundi"...).</p>
                                                    <select
                                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                                        onChange={(e) => setSelectedGroupColId(e.target.value)}
                                                        value={selectedGroupColId || ''}
                                                    >
                                                        <option value="">-- Select Column --</option>
                                                        {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </div>

                                                {/* Optional Columns */}
                                                {['Assignee', 'Progress', 'Priority', 'Comments'].map(colType => {
                                                    const setFn = (
                                                        colType === 'Assignee' ? setSelectedAssigneeColId :
                                                            colType === 'Progress' ? setSelectedProgressColId :
                                                                colType === 'Priority' ? setSelectedPriorityColId :
                                                                    setSelectedCommentsColId
                                                    );
                                                    const val = (
                                                        colType === 'Assignee' ? selectedAssigneeColId :
                                                            colType === 'Progress' ? selectedProgressColId :
                                                                colType === 'Priority' ? selectedPriorityColId :
                                                                    selectedCommentsColId
                                                    );

                                                    return (
                                                        <div key={colType}>
                                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{colType} Column (Optional)</label>
                                                            <select
                                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                                                onChange={(e) => setFn(e.target.value)}
                                                                value={val || ''}
                                                            >
                                                                <option value="">-- None --</option>
                                                                {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <button
                                            onClick={saveConfigAndFetch}
                                            disabled={!selectedGroupColId}
                                            className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                                        >
                                            Save & View
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Rows View */}
                        {selectedDocId && !configMode && selectedGroupColId && (
                            <div className="space-y-2">
                                {/* Filters Bar */}
                                <div className="flex flex-col gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-700/30 rounded border dark:border-gray-700">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Filters</span>
                                        <span className="text-[10px] text-gray-400 font-mono tracking-wide">{timeDisplay}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Group Filter */}
                                        <select
                                            value={filterGroupValue}
                                            onChange={(e) => setFilterGroupValue(e.target.value)}
                                            className="w-full text-xs p-1.5 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 outline-none"
                                        >
                                            <option value="">All Days</option>
                                            {availableGroups.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>

                                        {/* Assignee Filter */}
                                        {selectedAssigneeColId && (
                                            <select
                                                value={filterAssigneeValue}
                                                onChange={(e) => setFilterAssigneeValue(e.target.value)}
                                                className="w-full text-xs p-1.5 border rounded dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 outline-none"
                                            >
                                                <option value="">All Assignees</option>
                                                {availableAssignees.map(a => (
                                                    <option key={a} value={a}>{a}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {/* Debug Info removed */}

                                {filteredRows.length > 0 ? filteredRows.map((row: any) => (
                                    <div
                                        key={row.id}
                                        onClick={() => setEditingRow(row)}
                                        className="p-3 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer rounded-lg transition-colors group"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex-1">
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">{row.name}</span>
                                            </div>
                                            {selectedPriorityColId && row.values[selectedPriorityColId] && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ml-2 ${getPriorityColor(row.values[selectedPriorityColId])}`}>
                                                    {String(row.values[selectedPriorityColId])}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            {selectedAssigneeColId && row.values[selectedAssigneeColId] && (
                                                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                    <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="truncate max-w-[80px]">{String(row.values[selectedAssigneeColId])}</span>
                                                </div>
                                            )}
                                            {selectedProgressColId && row.values[selectedProgressColId] !== undefined && (
                                                <div className="flex items-center gap-2 flex-1 max-w-[120px]">
                                                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-green-500 rounded-full"
                                                            style={{ width: `${Math.min(100, formatProgress(row.values[selectedProgressColId]))}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px]">{formatProgress(row.values[selectedProgressColId])}%</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <p>{error || "No tasks match your filters."}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Detail Modal Layer */}
                        {editingRow && (
                            <div id="coda-detail-modal" className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/95 dark:bg-black/80 backdrop-blur-sm">
                                <div className="bg-white dark:bg-gray-800 w-full h-full max-h-full rounded-none md:rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                                    {/* Header */}
                                    <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start gap-4">
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white leading-tight">{editingRow.name}</h3>
                                        <button
                                            onClick={() => setEditingRow(null)}
                                            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                        {/* Meta Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Assignee */}
                                            {selectedAssigneeColId && (
                                                <div>
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignee</label>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                        </svg>
                                                        <span className="text-sm dark:text-gray-200 font-medium">
                                                            {String(editingRow.values[selectedAssigneeColId] || 'Unassigned')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Priority */}
                                            {selectedPriorityColId && (
                                                <div>
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</label>
                                                    <div className="mt-1">
                                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(editingRow.values[selectedPriorityColId])}`}>
                                                            {String(editingRow.values[selectedPriorityColId] || 'None')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Progress Slider */}
                                        {selectedProgressColId && (
                                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                                                <div className="flex justify-between items-center mb-2">
                                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Progress</label>
                                                    <span className="text-sm font-BOLD text-blue-600 dark:text-blue-400">
                                                        {formatProgress(editingRow.values[selectedProgressColId])}%
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={formatProgress(editingRow.values[selectedProgressColId])}
                                                    onChange={(e) => {
                                                        const newVal = Number(e.target.value) / 100; // Store as 0.x locally
                                                        const newRow = { ...editingRow };
                                                        newRow.values[selectedProgressColId] = newVal;
                                                        setEditingRow(newRow);
                                                    }}
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-blue-600"
                                                    style={{
                                                        backgroundImage: `linear-gradient(to right, #2563eb 0%, #2563eb ${formatProgress(editingRow.values[selectedProgressColId])}%, transparent ${formatProgress(editingRow.values[selectedProgressColId])}%, transparent 100%)`
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Add Comment */}
                                        {selectedCommentsColId && (
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Comment</label>
                                                <textarea
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    placeholder="Type a comment..."
                                                    className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm h-20"
                                                />
                                            </div>
                                        )}

                                        {/* Details / Desc */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Details</label>
                                            <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-300 min-h-[120px] shadow-sm">
                                                {Object.entries(editingRow.values).map(([k, v]) => {
                                                    if ([selectedDocId, selectedTableId, selectedGroupColId, selectedAssigneeColId, selectedProgressColId, selectedPriorityColId, selectedCommentsColId, 'id', 'name'].includes(k)) return null;
                                                    if (typeof v === 'string' && v.length > 0) {
                                                        return (
                                                            <div key={k} className="mb-3 last:mb-0">
                                                                <p className="whitespace-pre-wrap">{v}</p>
                                                            </div>
                                                        )
                                                    }
                                                    return null;
                                                })}

                                                {/* Show comments here too */}
                                                {selectedCommentsColId && editingRow.values[selectedCommentsColId] && (
                                                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                                        <p className="font-bold text-xs uppercase text-gray-400 mb-2">History & Comments</p>
                                                        <p className="whitespace-pre-wrap">{String(editingRow.values[selectedCommentsColId])}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-2">
                                        <button
                                            onClick={() => setEditingRow(null)}
                                            className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveChanges}
                                            disabled={saveStatus === 'saving'}
                                            className={`px-6 py-2 text-white rounded text-sm font-medium transition-colors ${saveStatus === 'saved' ? 'bg-green-600' :
                                                saveStatus === 'error' ? 'bg-red-600' :
                                                    'bg-blue-600 hover:bg-blue-700'
                                                }`}
                                        >
                                            {saveStatus === 'saving' ? 'Saving...' :
                                                saveStatus === 'saved' ? 'Saved!' :
                                                    saveStatus === 'error' ? 'Error!' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
