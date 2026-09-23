# Fondations automatiques — version 0.6

## Utilisation

Enregistrer le plan avant de recharger la page. Dans Construction, ouvrir **Fondations auto**, cocher le suivi, choisir **RDC** comme niveau source et appliquer. Les murs du type **Mur extérieur** pilotent la géométrie. Le bouton **Voir les fondations** affiche le niveau Fondations. La superposition structurelle reste disponible.

Deux représentations distinctes : longrines sur semelles isolées avec plots de liaison, ou semelles filantes seules. Les positions d'appui sont géométriques, non dimensionnées. Un entraxe de dessin facultatif ajoute des appuis intermédiaires ; il ne représente pas une portée admissible.

Déplacer un coin, déplacer un mur, modifier sa longueur, créer ou supprimer un mur actualise les fondations. L'annulation, le rétablissement et l'abandon d'un geste avec Échap rétablissent aussi la géométrie dérivée. Les étages ne génèrent pas de doublons : un seul niveau source est utilisé.

Les fondations automatiques sont verrouillées et calculées à l'affichage à partir des murs ; modifier leurs paramètres dans le dialogue, pas leurs poignées. Les éléments manuels ne sont ni effacés ni réécrits. L'option de masquage concerne uniquement les quatre traits intacts de l'exemple initial. Ils restent sauvegardés et réapparaissent lorsque le suivi est désactivé.

## Limites importantes

**AVANT-PROJET NON DIMENSIONNÉ. Aucune conformité structurelle ou réglementaire certifiée.** Les valeurs initiales sont des exemples de représentation, pas des prescriptions pour construire. Le déplacement automatique ne redimensionne ni le béton ni les armatures et ne valide pas les nouvelles portées.

L'outil n'effectue pas de descente de charges, de calcul de capacité portante, de tassement, de ferraillage, de clavetage ou de vérification sismique. Les murs porteurs intérieurs, poteaux, terrains en pente, fondations étagées, mitoyennetés, eaux et prescriptions locales restent hors du générateur. En mode semelles filantes, le soubassement n'est pas généré.

Quelques alertes sont implémentées : niveaux incohérents, murs invalides ou en doublon, contour ouvert, chevauchements d'axes ou de hauteurs, largeur de support inférieure à celle d'un mur, données géotechniques manquantes et profondeur inférieure à une prescription saisie. Ce n'est pas un contrôle exhaustif des normes.

Le contrôle partiel argiles ne s'applique que si l'utilisateur choisit la voie dispositions types et renseigne l'exposition et l'altitude du terrain. Il compare un seuil de profondeur ; les autres dispositions et l'exception de sol dur non argileux exigent une vérification de projet. Renseigner des références d'études ne lit pas ces rapports et ne valide rien. Un changement du plan doit être réexaminé dans les études du projet.

## Références consultées le 23 septembre 2026

- [AFNOR — NF DTU 13.1 P1-1, septembre 2019, exécution des fondations superficielles](https://www.boutique.afnor.org/fr-fr/norme/nf-dtu-131-p11/dtu-131-travaux-de-batiment-fondations-superficielles-partie-11-cahier-des-/fa193423/323032)
- [AFNOR — NF P94-261 + A1, justification géotechnique des fondations superficielles, application de l'Eurocode 7](https://www.boutique.afnor.org/fr-fr/norme/nf-p94261-compil1/justification-des-ouvrages-geotechniques-norme-dapplication-nationale-de-le/fa191352/335850)
- [AFNOR — Eurocode 2, amendement national publié en avril 2026](https://www.boutique.afnor.org/fr-fr/norme/nf-en-199211-na-a1/eurocode-2-calcul-des-structures-en-beton-partie-11-regles-generales-et-reg/fa300801/598195)
- [Légifrance — arrêté du 22 juillet 2020 relatif aux dispositions constructives en zones argileuses](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000042238448)
- [Géorisques — carte RGA 2026 et date d'application aux contrats concernés](https://www.georisques.gouv.fr/donnees/bases-de-donnees/retrait-gonflement-des-argiles-version-2026)
- [Agence Qualité Construction — principe de fondations sur massifs–longrines](https://qualiteconstruction.com/ressource/batiment/lecons-macons-fondations-massifs-longrines/)

Ces fiches de référence ne remplacent pas les textes complets des normes et les études du bâtiment. Aucune implémentation exhaustive des clauses n'est revendiquée.

## Architecture et stockage

Le noyau v0.5 et ses gestes de déplacement sont conservés sans modification dans `engine-v05.html`. `index.html` charge ce noyau dans un cadre de même origine et lui ajoute les modules `foundations-core.js` (géométrie pure) et `foundations-ui.js` (interface, rendu et persistance). Le stockage reste local au navigateur, sous la même clé `planBatimentPro`. Aucun plan utilisateur n'est transmis à GitHub.

La configuration `foundationAutomation` est sauvegardée dans les fichiers JSON de projet et les instantanés annuler/rétablir. Les objets dérivés ne sont pas dupliqués dans les éléments manuels.

## Tests

Contrôles Node : génération, coins partagés, pureté du calcul, suppression, filtrage des niveaux et métiers, entraxes, systèmes distincts, doublons, altitudes, seuils conditionnels et cas sans murs.

Tests d'interface réalisés dans Chromium avec des fichiers locaux injectés hors réseau : déplacement réel d'un coin, annuler/rétablir/Échap, sélection verrouillée, rendu 2D/3D et absence de débordement horizontal à 1024 px. Le stockage local était émulé pour tester la sérialisation et la restauration. Ces essais ne constituent pas une validation structurelle.
