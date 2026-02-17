# Coda Tasks Flavien 📄

Extension Chrome dédiée pour consulter et gérer vos tâches **Coda** directement dans le panneau latéral (Side Panel).

## ✨ Caractéristiques

- **Focus Quotidien** : Affiche uniquement ce qui compte pour votre journée.
- **Synchro Coda** : Liaison directe avec vos documents Coda.
- **Interface Ciblée** : Pas de menus complexes, juste votre liste de tâches.
- **Accès Rapide** : S'ouvre instantanément via l'icône de l'extension.

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
Cliquez sur l'icône d'information ou les réglages dans l'extension pour renseigner :
- Votre **Coda API Token**.
- L'**URL du document** Coda.
- Le nom de la table et des colonnes (automatique si standard).
