# Context: Extension Todo Flavien

## Goal
Create a Chrome extension based on `extension-todo`, but replacing the default tabs with **Coda** and **Lovable (Tasks)** integrations.

## Features

### 1. Coda Integration
- **View**: Display a specific "Todo of the day" from a Coda doc/table.
- **Selection**:
  - Connect via account.
  - Select which "Todo" (or Kanban board) to display if not automatic.
  - Logic: "Retrieve a kanban and show the todo of the day (match current date)".
- **Sync**: Two-way synchronization. Actions in extension update Coda using Coda API.

### 2. Lovable / Tasks Integration
- **Source**: "Lovable API" or connected DB. (Client provided DB capture).
- **View**: Display "Tasks". Match the visual style provided in captures.
- **Data Structure**:
  - `clients`: 30 rows
  - `projects`: 62 rows
  - `tasks`: 1017 rows
  - `time_entries`: 55 rows
  - *Inferred from description*: Needs to show tasks, likely linked to projects/clients.

## References
### Database Structure (Lovable/Supabase?)
![DB Capture](C:/Users/JBAROSSO/.gemini/antigravity/brain/574df505-4da1-440e-9efc-45b1f0151b71/uploaded_image_0_1769153786324.png)

### Front-end Visual (Desired Result)
![Frontend Capture](C:/Users/JBAROSSO/.gemini/antigravity/brain/574df505-4da1-440e-9efc-45b1f0151b71/uploaded_image_1_1769153786324.png)

## Questions / Blocking Points
- **Coda API**: Need API Token interaction method (User input in settings?).
- **Lovable API**: What is the actual endpoint or SDK? "Lovable" might be the platform (lovable.dev) which uses Supabase. If so, do we use Supabase directly?
- **Auth**: How should the user authenticate for both services?
