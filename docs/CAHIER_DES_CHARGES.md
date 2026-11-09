# Cahier des charges fonctionnel

## 1. Vision et public

Application web de communication pour clubs sportifs amateurs/universitaires, d'abord utilisée par Barbarians Montpellier, conçue pour pouvoir accueillir d'autres clubs. Rugby livré en premier ; l'architecture prévoit des sports paramétrables et leurs événements. Interface sombre, personnalisable simplement via logo et couleurs de club ; priorité à l'expérience smartphone.

## 2. Périmètre V1 ferme

### Comptes / clubs
- Inscription ouverte par e-mail et mot de passe. Toute inscription publique crée obligatoirement un compte `PLAYER` ; seuls les administrateurs pourront ensuite attribuer un autre rôle.
- Après inscription : créer un club ou rejoindre via invitation.
- Un compte peut être membre de plusieurs clubs, avec changement de contexte.
- Espaces clubs isolés (joueurs, médias, compétitions, modèles, matchs).
- Trois rôles globaux, directement associés au compte utilisateur et contrôlés côté serveur :
  - **`PLAYER`** : accès à son propre compte et à ses propres informations ; les fonctions liées à son profil joueur et à ses photos seront ajoutées ultérieurement ;
  - **`COM_MANAGER`** : rôle principal d'utilisation de SquadPost, destiné progressivement à la gestion des joueurs, de l'effectif, des matchs, des compositions, des visuels et des publications ;
  - **`ADMIN`** : administrateur global de SquadPost, destiné à la gestion des comptes et à l'attribution des rôles `PLAYER`, `COM_MANAGER` et éventuellement `ADMIN`.
- Le rôle ne dépend pas du club. Une adhésion à un club n'attribue aucun rôle différent et il n'existe pas de rôle « propriétaire ».
- Création club : nom, nom court, logo, couleur principale, secondaire, sport principal.

### Effectif et photos
- Création rapide joueur (nom/prénom) ou fiche complète, informations facultatives à compléter plus tard.
- Champs : nom, prénom, surnom, poste principal, postes secondaires, numéro de maillot habituel facultatif, date de naissance, taille, poids, année d'arrivée, club d'origine. **Pas de nationalité** imposée.
- Le numéro habituel peut être proposé lors de la préparation d'une composition, sans jamais conditionner la sélection du joueur ; il peut être absent et ne préjuge ni de l'emplacement sportif ni du numéro réellement porté pour un match.
- Catégories de photos personnalisables par club (ex. sérieuse, drôle, enfant, scorer).
- Une photo active par catégorie et joueur. Remplacer une photo **sans conserver un historique des versions**.
- Import PNG/JPG, recadrage manuel dans l'app, import multiple, et import Excel/CSV de fiches joueurs partiellement remplies.
- En l'absence de photo de la catégorie sélectionnée, silhouette générique par défaut et possibilité de choisir manuellement une autre photo de ce joueur.
- Archivage des joueurs (non-sélectionnables par défaut), sans casser les matchs historiques.
- Détourage automatique NON exigé en V1 : à tester ultérieurement sans garantie de rendu parfait.

### Sports / formats / compétitions / matchs
- Initialiser le sport Rugby et les formats 7, 10, 15 (paramètres éditables), sans saisie manuelle initiale.
- L'architecture distingue **sport**, **format**, **compétition**, **saison**, **match**.
- Un format définit les nombres titulaires/remplaçants et les positions numérotées, avec postes facultatifs/configurables.
- Une compétition fixe son format ; un match de cette compétition doit respecter la capacité prévue, sans surcharge ponctuelle.
- Compétitions/saisons historisées ; un même joueur peut participer à plusieurs compétitions.
- Création match manuelle ou depuis calendrier de saison ; base d'adversaires avec nom, logo, couleurs.
- Informations match : adversaire, compétition/saison, journée, date, heure, lieu, domicile/extérieur/neutre (facultatif), statut à venir/en cours/terminé.

