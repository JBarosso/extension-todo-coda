# Lovable Tasks Flavien ⚡

La console de gestion avancée pour votre planning global, connectée directement à votre base de données **Supabase** (Lovable).

## ✨ Caractéristiques

- **Planning Global** : Filtrez par mois et par semaine.
- **Recherche Instantanée** : Recherchez une tâche ou un client sur toutes les périodes simultanément.
- **Statistiques d'Heures** : Calcul automatique des heures restantes vs prévues pour garder le cap.
- **Gestion par Clients** : Accordéons intelligents pour grouper vos tâches par projet/client.
- **Chrono Intégré** : Enregistrez vos sessions de travail en un clic.

## 🚀 Installation

1. Installez les dépendances :
   ```bash
   npm install
   ```

2. Générez le build :
   ```bash
   npm run build
   ```

3. Chargez dans Chrome :
   - Allez sur `chrome://extensions/`
   - Activez le **Mode développeur**.
   - Cliquez sur **Charger l'extension dépaquetée**.
   - Sélectionnez le dossier `dist` de ce répertoire.

## ⚙️ Configuration
L'extension utilise vos identifiants Supabase configurés :
- **Project URL**
- **Anon Key**
- **User ID** (Par défaut configuré pour Flavien)
