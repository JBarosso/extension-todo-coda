import { useState, useEffect } from 'react';
import { LovableService } from '../services/lovableService';

interface LovableConfig {
    projectUrl: string;
    anonKey: string;
    tableName: string;
    // Field Mappings
    titleCol: string;
    statusCol?: string;
    assigneeCol?: string;
    descCol?: string;
    dueDateCol?: string;
}

export default function TasksTab() {
    const [config, setConfig] = useState<LovableConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);

    // Connection State
    const [inputUrl, setInputUrl] = useState('');
    const [inputKey, setInputKey] = useState('');
    const [inputTable, setInputTable] = useState('');
    const [foundTables, setFoundTables] = useState<string[]>([]);
    const [columns, setColumns] = useState<string[]>([]);

    // Configuration State
    const [configMode, setConfigMode] = useState(false);
    const [selTitleCol, setSelTitleCol] = useState('');
    const [selStatusCol, setSelStatusCol] = useState('');
    const [selAssigneeCol, setSelAssigneeCol] = useState('');
    const [selDescCol, setSelDescCol] = useState('');
    const [selDueDateCol, setSelDueDateCol] = useState('');

    // Filter State
    const [filterStatus, setFilterStatus] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filteredTasks, setFilteredTasks] = useState<any[]>([]);

    // Modal State
    const [editingTask, setEditingTask] = useState<any | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        const savedConfig = localStorage.getItem('lovable_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            if (parsed.titleCol) {
                setConfig(parsed);
                setInputUrl(parsed.projectUrl);
                setInputKey(parsed.anonKey);
                setInputTable(parsed.tableName);
                fetchData(parsed);
            } else {
                // Legacy config migration or reset
                setInputUrl(parsed.projectUrl);
                setInputKey(parsed.anonKey);
                setInputTable(parsed.tableName);
                // Trigger column fetch to setup mapping
                handleScanColumns(parsed.projectUrl, parsed.anonKey, parsed.tableName);
            }
        }
    }, []);

    // -------------------------------------------------------------------------
    // 1. Connection & Schema Discovery
    // -------------------------------------------------------------------------

    const handleScanTables = async () => {
        if (!inputUrl || !inputKey) {
            setError("Enter URL and Key first.");
            return;
        }
        setLoading(true);
        setError(null);
        setFoundTables([]);
        try {
            const service = new LovableService(inputUrl, inputKey);
            let tables = await service.listAllTables();

            // Fallback to guessing if listAllTables (schema query) fails or returns empty
            if (tables.length === 0) {
                const guesses = ['tasks', 'todos', 'items', 'kanban_items', 'tickets', 'projects'];
                const found = await service.findAnyTable(guesses);
                if (found) tables = [found];
            }

            if (tables.length > 0) {
                setFoundTables(tables);
                setInputTable(tables[0]); // Auto-select first
                setError(null);
            } else {
                setError("Could not find any tables. Try entering 'tasks' manually?");
            }
        } catch (e: any) {
            if (e.code === 'PGRST205') {
                setError(`Table '${inputTable || 'tasks'}' not found using your credentials. Check the table name (case-sensitive) or RLS policies.`);
            } else {
                setError(e.message || "Scan failed");
            }
        }
        setLoading(false);
    };

    const handleScanColumns = async (url: string = inputUrl, key: string = inputKey, table: string = inputTable) => {
        if (!url || !key || !table) return;
        setLoading(true);
        setError(null);
        try {
            const service = new LovableService(url, key);
            const cols = await service.listColumns(table);
            setColumns(cols);

            if (cols.length > 0) {
                // Auto-Map Logic
                const find = (arr: string[]) => cols.find(c => arr.some(k => c.toLowerCase().includes(k))) || '';

                setSelTitleCol(find(['title', 'name', 'summary', 'task', 'label']));
                setSelStatusCol(find(['status', 'state', 'stage', 'column']));
                setSelAssigneeCol(find(['assign', 'owner', 'user', 'respo']));
                setSelDescCol(find(['desc', 'body', 'content', 'detail', 'note']));
                setSelDueDateCol(find(['date', 'due', 'dead', 'end']));

                setConfigMode(true); // Move to config step
            } else {
                setError("Could not read columns. Check permissions or table name.");
            }
        } catch (e: any) {
            if (e.code === 'PGRST205') {
                setError(`Table '${table}' not found. Check name and case-sensitivity.`);
            } else {
                setError(e.message || "Column scan failed");
            }
        }
        setLoading(false);
    };

    const saveConfiguration = () => {
        if (!inputUrl || !inputKey || !inputTable || !selTitleCol) {
            setError("Project URL, Key, Table and Title Column are required.");
            return;
        }

        const newConfig: LovableConfig = {
            projectUrl: inputUrl,
            anonKey: inputKey,
            tableName: inputTable,
            titleCol: selTitleCol,
            statusCol: selStatusCol || undefined,
            assigneeCol: selAssigneeCol || undefined,
            descCol: selDescCol || undefined,
            dueDateCol: selDueDateCol || undefined
        };

        localStorage.setItem('lovable_config', JSON.stringify(newConfig));
        setConfig(newConfig);
        setConfigMode(false);
        fetchData(newConfig);
    };

    // -------------------------------------------------------------------------
    // 2. Data Fetching & Filtering
    // -------------------------------------------------------------------------

    const fetchData = async (cfg: LovableConfig, silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const service = new LovableService(cfg.projectUrl, cfg.anonKey);
            const data = await service.fetchTableData(cfg.tableName);
            setTasks(data);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to fetch tasks");
        }
        if (!silent) setLoading(false);
    };

    useEffect(() => {
        if (!config || tasks.length === 0) {
            setFilteredTasks([]);
            return;
        }

        let res = [...tasks];
        if (filterStatus && config.statusCol) {
            res = res.filter(t => String(t[config.statusCol!] || '') === filterStatus);
        }
        if (filterAssignee && config.assigneeCol) {
            res = res.filter(t => String(t[config.assigneeCol!] || '') === filterAssignee);
        }
        setFilteredTasks(res);

    }, [tasks, filterStatus, filterAssignee, config]);

    // Derived Filters
    const uniqueStatuses = config?.statusCol
        ? Array.from(new Set(tasks.map(t => String(t[config.statusCol!] || '')).filter(Boolean))).sort()
        : [];
    const uniqueAssignees = config?.assigneeCol
        ? Array.from(new Set(tasks.map(t => String(t[config.assigneeCol!] || '')).filter(Boolean))).sort()
        : [];


    // -------------------------------------------------------------------------
    // 3. Actions (Edit / Update)
    // -------------------------------------------------------------------------

    const handleDisconnect = () => {
        localStorage.removeItem('lovable_config');
        setConfig(null);
        setTasks([]);
        setInputUrl('');
        setInputKey('');
        setInputTable('');
        setColumns([]);
        setConfigMode(false);
        setError(null);
    };

    const saveTaskChanges = async () => {
        if (!editingTask || !config) return;

        setSaveStatus('saving');
        try {
            const service = new LovableService(config.projectUrl, config.anonKey);

            // Construct updates object based on mapped fields only
            const updates: any = {};
            if (config.statusCol) updates[config.statusCol] = editingTask[config.statusCol];
            if (config.assigneeCol) updates[config.assigneeCol] = editingTask[config.assigneeCol];
            if (config.descCol) updates[config.descCol] = editingTask[config.descCol];
            // Title usually not edited here but can be
            if (config.titleCol) updates[config.titleCol] = editingTask[config.titleCol];

            await service.updateRow(config.tableName, editingTask.id, updates);

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 1500);

            // Refresh
            fetchData(config, true);
        } catch (e: any) {
            console.error(e);
            setSaveStatus('error');
        }
    };

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    // 1. Connection Form (Initial)
    if (!config && !configMode) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4 items-center justify-center space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Connect to Lovable (Supabase)</h2>

                <div className="w-full max-w-xs space-y-3">
                    <input type="text" value={inputUrl} onChange={e => setInputUrl(e.target.value)} placeholder="Project URL" className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
                    <input type="password" value={inputKey} onChange={e => setInputKey(e.target.value)} placeholder="Anon / Public Key" className="w-full p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />

                    <div className="flex gap-2">
                        <input type="text" value={inputTable} onChange={e => setInputTable(e.target.value)} placeholder="Table Name" className="flex-1 p-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100" />
                        <button onClick={handleScanTables} disabled={loading} className="px-3 py-2 bg-gray-200 rounded text-xs hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">Scan</button>
                    </div>

                    {foundTables.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {foundTables.map(t => (
                                <button key={t} onClick={() => setInputTable(t)} className={`px-2 py-1 text-[10px] rounded border ${inputTable === t ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => handleScanColumns()}
                        disabled={loading || !inputTable}
                        className="w-full py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Scanning Schema...' : 'Next: Configure Fields'}
                    </button>

                    {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                </div>
            </div>
        );
    }

    // 2. Configuration Form (Field Mapping)
    if (configMode) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4">
                <div className="max-w-md mx-auto w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Map your fields</h3>
                    <p className="text-xs text-gray-500">Match your Supabase columns to the extension fields.</p>

                    <div>
                        <label className="block text-xs font-bold mb-1">Title (Required)</label>
                        <select value={selTitleCol} onChange={e => setSelTitleCol(e.target.value)} className="w-full p-2 border rounded text-sm dark:bg-gray-700 dark:text-gray-200">
                            <option value="">-- Select Column --</option>
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {[
                        { label: "Status", val: selStatusCol, set: setSelStatusCol },
                        { label: "Assignee", val: selAssigneeCol, set: setSelAssigneeCol },
                        { label: "Description", val: selDescCol, set: setSelDescCol },
                        { label: "Due Date", val: selDueDateCol, set: setSelDueDateCol }
                    ].map(f => (
                        <div key={f.label}>
                            <label className="block text-xs font-bold mb-1">{f.label} (Optional)</label>
                            <select value={f.val} onChange={e => f.set(e.target.value)} className="w-full p-2 border rounded text-sm dark:bg-gray-700 dark:text-gray-200">
                                <option value="">-- None --</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    ))}

                    <div className="flex gap-2 pt-4">
                        <button onClick={() => setConfigMode(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                        <button onClick={saveConfiguration} disabled={!selTitleCol} className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">Save & View Tasks</button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Main Task View
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-4 relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tasks</h2>
                    <p className="text-[10px] text-gray-500">{filteredTasks.length} tasks</p>
                </div>
                <div className="space-x-2">
                    <button onClick={() => setConfigMode(true)} className="text-xs text-blue-500 hover:text-blue-700">Config</button>
                    <button onClick={handleDisconnect} className="text-xs text-red-500 hover:text-red-700">Disconnect</button>
                    <button onClick={() => fetchData(config!, false)} className="p-1 hover:text-blue-500" title="Refresh">
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4">
                {config && config.statusCol && (
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 text-xs p-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                        <option value="">All Statuses</option>
                        {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                )}
                {config && config.assigneeCol && (
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="flex-1 text-xs p-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                        <option value="">All Assignees</option>
                        {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto space-y-2">
                {filteredTasks.length > 0 ? filteredTasks.map(task => (
                    <div
                        key={task.id}
                        onClick={() => setEditingTask(task)}
                        className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {task[config!.titleCol]}
                            </span>
                            {config?.statusCol && task[config.statusCol] && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 whitespace-nowrap ml-2">
                                    {task[config.statusCol]}
                                </span>
                            )}
                        </div>

                        {config?.assigneeCol && task[config.assigneeCol] && (
                            <div className="flex items-center gap-1 mt-1">
                                <svg className="w-3 h-3 text-gray-500 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{task[config.assigneeCol]}</span>
                            </div>
                        )}
                    </div>
                )) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                        {loading ? 'Loading...' : 'No tasks found.'}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingTask && config && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-white/95 dark:bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 w-full h-full max-h-full rounded-xl shadow-2xl flex flex-col animate-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-start">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{editingTask[config.titleCol]}</h3>
                            <button onClick={() => setEditingTask(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Status */}
                            {config.statusCol && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Status</label>
                                    <input
                                        type="text"
                                        value={editingTask[config.statusCol] || ''}
                                        onChange={e => setEditingTask({ ...editingTask, [config.statusCol!]: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm"
                                    />
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {uniqueStatuses.slice(0, 5).map(s => (
                                            <button key={s} onClick={() => setEditingTask({ ...editingTask, [config.statusCol!]: s })} className="text-[10px] px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600">{s}</button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Assignee */}
                            {config.assigneeCol && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Assignee</label>
                                    <input
                                        type="text"
                                        value={editingTask[config.assigneeCol] || ''}
                                        onChange={e => setEditingTask({ ...editingTask, [config.assigneeCol!]: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm"
                                    />
                                </div>
                            )}

                            {/* Description */}
                            {config.descCol && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                                    <textarea
                                        value={editingTask[config.descCol] || ''}
                                        onChange={e => setEditingTask({ ...editingTask, [config.descCol!]: e.target.value })}
                                        className="w-full mt-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-sm h-32"
                                    />
                                </div>
                            )}

                            {/* Raw Data (ReadOnly) */}
                            <div className="opacity-50 text-[10px] break-all">
                                <p>ID: {editingTask.id}</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-2">
                            <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-200">Cancel</button>
                            <button
                                onClick={saveTaskChanges}
                                disabled={saveStatus === 'saving'}
                                className={`px-6 py-2 text-white rounded text-sm font-medium ${saveStatus === 'saved' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