### Compositions
- Une composition sportive enregistrée par match, modifiable même après publication.
- Les compositions des matchs passés conservent les joueurs sélectionnés, leurs emplacements sportifs, leurs numéros de maillot du match, leur statut titulaire/finisseur, leurs rôles et les informations du match.
- Répartition titulaires et finisseurs adaptée au format de compétition.
- Interface glisser-déposer tactile et bureau, avec échange direct entre emplacements y compris titulaires/remplaçants.
- L'emplacement sportif et le numéro de maillot sont deux informations distinctes.
- Le numéro de maillot est attribué **au match**, indépendamment de l'emplacement et du numéro habituel éventuel. Le numéro habituel est proposé par défaut lorsqu'il existe, mais reste modifiable.
- Les numéros de maillot ne sont pas nécessairement consécutifs. L'application signale les doublons au sein d'une composition et permet de les corriger.
- Aucun blocage selon postes habituels : un joueur peut jouer hors poste sans avertissement.
- Rôles de match : capitaine, vice-capitaine, buteur, et rôles personnalisables.
- Pas de workflow de disponibilité joueur.
- Statuts de composition : brouillon, définitive, publiée ; enregistrables même incomplètes. Le passage à « publiée » est exclusivement manuel ; générer ou télécharger une affiche ne change jamais ce statut.
- Une seule composition sportive, mais plusieurs choix graphiques/photos pour les exports.

### Production d'affiches V1
- Générer : **présentation de composition**, **titulaires**, **finisseurs**.
- Importer des fonds vierges PNG/JPG en bibliothèque du club, leur associer une disposition préconfigurée compatible et choisir les modèles au niveau du match.
- Les éléments graphiques permanents sont inclus dans le fond et ne doivent pas être modifiés.
- Le moteur place photos, noms et variables (logos, date, compétition, journée, sponsors) uniquement dans des zones déclarées pour le modèle.
- Catégorie de photo appliquée globalement, avec exceptions individuelles. Au changement de thème, demander si les exceptions doivent être conservées.
- Aperçu avant export ; ajustement manuel du cadrage si besoin.
- Export groupé des trois affiches (et individuel si raisonnable), PNG à la résolution du fond, dimensions de sortie personnalisables en option.
- Utiliser au moment du rendu les photos actuellement disponibles dans les profils. Une ancienne composition régénérée utilise donc les photos actuelles, sans snapshot ni historique de photos.
- Régénérer les visuels après édition de la composition ; ne pas conserver durablement les fichiers rendus par défaut.
- Téléchargement et partage natif quand le navigateur le permet.
- Refuser un modèle incompatible (ex. 14 emplacements pour 15 titulaires) avec erreur compréhensible ; gestion contrôlée des emplacements de joueurs absents.
- Stocker un nombre libre de sponsors par club, mais n'en afficher que dans les zones prévues par le modèle. Si la sélection dépasse sa capacité, signaler le problème et demander quels sponsors conserver, sans déplacer ni superposer automatiquement les logos.

## 3. Phases ultérieures (pas V1 par défaut)

### V2 : score et médias live
- Configurer les types d'événements par sport (valeurs, effet sur score, portée joueur/équipe, création d'affiche possible).
- Préconfigurer le rugby : essai 5, transformation 2, pénalité 3, drop 3 ; cartons, remplacement, blessure et périodes sans effet score.
- Saisir un événement pour son club avec joueur, ou pour l'adversaire sans joueur obligatoire ; score dérivé des événements.
- Modifier/supprimer un événement avec recalcul du score, et durée/chronomètre facultatif.
- Catégorie photo événement par défaut, modifiable individuellement.
- Activer les familles d'affiches live souhaitées : score, essai, mi-temps, fin, homme du match, etc.
- Statistiques joueur (matchs, titularisations, marqueurs) et équipe (V/N/D, points pour/contre, historique).

### V3 : autonomie des joueurs et diffusion plus large
- Invitations joueurs liées à un profil existant ; modification des données personnelles et photos selon permissions/validation à définir.
- Déploiement Internet durable, possibilité d'autres sports et autres clubs à plus grande échelle.

## 4. Exigences non fonctionnelles

- Mobile-first avec navigation adaptée à la taille d'écran.
- Séparation stricte des données par club et permissions contrôlées côté serveur.
- Authentification robuste, mots de passe hachés, contrôle des médias importés, limites d'upload configurables.
- Conserver les originaux nécessaires aux affiches ; éviter les copies inutiles ; suppression/remplacement média sans liens cassés.
- Jobs de génération et exports testés pour exactitude (noms, photos, numéros, cadrage), pas de générateur d'images IA dans la chaîne de rendu.
- Développement et premier hébergement sur Ubuntu via Docker ; monorepo.
