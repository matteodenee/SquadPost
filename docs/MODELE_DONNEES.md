# Modèle de données conceptuel (proposition pour Codex)

Ne pas traiter ce document comme un schéma SQL définitif. Les relations et contraintes ci-dessous constituent le socle métier.

| Entité | Champs essentiels | Relations / contraintes |
|---|---|---|
| `User` | id, email unique, passwordHash, firstName?, lastName?, role (`PLAYER`, `COM_MANAGER`, `ADMIN`), disabledAt?, createdAt | Rôle global unique ; plusieurs adhésions clubs possibles ; un compte désactivé ne peut conserver aucune session |
| `Club` | id, name, shortName, logoAssetId, primaryColor, secondaryColor, primarySportId | Propriétaire de toutes les données de club |
| `ClubMembership` | userId, clubId, status | Unique par user + club ; aucun rôle porté par l'adhésion ; invitation possible |
| `Invitation` | clubId, email, tokenHash, expiresAt, acceptedAt | Invitations sécurisées et expirables |
| `ClubPlayer` | id, clubId, userId?, firstName, lastName, primaryPosition?, usualJerseyNumber?, compositionPhotoId?, inactiveAt?, createdAt, updatedAt | Fiche sportive propre à un club ; compte `PLAYER` facultatif ; un même compte peut être lié dans plusieurs clubs ; numéro facultatif et non unique |
| `PlayerPosition` | playerId, sportPositionId, isPrimary | 1 principale et n secondaires |
| `PhotoCategory` | id, clubId, name, code | Catégories libres par club |
| `PlayerPhoto` | id, playerId, photoCategoryId, assetId, cropData | Une active par (player, category), pas d'historique |
| `MediaAsset` | id, clubId, storageKey, mimeType, sizeBytes, width, height, hasAlpha, createdAt | Fichier original hors base de données, dans un stockage persistant isolé par club ; aucune image en base64 |
| `Sport` | id, name, code | Rugby préchargé |
| `SportFormat` | id, sportId, code, name, defaultStarterCount, defaultFinisherCount | Catalogue extensible de déclinaisons sportives ; Rugby 7/10/15 préchargés avec valeurs proposées |
| `SportPosition` | id, sportFormatId, name, number? | Facultatif/configurable |
| `SportEventType` | id, sportId, name, points, impactsScore, appliesToPlayer?, enabled | Utilisé V2 ; rugby préchargé |
| `Competition` | id, clubId, sportFormatId, name, starterCount, finisherCount, inactiveAt? | Les nombres sont copiés depuis le format puis réglables par compétition ; plusieurs saisons |
| `Season` | id, competitionId, label, startDate?, endDate?, inactiveAt? | Libellé unique par compétition ; dates facultatives ; conservation historique |
| `Opponent` | id, clubId, name, shortName, logoAssetId?, colors? | Réutilisable entre matchs |
| `Match` | id, clubId, seasonId, opponentId, round?, dateTime?, venue?, homeAwayNeutral?, status | Pas de surnombre hors format |
| `Lineup` | id, matchId unique, status, updatedAt | Une composition par match ; statut modifié explicitement, jamais par un export |
| `LineupSlot` | id, lineupId, slotKey, type (starter/finisher), playerId?, jerseyNumber? | Emplacement sportif parfois vide ; joueur unique dans la composition ; numéro du match distinct de l'emplacement et non nécessairement consécutif |
| `LineupRole` | lineupId, roleKey, playerId | Capitaine / buteur / personnalisés |
| `PosterLayout` | id, code, type, dimensions, manifestVersion, slotsJson, status | Disposition préconfigurée et extensible ; indépendante du fond importé |
| `PosterTemplate` | id, clubId, layoutId, name, backgroundAssetId, status | Fond d'un club associé à une disposition compatible ; réutilisable entre matchs |
| `MatchTemplateSelection` | matchId, posterType, templateId | Modèle choisi par match |
| `PosterPhotoOverride` | matchId, posterType, playerId, photoCategoryId? / playerPhotoId?, cropData? | Exceptions graphiques indépendantes du sportif ; référence une photo actuelle du profil sans en créer de copie |
| `Sponsor` | id, clubId, name, logoAssetId | Nombre libre, affichage limité par modèle |
| `PosterSponsorSelection` | matchId, posterType, templateId, sponsorId, slotKey | Sponsors choisis pour les emplacements réellement disponibles dans le modèle |
| `MatchEvent` | id, matchId, eventTypeId, side, playerId?, period?, minute?, metadata | V2, source de vérité score/statistiques |

## Invariants

- Le rôle est global au compte utilisateur. Aucun rôle « propriétaire » n'existe et une adhésion club ne peut pas surcharger le rôle du compte.
- Une fiche `ClubPlayer` peut exister sans compte. Son association éventuelle cible uniquement un compte global `PLAYER` actif et membre du même club.
- Dans le jalon actuel, seul un `COM_MANAGER` membre actif du club gère son effectif ; `PLAYER` consulte uniquement ses fiches associées et `ADMIN` n'accède pas aux données de club.
- La photo de composition JPG/PNG est validée par décodage serveur puis conservée octet pour octet, sans zoom, recadrage ni transformation du visage. Un PNG transparent est recommandé.
- Le format sportif fournit des valeurs par défaut, mais chaque compétition conserve ses propres nombres de titulaires et finisseurs. Une modification ne doit pas affecter les autres compétitions.
- Les identifiants de joueur, photo et modèle ne doivent jamais exposer les données d'un autre club via une requête non autorisée.
- `LineupSlot.slotKey` est unique par composition et correspond à la définition figée du format au moment du match.
- L'emplacement sportif, le statut titulaire/finisseur et le numéro de maillot sont indépendants. Le numéro habituel du joueur ne sert que de proposition initiale.
- Les doublons de numéros de maillot dans une composition doivent être détectés et signalés afin de permettre leur correction ; aucune séquence de numéros n'est imposée.
- Un joueur ne peut être placé qu'une fois dans une même composition ; échange atomique entre deux emplacements.
- Les changements futurs d'un format ne doivent pas réécrire silencieusement les anciennes compositions : figer une **copie de la configuration du format au moment du match** ou versionner le format.
- En V2, le score est recalculé depuis les événements valides, pas maintenu manuellement en parallèle comme unique vérité.
- L'archivage n'efface pas les associations historiques.
- Les compositions historiques conservent les données sportives et les informations du match, pas une copie des photos ni des affiches rendues.
- Une affiche régénérée utilise les photos actuellement disponibles dans les profils. Une photo remplacée peut être supprimée dès qu'aucun traitement en cours ne l'utilise.
- La capacité en sponsors vient des zones du modèle ; une sélection excédentaire est refusée et doit être corrigée explicitement.
