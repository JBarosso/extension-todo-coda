import { useState, useEffect, useCallback, useRef } from 'react';
import { LovableService } from '../services/lovableService';

// --- Custom Date Helpers ---
const getISOWeek = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
    return String(weekNo);
};

const CATEGORY_COLORS: Record<string, string> = {
    'SEO': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'SEA': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'SMA': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'CRM': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    'Netlinking': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    'Reporting': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Rédaction web': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'SMO': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

interface CrmConfig {
    projectUrl: string;
    anonKey: string;
    userId: string;
}

const DEFAULT_USER_ID = '602de6e7-2753-449b-92cc-4d7522c0710a';
const DEFAULT_USER_NAME = 'Flavien';

export default function TasksTab() {
    const [config, setConfig] = useState<CrmConfig | null>(null);
    const [showConfig, setShowConfig] = useState(false);
    const [service, setService] = useState<LovableService | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Config Input State
    const [inputUrl, setInputUrl] = useState('');
    const [inputKey, setInputKey] = useState('');
    const [inputUserId, setInputUserId] = useState(DEFAULT_USER_ID);

    // CRM State
    const [tasks, setTasks] = useState<any[]>([]);
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [selectedMonthYear, setSelectedMonthYear] = useState('');
    const [selectedWeek, setSelectedWeek] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [weeklyTimeEntries, setWeeklyTimeEntries] = useState<any[]>([]);
    const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

    // Timer State
    const [activeTimer, setActiveTimer] = useState<{ taskId: string, startTime: number } | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<any>(null);

    // Initialize
    useEffect(() => {
        const savedConfig = localStorage.getItem('lovable_config');
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            setConfig(parsed);
            setInputUrl(parsed.projectUrl || '');
            setInputKey(parsed.anonKey || '');
            setInputUserId(parsed.userId || '');
            setService(new LovableService(parsed.projectUrl, parsed.anonKey));
        }

        // Set default week
        const now = new Date();
        setSelectedWeek(getISOWeek(now));

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const fetchData = useCallback(async () => {
        if (!service || !config) return;
        setLoading(true);
        setError(null);
        try {
            const [taskList, months] = await Promise.all([
                service.fetchAllTasks(config.userId),
                service.fetchAvailableMonths(config.userId)
            ]);
            setTasks(taskList);

            // Sort months: Decending (Recent first)
            const sortedMonths = [...months].sort((a, b) => {
                const partsA = a.split(' ');
                const partsB = b.split(' ');

                // If one is not a Month Year format (2 parts), push it to the end
                if (partsA.length !== 2) return 1;
                if (partsB.length !== 2) return -1;

                const [mA, yA] = partsA;
                const [mB, yB] = partsB;
                const yearA = parseInt(yA);
                const yearB = parseInt(yB);

                if (yearA !== yearB) return yearB - yearA;

                const monthOrder = ["JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"];

                // Remove accents for comparison
                const normalize = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                const idxA = monthOrder.indexOf(normalize(mA));
                const idxB = monthOrder.indexOf(normalize(mB));

                return idxB - idxA;
            });

            setAvailableMonths(sortedMonths);

            if (sortedMonths.length > 0 && !selectedMonthYear) {
                setSelectedMonthYear(sortedMonths[0]);
            }

            // Time entries will be fetched in a separate effect when month/week changes
        } catch (e: any) {
            console.error("Fetch Tasks Error:", e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [service, config, selectedMonthYear]);

    // Helper to get Monday of S1, S2... in a month
    const getMondayForWeekLabel = (monthYearStr: string, weekLabel: string) => {
        const parts = monthYearStr.split(' ');
        if (parts.length < 2) return null;
        const monthName = parts[0].toUpperCase();
        const year = parseInt(parts[1]);
        const monthOrder = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
        const monthIdx = monthOrder.indexOf(monthName);
        if (monthIdx === -1) return null;

        const firstOfMonth = new Date(year, monthIdx, 1);
        // Find first Monday
        let firstMonday = new Date(firstOfMonth);
        while (firstMonday.getDay() !== 1) {
            firstMonday.setDate(firstMonday.getDate() + 1);
        }

        const weekNum = parseInt(weekLabel.replace(/\D/g, '')) || 1;
        const result = new Date(firstMonday);
        result.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
        result.setHours(0, 0, 0, 0);
        return result;
    };

    const fetchTimeForSelectedPeriod = useCallback(async () => {
        if (!service || !config || !selectedMonthYear || !selectedWeek) return;
        try {
            const mondayDate = getMondayForWeekLabel(selectedMonthYear, selectedWeek);
            if (mondayDate) {
                const timeList = await service.fetchWeeklyTimeEntries(mondayDate.toISOString(), config.userId);
                setWeeklyTimeEntries(timeList);
            }
        } catch (e: any) {
            console.error("Fetch Time Error:", e);
        }
    }, [service, config, selectedMonthYear, selectedWeek]);

    useEffect(() => {
        if (config) fetchData();
    }, [fetchData, config]);

    useEffect(() => {
        if (config && selectedMonthYear && selectedWeek) {
            fetchTimeForSelectedPeriod();
        }
    }, [fetchTimeForSelectedPeriod, config, selectedMonthYear, selectedWeek]);

    // Timer Effect
    useEffect(() => {
        if (activeTimer) {
            timerRef.current = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - activeTimer.startTime) / 1000));
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setElapsedTime(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [activeTimer]);

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputUrl || !inputKey) {
            setError("URL and Key are required.");
            return;
        }
        const newConfig = { projectUrl: inputUrl, anonKey: inputKey, userId: inputUserId };
        localStorage.setItem('lovable_config', JSON.stringify(newConfig));
        setConfig(newConfig);
        setService(new LovableService(inputUrl, inputKey));
        setShowConfig(false);
        setError(null);
    };

    const handleDisconnect = () => {
        localStorage.removeItem('lovable_config');
        setConfig(null);
        setService(null);
        setTasks([]);
    };

    const updateTaskProgress = async (taskId: string, progress: number) => {
        if (!service) return;
        try {
            const updates: any = { progress };
            if (progress === 100) updates.completed = true;
            await service.updateTask(taskId, updates);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
        } catch (e: any) {
            setError(e.message);
        }
    };

    const toggleTaskCompleted = async (taskId: string, completed: boolean) => {
        if (!service) return;
        try {
            const updates: any = { completed };
            if (completed) updates.progress = 100;
            await service.updateTask(taskId, updates);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
        } catch (e: any) {
            setError(e.message);
        }
    };

    const startTimer = (taskId: string) => {
        setActiveTimer({ taskId, startTime: Date.now() });
    };

    const stopTimer = async () => {
        if (!activeTimer || !service || !config) return;
        const duration = Math.round((Date.now() - activeTimer.startTime) / 60000);
        // Save even short durations (min 0.1 min) to see it in network, but 0 minutes is useless
        const elapsedSeconds = (Date.now() - activeTimer.startTime) / 1000;
        if (elapsedSeconds < 2) {
            setActiveTimer(null);
            return;
        }

        const task = tasks.find(t => t.id === activeTimer.taskId);
        if (!task) return;

        try {
            await service.createTimeEntry({
                user_id: config.userId || 'anonymous',
                client_id: task.projects.client_id,
                task_id: activeTimer.taskId,
                start_time: new Date(activeTimer.startTime).toISOString(),
                end_time: new Date().toISOString(),
                duration_minutes: Math.max(1, duration) // Supabase table might expect int, but we want it saved
            });
            fetchData(); // Refresh time entries
        } catch (e: any) {
            setError(e.message);
        } finally {
            setActiveTimer(null);
        }
    };

    const toggleAccordion = (clientName: string) => {
        setExpandedClients(prev => ({
            ...prev,
            [clientName]: !prev[clientName]
        }));
    };

    // Derived State

    const tasksInMonth = tasks.filter(t => t.projects?.month_year === selectedMonthYear);

    const availableWeeks = Array.from(new Set(tasksInMonth.map(t => String(t.week_number)))).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    });

    useEffect(() => {
        if (availableWeeks.length > 0 && (!selectedWeek || !availableWeeks.includes(selectedWeek))) {
            setSelectedWeek(availableWeeks[0]);
        }
    }, [availableWeeks, selectedWeek]);

    const currentTasks = searchQuery.trim() !== ''
        ? tasks.filter(t =>
            t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.projects?.clients?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        : tasksInMonth.filter(t => String(t.week_number) === selectedWeek);

    const globalProgress = currentTasks.length > 0
        ? Math.round(currentTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / currentTasks.length)
        : 0;
    const totalEstimated = currentTasks.reduce((acc, t) => acc + Number(t.estimated_minutes || 0), 0);
    const totalWorked = currentTasks
        .filter(t => t.completed)
        .reduce((acc, t) => acc + Number(t.estimated_minutes || 0), 0);

    // Group tasks by client
    const groupedTasksRaw = currentTasks.reduce((acc: Record<string, any[]>, task) => {
        const clientName = task.projects?.clients?.name || 'Sans Client';
        if (!acc[clientName]) acc[clientName] = [];
        acc[clientName].push(task);
        return acc;
    }, {});

    // Sort: Clients with pending tasks first, then by name
    const sortedGroupedTasks = Object.entries(groupedTasksRaw).sort(([nameA, tasksA], [nameB, tasksB]) => {
        const remainingA = tasksA.filter(t => !t.completed).length;
        const remainingB = tasksB.filter(t => !t.completed).length;

        if (remainingA > 0 && remainingB === 0) return -1;
        if (remainingA === 0 && remainingB > 0) return 1;
        return nameA.localeCompare(nameB);
    });

    console.log("DEBUG - userId:", config?.userId);
    console.log("DEBUG - weeklyTimeEntries count:", weeklyTimeEntries.length);
    console.log("DEBUG - totalWorked:", totalWorked);

    if (!config || showConfig) {
        return (
            <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-6 items-center justify-center overflow-y-auto">
                <div className="w-full max-w-sm space-y-6 py-10">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuration CRM</h2>
                            {config && (
                                <button onClick={() => setShowConfig(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">Connectez votre Supabase Lovable</p>
                    </div>
                    <form onSubmit={handleSaveConfig} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Supabase Project URL"
                            value={inputUrl}
                            onChange={e => setInputUrl(e.target.value)}
                            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        <input
                            type="password"
                            placeholder="Anon / Public Key"
                            value={inputKey}
                            onChange={e => setInputKey(e.target.value)}
                            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                        <input
                            type="text"
                            placeholder="User ID (UUID) pour le Time Tracking"
                            value={inputUserId}
                            onChange={e => setInputUserId(e.target.value)}
                            className="w-full p-3 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {inputUserId === DEFAULT_USER_ID && (
                            <p className="text-[10px] text-blue-500 font-bold px-1">Identifié comme : {DEFAULT_USER_NAME}</p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                        >
                            Sauvegarder et Connecter
                        </button>
                    </form>
                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Header / Nav */}
            <div className="p-4 bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Planning</h2>
                        {config?.userId === DEFAULT_USER_ID && (
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Utilisateur : {DEFAULT_USER_NAME}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedMonthYear}
                            onChange={(e) => setSelectedMonthYear(e.target.value)}
                            className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer outline-none"
                        >
                            {availableMonths.map(m => (
                                <option key={m} value={m} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-sans uppercase">
                                    {m}
                                </option>
                            ))}
                        </select>
                        <button onClick={() => setShowConfig(true)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors border border-gray-100 dark:border-gray-700">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        <button onClick={handleDisconnect} className="text-xs text-red-500 hover:underline font-bold">Sortir</button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher client ou tâche..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    />
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>

                {!searchQuery && (
                    <div className="flex overflow-x-auto gap-1 mb-4 pb-2 no-scrollbar">
                        {availableWeeks.length > 0 ? (
                            availableWeeks.map((weekVal) => (
                                <button
                                    key={weekVal}
                                    onClick={() => setSelectedWeek(weekVal)}
                                    className={`flex-1 min-w-[50px] py-1.5 text-[10px] font-black rounded-lg transition-all ${selectedWeek === weekVal
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                                >
                                    {weekVal.startsWith('S') ? weekVal : `S${weekVal}`}
                                </button>
                            ))
                        ) : (
                            <div className="w-full text-center py-2 text-[10px] text-gray-400 italic">Aucune semaine trouvée</div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">Progression</p>
                        <p className="text-lg font-black text-blue-700 dark:text-blue-300">{globalProgress}%</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/50">
                        <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase">Restant</p>
                        <div className="flex items-baseline justify-between">
                            <p className="text-xl font-black text-green-700 dark:text-green-300">
                                {Math.max(0, Math.floor((totalEstimated - totalWorked) / 60))}h
                            </p>
                            <p className="text-[10px] font-bold text-green-600/50 dark:text-green-400/30 uppercase">
                                {Math.floor(totalWorked / 60)}h / {Math.floor(totalEstimated / 60)}h
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {sortedGroupedTasks.map(([clientName, clientTasks]) => {
                    const remainingCount = (clientTasks as any[]).filter(t => !t.completed).length;
                    const isAllFinished = remainingCount === 0;
                    const isExpanded = expandedClients[clientName];

                    return (
                        <div key={clientName} className={`rounded-xl overflow-hidden border transition-all ${isAllFinished && !isExpanded ? 'opacity-60 dark:opacity-40 border-transparent bg-gray-50 dark:bg-gray-900/50' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                            {/* Accordion Header */}
                            <button
                                onClick={() => toggleAccordion(clientName)}
                                className="w-full flex justify-between items-center p-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <h3 className={`text-xs font-black uppercase tracking-widest ${isAllFinished && !isExpanded ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                        {clientName}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    {remainingCount > 0 && (
                                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-black px-2 py-0.5 rounded-full min-w-[24px] text-center">
                                            {remainingCount}
                                        </span>
                                    )}
                                    {isAllFinished && <span className="text-[10px] font-bold text-green-500 uppercase">Terminé</span>}
                                    <svg
                                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {/* Accordion Content */}
                            {isExpanded && (
                                <div className="p-4 pt-0 space-y-3">
                                    {(clientTasks as any[]).map(task => (
                                        <div key={task.id} className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100/50 dark:border-gray-700/50 flex flex-col gap-3 group">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={task.completed}
                                                        onChange={e => toggleTaskCompleted(task.id, e.target.checked)}
                                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <div className="flex-1">
                                                        <h4 className={`text-sm font-semibold leading-tight ${task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                                            {task.title}
                                                        </h4>
                                                        <div className="flex gap-2 mt-2 items-center flex-wrap">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${CATEGORY_COLORS[task.category] || 'bg-gray-100'}`}>
                                                                {task.category}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-medium">{task.estimated_minutes} min est.</span>
                                                            {searchQuery && (
                                                                <span className="text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 uppercase font-bold">
                                                                    {task.projects?.month_year} - S{task.week_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {!task.completed && (
                                                    <button
                                                        onClick={() => activeTimer?.taskId === task.id ? stopTimer() : startTimer(task.id)}
                                                        className={`p-2 rounded-lg transition-colors ${activeTimer?.taskId === task.id
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                                    >
                                                        {activeTimer?.taskId === task.id ? (
                                                            <div className="flex items-center gap-1.5 px-1">
                                                                <div className="w-2 h-2 rounded-full bg-white"></div>
                                                                <span className="text-xs font-bold font-mono">
                                                                    {Math.floor(elapsedTime / 60)}:{String(elapsedTime % 60).padStart(2, '0')}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
                                                    <span>PROGRESSION</span>
                                                    <span>{task.progress}%</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="5"
                                                    value={task.progress}
                                                    onChange={e => updateTaskProgress(task.id, parseInt(e.target.value))}
                                                    className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-700 progress-slider"
                                                    style={{
                                                        background: `linear-gradient(to right, #2563eb 0%, #2563eb ${task.progress}%, #e5e7eb ${task.progress}%, #e5e7eb 100%)`
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {tasks.length === 0 && !loading && (
                    <div className="text-center py-10 text-gray-400 space-y-4">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <p className="font-bold">Aucune tâche pour {selectedWeek}</p>
                        <div className="text-[10px] bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 text-left space-y-1 font-mono">
                            <p className="text-blue-500 font-black">Debug Info:</p>
                            <p>Week: {selectedWeek}</p>
                            <p>User ID: {config?.userId}</p>
                            <p className="mt-2 text-gray-500 italic">Vérifiez que vos tâches en base ont bien un numéro de semaine et sont liées à un client ayant cet ID utilisateur.</p>
                            <button
                                onClick={async () => {
                                    if (!service) return;
                                    const dump = await service.debugDump();
                                    console.log("RAW DB DUMP:", dump);
                                    alert("Check console (F12) for raw data dump.");
                                }}
                                className="mt-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300"
                            >
                                Log Raw Data Dump to console
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Toast */}
            {error && (
                <div className="absolute bottom-4 left-4 right-4 bg-red-600 text-white p-3 rounded-lg shadow-lg flex justify-between items-center animate-in slide-in-from-bottom duration-300">
                    <span className="text-sm font-medium">{error}</span>
                    <button onClick={() => setError(null)} className="text-white bg-white/20 hover:bg-white/30 p-1 rounded">✕</button>
                </div>
            )}
        </div>
    );
}
