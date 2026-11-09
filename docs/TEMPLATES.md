# Spécification du système de modèles d'affiches

## Intention

L'utilisateur fournit un **fond graphique vierge** (PNG/JPG) intégrant terrain, décorations, badges fixes, bandeaux et cadres. L'application **ne recrée pas ce design**. Elle insère uniquement les contenus variables dans les emplacements prévus.

## Références reçues

1. `Composition « X de départ » des Barbarians(1).png` : 941 × 1671, positions de titulaires 1–10 visibles sur le fond.
2. `Finisseurs Barbarians Montpellier(1).png` : 941 × 1672, positions 16–20, disposées 3 + 2.

> Ces modèles montrent la logique attendue, mais ne définissent **pas** à eux seuls un algorithme fiable pour détecter automatiquement les zones. La présence de cadres « NOM » et de numéros déjà imprimés doit être prise en compte au rendu afin de ne pas les masquer.

## Contrat d'un modèle

Un modèle contient au minimum :
- `id`, `clubId`, `name`, `type` (`intro`, `starters`, `finishers`, puis `live_event`…), `sportFormatId` éventuel.
- `backgroundAssetId`, `layoutId`, `width`, `height`, `mimeType`.
- `slots[]` : emplacements **explicitement configurés** par identifiant, type de donnée, position, taille, couche, adaptation de l'image.
- `requiredSlotCount`, règles d'absence et validations.
- `status` brouillon/prêt, date de création.

Exemple conceptuel (coordonnées **fictives**, pas extraites des deux PNG) :

```json
{
  "name": "Titulaires rugby à X",
  "type": "starters",
  "width": 941,
  "height": 1671,
  "format": "rugby-10",
  "slots": [
    {"key": "player-photo-1", "kind": "player_photo", "playerIndex": 1,
     "x": 120, "y": 600, "width": 150, "height": 160, "fit": "cover", "layer": 1},
    {"key": "player-name-1", "kind": "player_name", "playerIndex": 1,
     "x": 120, "y": 765, "width": 150, "height": 40, "layer": 3}
  ]
}
```

**Important :** si un emplacement `NOM` est déjà imprimé dans le PNG, l'application ne peut pas l'effacer sans altérer le fond. Pour afficher un vrai nom, il faut soit fournir un fond sans le mot « NOM », soit définir une zone opaque propre à recouvrir et redessiner. Même principe pour les numéros fixes : si leur valeur change, la région doit être préparée à cet effet.

## Méthode V1 retenue

- **Pas d'éditeur Canva.**
- Fournir des **dispositions préconfigurées** avec leurs zones, construites une fois pour les trois modèles pilote Barbarians : présentation, titulaires et finisseurs.
- Lors de l'import d'un fond, demander à l'utilisateur de sélectionner une disposition compatible, puis vérifier dimensions, type d'affiche et nombre d'emplacements avant de rendre le modèle disponible.
- Autoriser l'import de nouveaux fonds **compatibles** avec une disposition existante (même géométrie), après prévisualisation.
- Ne pas prétendre qu'une image arbitraire sera automatiquement comprise ; tout nouveau placement requiert une nouvelle définition de zones. Le format de manifeste est versionné afin d'ajouter ultérieurement des dispositions sans reconstruire le moteur. Un éditeur graphique ou de calibration n'est pas prévu en V1.
- Importer plusieurs modèles par club, sélectionner les modèles du match ; génération groupée.

## Règles de génération

1. Charger la composition, son format, le fond et les zones déclarées.
2. Vérifier la compatibilité du nombre d'emplacements titulaires/finisseurs et les champs obligatoires.
3. Pour chaque joueur : photo actuellement disponible dans la catégorie globale, sauf surcharge manuelle ; sinon silhouette ; appliquer recadrage individuel. Aucune copie historique de la photo n'est attachée à la composition.
4. Composer les couches dans l'ordre défini, sans recouvrir les numéros/bandeaux fixes.
5. Remplir les variables préconfigurées : dates, logos, compétition, journée, sponsors, noms et numéros de maillot du match. Le numéro affiché vient de la composition et non de l'emplacement sportif ou du numéro habituel du joueur.
6. Autoriser les places vides avec un rendu explicitement défini, quel que soit le statut de la composition.
7. Montrer l'aperçu puis exporter au format du fond (ou dans un format explicitement sélectionné), sans étirement involontaire.
8. Ne jamais changer automatiquement le statut de publication lors d'un aperçu, d'une génération ou d'un téléchargement.
9. Transmettre le rendu au téléchargement sans imposer sa conservation durable.

## Sponsors

Un nombre libre de sponsors peut être enregistré au niveau du club et réutilisé sur plusieurs affiches ; **le nombre affichable sur une affiche dépend des emplacements configurés dans le modèle**. Si la sélection dépasse cette capacité, l'application signale le problème et demande quels sponsors afficher. Elle ne déplace pas la disposition et n'ajoute aucun logo hors des zones prévues.

## Tests indispensables

