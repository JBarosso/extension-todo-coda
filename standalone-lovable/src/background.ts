import { getTodos } from './services/storageService';

// Set sidePanel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Initialize alarms
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed, creating alarms');
    // Removed refreshData alarm as GitHub/Gmail are removed
});

// Alarm handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('[Background] Alarm triggered:', alarm.name);

    if (alarm.name.startsWith('reminder_')) {
        await handleReminderAlarm(alarm.name);
    }
});

// Reminder checking logic
async function handleReminderAlarm(alarmName: string) {
    const parts = alarmName.split('_');
    if (parts.length === 3) {
        const todoId = parts[1];
        const reminderMinutes = parseInt(parts[2]);

        const todos = await getTodos();
        const todo = todos.find(t => t.id === todoId);

        if (todo && !todo.completed) {
            await chrome.notifications.create(alarmName, {
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Rappel de tâche',
                message: `${todo.title} commence dans ${formatReminderTime(reminderMinutes)}`,
                priority: 2,
                requireInteraction: false
            });
        }
    }
}

function formatReminderTime(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        return `${hours} heure${hours > 1 ? 's' : ''}`;
    } else {
        const days = Math.floor(minutes / 1440);
        return `${days} jour${days > 1 ? 's' : ''}`;
    }
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
    // Open sidepanel
    const windows = await chrome.windows.getAll();
    if (windows.length > 0 && typeof windows[0]?.id === 'number') {
        const winId = windows[0].id;
        await chrome.sidePanel.open({ windowId: winId });
    }
    chrome.notifications.clear(notificationId);
});
