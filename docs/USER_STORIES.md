# User stories et critères d'acceptation

## US-01 — Créer un club
**En tant que** nouvel utilisateur, **je veux** rejoindre un club via invitation et, si je suis `COM_MANAGER`, pouvoir créer un club, **afin de** gérer un espace de communication.
- Email unique, mot de passe sécurisé.
- Une inscription publique crée toujours un compte `PLAYER` et ouvre directement une session ; aucun rôle privilégié ne peut être choisi dans ce parcours.
- Club créé avec nom, nom court, logo/couleurs, sport principal.
- Une invitation vérifiée ouvre l'accès au club ; aucun accès transversal aux autres clubs.
- Seul `COM_MANAGER` peut créer un club et émettre ses invitations. `PLAYER` rejoint uniquement un club correspondant à une invitation envoyée à son e-mail.
- Le compte possède un rôle global unique : `PLAYER`, `COM_MANAGER` ou `ADMIN`. L'adhésion à un club ne modifie pas ce rôle.
- Toutes les autorisations sont contrôlées côté serveur.

## US-01 bis — Administrer les comptes
**En tant qu'** administrateur global, **je veux** gérer les comptes SquadPost et leurs rôles.
- `ADMIN` peut rechercher, consulter, créer et modifier un compte, puis le désactiver ou le réactiver.
- `ADMIN` peut attribuer `PLAYER` ou `COM_MANAGER`. La promotion `ADMIN` passe par une action séparée avec confirmation explicite.
- Un administrateur ne peut pas modifier son propre rôle, ni désactiver ou rétrograder le dernier administrateur actif.
- La désactivation invalide toutes les sessions du compte et toutes les routes sont protégées côté serveur contre `PLAYER` et `COM_MANAGER`.

## US-02 — Alimenter l'effectif
**En tant que** responsable communication, **je veux** créer un joueur rapidement et compléter ensuite son profil.
- Seuls nom/prénom sont requis dans le flux rapide.
- Le premier jalon permet la recherche, la consultation, la création, la modification et la désactivation/réactivation dans le club actif.
- Une fiche peut exister sans compte utilisateur ; l'association facultative se fait uniquement avec un compte `PLAYER` actif et membre du même club.
- Le poste principal est facultatif dans le premier jalon. Les postes multiples et l'import CSV/Excel restent prévus pour une étape ultérieure.
- Un numéro de maillot habituel facultatif peut être enregistré sans limiter la sélection ni le poste du joueur.
- Les contrôles serveur interdisent à un `COM_MANAGER` d'accéder à l'effectif d'un club dont il n'est pas membre actif. `PLAYER` et `ADMIN` ne peuvent pas le modifier.

## US-03 — Photos et catégories
**En tant que** responsable communication, **je veux** définir les catégories et choisir une photo par joueur/catégorie.
- Le premier jalon accepte une photo de composition JPG ou PNG par joueur, avec prévisualisation avant envoi et recommandation d'un PNG transparent.
- Le serveur vérifie le contenu réel et la taille configurable, stocke le fichier original hors base de données et ne réalise ni zoom, ni recadrage, ni transformation du visage.
- La création de catégories libres, l'import multiple et les informations de recadrage restent prévus pour une étape ultérieure ; l'original devra toujours être conservé.
- Le remplacement de photo supprime l'ancienne version stockée lorsqu'elle n'est plus référencée.
- Le profil ne propose pas d'historique de photos.

## US-04 — Préparer un match
**En tant que** responsable communication, **je veux** choisir une saison/compétition et créer un match.
- Une compétition appartient à un club, sélectionne un sport et une déclinaison, puis permet de régler ses nombres de titulaires et finisseurs à partir des valeurs proposées par le format.
- Rugby 7/10/15 est préchargé ; le catalogue permet d'ajouter ultérieurement d'autres sports et déclinaisons sans changer la structure des compétitions.
- Une compétition possède plusieurs saisons historisées, avec libellé obligatoire et dates facultatives cohérentes.
- Seul un `COM_MANAGER` membre actif du club peut créer, modifier ou désactiver ses compétitions et saisons ; `PLAYER` et `ADMIN` n'y accèdent pas.
- Le format et les nombres enregistrés sur la compétition fixeront le nombre d'emplacements des futurs matchs.
- L'adversaire peut être choisi dans une base ou créé.
- Terrain neutre/domicile/extérieur est facultatif.

## US-05 — Composer l'équipe
**En tant que** responsable communication, **je veux** glisser les joueurs sur les emplacements de titulaires et finisseurs.
- Fonctionne au tactile et à la souris ; une alternative accessible à la manipulation doit exister.
- Glisser un joueur sur un emplacement occupé échange les deux joueurs.
- Le même joueur ne peut pas figurer deux fois.
- L'emplacement sportif et le numéro de maillot du match sont distincts ; le numéro habituel éventuel n'est qu'une proposition modifiable.
- Les numéros ne sont pas obligatoirement consécutifs ; un doublon est signalé et peut être corrigé.
- Une composition partielle est sauvegardable dans les statuts brouillon, définitive et publiée.
- Le passage au statut publiée est manuel ; générer ou télécharger une affiche ne change pas le statut.
- Modification possible en état « publiée ».

## US-06 — Choisir un thème photo
**En tant que** responsable communication, **je veux** choisir « Enfant » pour tous, puis personnaliser certains joueurs.
- Chaque joueur prend sa photo de catégorie si disponible ; sinon silhouette.
- Un remplacement par une autre photo disponible du joueur est possible.
- Changer le thème demande si les exceptions individuelles sont conservées.

## US-07 — Générer les trois visuels
**En tant que** responsable communication, **je veux** sélectionner des fonds compatibles et télécharger mes affiches.
- Aperçu exact et export de la présentation, des titulaires et des finisseurs.
- Contrôle du nombre de zones du modèle avec message d'erreur explicite.
- Chaque fond est associé à une disposition préconfigurée compatible ; aucun éditeur graphique complet n'est requis en V1.
- Conservation du fond ; photos et champs dans les zones déclarées.
- Si trop de sponsors sont sélectionnés, l'utilisateur choisit lesquels conserver dans les zones disponibles ; aucun logo n'est déplacé ou ajouté hors disposition.
- Export groupé et partage natif lorsque disponible.
- Aucune génération d'illustration par IA au moment de l'export.

## US-08 — Modifier après coup
**En tant que** responsable communication, **je veux** corriger un joueur après une première publication.
- Composition modifiable ; visuels régénérés depuis l'état courant.
- Les données sportives du match restent consultables : joueurs, emplacements, numéros du match, statut titulaire/finisseur, rôles et informations du match.
- Une régénération utilise les photos actuellement disponibles dans les profils, sans snapshot des anciennes photos.
- Pas de stockage durable obligatoire des images exportées.

## US-09 — Score live (V2)
**En tant que** responsable communication, **je veux** saisir les événements, y compris ceux de l'adversaire.
- Le score se recalcule après ajout, modification et suppression.
- L'événement adverse n'exige pas d'identité joueur.
- Affiche d'événement générable avec photo de catégorie par défaut modifiable.

## US-10 — Profil joueur
**En tant que** joueur, **je veux** accéder à mon propre compte et à mes fiches existantes sans pouvoir modifier l'effectif.
- `PLAYER` peut se connecter, consulter les informations de son compte et ses seules fiches associées dans les clubs dont il est membre actif.
- Invitation rattachée au bon joueur existant.
- Les droits de modification du profil et des photos seront définis ultérieurement.
