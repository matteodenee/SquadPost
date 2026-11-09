# Roadmap de développement (ordre conseillé)

Chaque étape donne lieu à une PR autonome avec tests, captures de l'interface et démonstration. Ne pas attaquer V2/V3 avant une génération correcte des trois visuels V1.

## Étape 0 — Architecture, initialisation et prototype
- **0.1 — Architecture :** stack validée — React/TypeScript/Vite, NestJS/TypeScript, PostgreSQL/Prisma, Sharp/libvips, volumes Docker privés et Docker Compose avec Caddy.
- **0.2 — Documentation :** consolider les spécifications dans le dépôt et intégrer les décisions fonctionnelles validées.
- **0.3 — Initialisation technique :** créer le monorepo, Docker Compose, les environnements, la CI, les commandes de qualité et la convention de migrations, sans développer encore les fonctionnalités métier.
- **0.4 — Prototype graphique précoce :** charger un fond Barbarians et des photos de test, appliquer une disposition préconfigurée, gérer noms et emplacement vide, produire un PNG et vérifier que le fond reste inchangé hors des zones déclarées.
- Préparer ensuite le jeu de démonstration Barbarians et des comptes de développement non exposés en production.

## Étape 1 — Comptes et clubs
- Authentification e-mail/mot de passe ; création club et invitations.
- Rôles globaux `PLAYER`, `COM_MANAGER` et `ADMIN` contrôlés côté serveur ; les adhésions aux clubs ne portent pas de rôle.
- Préparer l'administration des comptes par `ADMIN`, puis l'isolation multiclub et le changement de club actif.
- Interface mobile-first, tableau de bord prochain match, thème sombre.

## Étape 2 — Effectif
- CRUD joueurs, archivage, profils et postes multiples.
- Catégories photos, upload, crop, remplacement sans historique.
- Import CSV/Excel et validation.

## Étape 3 — Sports, compétitions, matchs
- Initialisation sport rugby + formats 7/10/15.
- Compétitions/saisons, adversaires, calendrier et création de match.
- Contraintes format figées pour les matchs historiques.

## Étape 4 — Éditeur de composition
- Liste joueurs et emplacements de titulaires/finisseurs ; drag & drop et échange.
- Distinguer emplacement sportif et numéro de maillot du match ; proposer le numéro habituel facultatif, autoriser les numéros non consécutifs et signaler les doublons.
- Statuts brouillon/définitive/publiée même incomplet ; publication manuelle ; rôles.
- Persistance et gestion des modifications après publication.

## Étape 5 — Moteur d'affiches V1
- Intégrer les modèles Barbarians de titulaires et finisseurs, puis le fond de présentation.
- Définition/validation des zones via manifeste du modèle ; recadrage et catégories photos.
- Aperçu, sélection du modèle par match, export groupé, partage.
- Sélection des sponsors limitée aux zones disponibles, avec choix explicite en cas de dépassement.
- Utiliser les photos actuelles sans snapshot et ne pas conserver durablement les rendus par défaut.
- Tests visuels sur images de référence, préservation du fond hors zones, export natif et cas incomplets.

## Étape 6 — Mise en situation
- Essai de bout en bout sur un match Barbarians.
- Corrections UX tactile et des écarts de rendu.
- Guide d'installation Ubuntu/Docker, sauvegarde/restauration des données.

## V2 / V3
- V2 événements/scoring/affiches live/statistiques.
- V3 comptes joueurs rattachés aux profils, droits de modification, déploiement public robuste.
- Extension ultérieure du catalogue de sports et de la configuration des modèles.