- Les numéros de maillot enregistrés pour le match apparaissent au bon joueur, indépendamment des clés d'emplacements et sans supposer une suite consécutive.
- Un doublon de numéros dans la composition est signalé et peut être corrigé avant le rendu attendu.
- Les visages ne débordent pas des emplacements et les noms restent lisibles.
- Une photo manquante utilise la silhouette ou une autre photo sélectionnée.
- Un changement global de catégorie propose le traitement des exceptions individuelles.
- Une composition incomplète donne un export cohérent.
- L'export garde les dimensions et n'écrase pas le fond.
- Les pixels du fond restent inchangés en dehors des zones déclarées, selon une comparaison sur les pixels décodés.
- Erreur explicite si le modèle ne convient pas au format.
- Une sélection de sponsors supérieure au nombre de zones est refusée avec une invitation à choisir les sponsors à conserver.

## Prérequis du prototype

- Les deux PNG fournis semblent inclure déjà le texte « NOM » et les badges numériques : fournir si possible des versions **sans le texte d'exemple** ou des zones de recouvrement propres.
- Les trois fonds Barbarians validés — présentation, titulaires et finisseurs — doivent être ajoutés aux assets du projet.
- Les coordonnées des zones des trois dispositions doivent être mesurées et validées visuellement ; aucune coordonnée ne doit être déduite automatiquement du fond.

## Prototype Barbarians v2 (tâche 0.4 bis)

Les fonds de test `tests/fixtures/templates/barbarians/v2/` mesurent 1122 × 1402 pixels. Le moteur les adapte au format Instagram 1080 × 1350 avec un redimensionnement `cover` centré, sans étirement. Les coordonnées des manifestes v2 sont exprimées directement dans le repère de sortie 1080 × 1350.

Pour les affiches titulaires et finisseurs, les cadres restent visibles dans le fond aplati, mais le moteur redessine également au-dessus des portraits les éléments simples nécessaires à un ordre de calques fiable : cadre, badge et numéro, bandeau, puis nom. Les portraits sont masqués par une forme déclarée dans le manifeste et ne peuvent donc pas recouvrir ces éléments. Le numéro affiché provient de la composition du match ; l'emplacement sportif reste une donnée distincte.

Le fond de présentation v2 contient encore les anciennes équipes, leurs logos, la journée et la date. Le manifeste déclare donc quatre zones opaques contrôlées qui masquent complètement ces informations avant de rendre les nouveaux logos et textes. Les extractions de logos produites par le script de démonstration servent uniquement aux tests : en production, chaque club et adversaire devra fournir un logo PNG transparent indépendant. Un futur fond de présentation réellement vierge éviterait les panneaux de masquage et offrirait un résultat plus fidèle au graphisme original.

Les manifestes utilisés sont versionnés dans `packages/poster-engine/layouts/barbarians/v2/`. La commande `pnpm posters:generate` génère les trois affiches et leurs diagnostics de zones dans `tests/output/barbarians/v2/`.

## Prototype Barbarians v3 (tâche 0.4 ter)

Les fonds de test `tests/fixtures/templates/barbarians/v3/` sont vierges dans toutes leurs zones variables, mais leurs dimensions sources diffèrent. Chaque manifeste déclare donc explicitement sa taille source et son mode de normalisation vers la sortie obligatoire 1080 × 1350. Cette adaptation est propre au modèle et n'est pas codée dans le moteur.

Les manifestes v3 utilisent un rendu `text-only` pour les numéros et les noms : Sharp conserve les badges et bandeaux déjà intégrés au fond et n'ajoute que les glyphes. Les portraits sont confinés par un masque déclaré pour chaque emplacement, sous les bordures, badges et bandeaux du fond. Les paramètres individuels `zoom`, `offsetX`, `offsetY` et le point focal normalisé sont portés par les données du joueur ; ils surchargent les valeurs par défaut du manifeste.

La présentation v3 ne nécessite plus aucune plaque de masquage : journée, logos, noms des équipes et date sont rendus directement dans les zones vierges. Les manifestes sont dans `packages/poster-engine/layouts/barbarians/v3/` et `pnpm posters:generate` produit les affiches et diagnostics dans `tests/output/barbarians/v3/`.

## Prototype Barbarians v5 (tâche 0.4 quinquies)

Les trois fonds V5 sont nativement en 1080 × 1350. Le moteur vérifie leurs dimensions et les utilise sans redimensionnement : les titres, logos, cadres, textures et monuments conservent donc exactement leurs proportions.

Les manifestes déclarent des `protectedRegions` pour les badges numériques. Après insertion des portraits, le moteur extrait ces régions du fond original et les replace comme calque de protection, puis écrit uniquement les chiffres. Cette technique conserve fidèlement les badges aplatis sans en redessiner la forme, la bordure ou l'arrière-plan. Les bandeaux de noms restent également ceux du fond.

Les portraits utilisent par défaut un zoom de 1 avec un point focal normalisé centré légèrement au-dessus du milieu. Les réglages individuels `zoom`, `offsetX`, `offsetY` et `focalPoint` restent prioritaires. Les manifestes V5 sont dans `packages/poster-engine/layouts/barbarians/v5/` et les sorties de contrôle dans `tests/output/barbarians/v5/`.

Pour le jeu de démonstration, les portraits détourés de `tests/fixtures/players/detoures/` sont sélectionnés en priorité lorsqu'un PNG correspondant existe. Leur canal alpha est conservé pendant le recadrage et la composition ; les badges protégés, bordures et bandeaux restent au premier plan. Le script génère aussi une référence JPG et une comparaison côte à côte pour les titulaires et les finisseurs. En l'absence du PNG détouré, le portrait JPG configuré reste utilisable.
