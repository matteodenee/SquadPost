# Plateforme de communication sportive — documentation de cadrage

**Statut :** cadrage fonctionnel consolidé après validation de l'architecture et des décisions de la tâche 0.2 (novembre 2026).
**Nom commercial :** à définir.
**Club pilote :** Barbarians Montpellier.
**But V1 :** enregistrer l'effectif et ses photos, gérer les matchs et compositions, générer les trois affiches (présentation, titulaires, finisseurs) en remplissant des modèles vierges fournis par le club.

## Principes non négociables

- L'application est **mobile-first**, utilisable aussi sur ordinateur.
- Les clubs possèdent des espaces indépendants ; un utilisateur peut appartenir à plusieurs clubs.
- Chaque utilisateur possède un rôle global unique : `PLAYER`, `COM_MANAGER` ou `ADMIN`. Les adhésions aux clubs ne portent pas de rôle.
- Les fonds graphiques fournis ne doivent **pas** être redessinés ou réinterprétés par une IA. Le moteur remplit les zones définies d'un modèle.
- Les nombres de titulaires et remplaçants viennent du format de compétition et ne sont pas modifiables au niveau du match.
- Les compositions incomplètes sont enregistrables en brouillon, comme définitives **ou** comme publiées ; l'export doit gérer explicitement les places vides.
- Une composition sportive par match ; plusieurs variantes graphiques/thèmes peuvent être exportées.
- Les joueurs archivés restent référencés dans les compositions passées.
- Les données sportives historiques sont conservées, mais ni les anciennes photos ni les visuels générés ne sont archivés par défaut.
- L'architecture validée utilise un monorepo React/Vite + NestJS, PostgreSQL avec Prisma, Sharp/libvips, des volumes Docker privés et Docker Compose avec Caddy.

## Documents

- `CAHIER_DES_CHARGES.md` : périmètre et exigences fonctionnelles.
- `TEMPLATES.md` : contrat technique des fonds vierges et du rendu.
- `MODELE_DONNEES.md` : entités et règles de persistance.
- `USER_STORIES.md` : parcours et critères d'acceptation.
- `ROADMAP.md` : mise en œuvre par incréments.
- `DECISIONS_OUVERTES.md` : points à valider avant implémentation des parties concernées.

Les instructions de travail de référence se trouvent dans le fichier `AGENTS.md` situé dans le dossier parent du dépôt Git. Aucun second fichier `AGENTS.md` ne doit être ajouté dans ce dossier documentaire.

## Ressources de référence

Les deux modèles PNG fournis dans la conversation du 6 novembre 2026 :
- `Composition « X de départ » des Barbarians(1).png` — 941 × 1671 pixels, RGBA.
- `Finisseurs Barbarians Montpellier(1).png` — 941 × 1672 pixels, RGBA.

**Attention :** ces images ont été partagées en conversation mais ne sont pas automatiquement dans le dépôt du projet. Le fond de présentation doit également être fourni. Ajouter les trois fonds dans un dossier d'assets autorisé avant de coder le prototype de rendu. Aucun nom de fichier ne doit être considéré comme une API stable.
