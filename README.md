# Manager Flavien Extensions 🚀

Ce dépôt contient maintenant deux extensions Chrome spécialisées conçues pour optimiser le flux de travail de Flavien. Ces extensions ont été séparées pour offrir une expérience plus rapide et ciblée.

---

## 📂 Structure des Projets

### [1. Coda Tasks Flavien 📄](./standalone-coda/)
Une extension minimaliste dédiée exclusivement à la gestion de vos tâches quotidiennes synchronisées depuis **Coda**.
- **Focus** : Travail du jour.
- **Vitesse** : Pas de chargement inutile, accès direct à vos lignes Coda.
- **README** : [Voir les détails](./standalone-coda/README.md)

### [2. Lovable Tasks Flavien ⚡](./standalone-lovable/)
Une console de gestion puissante pour le planning global et la recherche.
- **Planning** : Vue par semaines et mois.
- **Recherche** : Moteur de recherche global sur tous les clients et tâches.
- **Stats** : Calcul du temps restant et avancement des projets.
- **README** : [Voir les détails](./standalone-lovable/README.md)

---

## 🛠️ Tech Stack (Shared)

- **Framework**: React + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase / Coda API
- **Chrome APIs**: Side Panel V3

---

## 🚀 Installation & Build

### Commandes Unifiées (depuis la racine)
Vous pouvez maintenant tout builder d'un coup sans changer de dossier :
- **Tout builder** : `npm run build-all`
- **Builder Coda** : `npm run build-coda`
- **Builder Lovable** : `npm run build-lovable`

### Méthode Manuelle
1. Entrez dans le dossier souhaité :
   ```bash
   cd standalone-coda
   # OU
   cd standalone-lovable
   ```

3. Chargez dans Chrome :
   - Allez sur `chrome://extensions/`
   - Activez le **Mode développeur**.
   - Cliquez sur **Charger l'extension dépaquetée**.
   - Sélectionnez le dossier `dist` situé à l'intérieur du dossier de l'extension.

---

## 📝 License

MIT - 2026
