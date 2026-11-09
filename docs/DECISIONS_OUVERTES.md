# Décisions et validations restant à faire

Ce document évite de masquer les ambiguïtés de spécification sous des hypothèses techniques.

## Bloquants pour le prototype du moteur d'affiches

1. **Zones « NOM »/numéros déjà imprimés :** obtenir des fonds réellement vierges de ces textes ou valider un recouvrement contrôlé ; sinon la photo/le nom dynamique peuvent masquer les cadres.

Les trois familles de modèles V1 sont confirmées : présentation, titulaires et finisseurs. Leurs fichiers sources doivent encore être ajoutés aux assets du projet et leurs zones mesurées puis vérifiées visuellement avant le prototype. Il s'agit d'un prérequis matériel, pas d'une décision fonctionnelle ouverte.

## Points métier mineurs

2. **Titulaires/finisseurs** : modèle graphique explicitement rattaché à la taille attendue de l'effectif ; gestion des formats de rugby nouveaux/sur mesure.
3. **Statistiques V2 :** règles de calcul précises (rencontres abandonnées, cartons, remplacements, participation).

## Décisions techniques à prendre avec étude comparative

4. Politique de sauvegarde et de restauration des volumes PostgreSQL et médias sur Ubuntu.
5. Politique RGPD pour photos de joueurs et photos d'enfance : droit d'image/consentement, suppression, droits d'accès, informations de rétention.

Ne pas considérer ces points ouverts comme des fonctionnalités approuvées.
