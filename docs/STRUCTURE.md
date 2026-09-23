# Structure — version 0.7

## Statut des résultats

**AVANT-PROJET / COMPARAISONS PARTIELLES. NON VALIDÉ POUR CONSTRUIRE.**
Le logiciel n'est pas un moteur de dimensionnement normatif complet, un bureau d'études ni un contrôle de conformité. Les résultats numériques sont ceux d'un modèle simplifié, avec les hypothèses détaillées ci-dessous. Une section qui passe les filtres ne constitue pas une section d'exécution. Les valeurs préremplies et compositions sont des exemples, non des prescriptions.

Le DTU précise des règles de l'art et des clauses types ; son applicabilité contractuelle et les textes réglementaires doivent être distingués. Les fiches et extraits consultés ne remplacent pas la lecture des normes complètes, annexes nationales et documents du projet.

## Utilisation

Enregistrer le projet avant de recharger la page. La version doit afficher **v0.7**.

**Minima des fondations** : saisir les profondeurs prescrites hors-gel / étude de sol, l'altitude du terrain horizontal, l'exposition et la voie applicable aux argiles. L'option de suivi augmente seulement les profondeurs/sections inférieures aux seuils connus. Elle ne réduit pas un élément déjà plus profond ou plus grand. Activer aussi le générateur existant « Fondations auto » pour voir le résultat. Les éléments manuels restent hors de cet automatisme.

**Dalles & solivage** : ajouter une zone, choisir le niveau du plancher fini, le niveau des appuis, puis deux appuis parallèles et la composition. Les appuis sont des murs extérieurs, murs porteurs ou poutres du plan. Choisir explicitement les hypothèses du scénario bois avant de rechercher une section. Appliquer enregistre la configuration dans le projet, mais il faut encore utiliser Enregistrer pour conserver le projet dans le navigateur.

Une zone couvre seulement le recouvrement de deux segments d'appui parallèles ; ce n'est pas une reconnaissance automatique de toutes les pièces. Créer des zones sans recouvrement. Les dimensions entre axes servent au modèle ; la portée libre entre faces est aussi affichée. L'appui réel, les pénétrations dans les murs et sabots ne sont pas dimensionnés. Le dessin représente une géométrie d'étude, pas un détail de pose.

Les solives sont générées au niveau du plancher, visibles dans la structure et dans les superpositions de niveaux choisies. Elles restent verrouillées. Déplacer les murs ou leurs coins recalcule portée, entraxe, nombre et section d'essai lorsque la recherche est activée. Si les appuis cessent d'être parallèles, ou si les hypothèses ne sont plus valables, le tracé est suspendu.

Les données sont enregistrées dans `structureDesign`, liées par identifiants aux supports. Les objets dérivés ne sont pas sauvegardés comme des objets manuels. Annuler, rétablir, exporter/importer et restaurer le projet conservent les paramètres. Le moteur de gestes v0.5 et le générateur v0.6 sont conservés.

## Fondations : contrôles précis, mais partiels

La profondeur sous le terrain n'est ni la hauteur d'une semelle ni celle d'une longrine.

Le calcul retient le maximum des **seuils connus** : hors-gel saisi, ancrage prescrit par l'étude, ancienne prescription saisie, et, lorsque la voie dispositions types argiles est sélectionnée, 0,80 m en exposition moyenne ou 1,20 m en exposition forte. L'exception de sol dur non argileux n'est pas interprétée automatiquement. Les autres dispositions de l'arrêté, notamment le vide sanitaire hors sous-sol, restent à vérifier.

Pour les **semelles filantes** et après confirmation du domaine NF DTU 13.1, le contrôle utilise les minima d'exécution de 0,20 m en hauteur et 0,40 m en largeur. Cela ne justifie ni la capacité portante ni le ferraillage et ne doit pas être transposé à la hauteur des longrines. Les sections prescrites des semelles isolées et longrines sont des entrées d'étude.

Si une donnée manque, le logiciel indique que le minimum complet reste indéterminé. La capacité portante, les tassements, la nappe, le terrain en pente, l'effet des voisins, la sismicité et la descente de charges sont hors du module. Augmenter l'épaisseur d'une semelle ou longrine peut rendre l'empilement vertical incompatible : l'alerte existante bloque cette géométrie.

## Dallage ou dalle portée

Le bouton 120 mm reporte un seuil d'épaisseur de béton pour un **dallage sur terre-plein de maison individuelle dans le domaine du NF DTU 13.3 P1-1-2**, sous réserve notamment des charges d'exploitation du domaine, au plus 2,5 kN/m². Ce n'est pas une validation des couches de support, de l'isolation, des joints, des armatures ou du sol. Ce n'est pas non plus l'épaisseur finie avec revêtement.

Le seuil n'est pas appliqué aux dalles portées, sur vide sanitaire ou aux planchers d'étage. Leur épaisseur est une donnée d'étude béton ou fabricant. Aucun ferraillage, béton précontraint ou système poutrelles-hourdis n'est calculé. Le générateur de terre-plein est suspendu lorsque la voie dispositions types argiles requiert une autre vérification ; aucun sous-sol n'est supposé.

Le bouton manuel « Dalle » de l'éditeur historique reste un dessin indépendant et n'est pas validé par ce nouveau module.

## Comparateur de solives

### Domaine limité

Bois massif C24, section rectangulaire nette, deux appuis simples parallèles, portée d'axe à axe au plus 8 m, classe de service 1 ou 2, chargement d'habitation. Le maintien latéral est une hypothèse à justifier. Pas d'entaille, perçage, assemblage déformable, matériau dégradé, porte-à-faux, trémie ou mur/poteau porté. La présence d'une trémie au niveau bloque par précaution toute génération automatique à ce niveau.

Le choix « aucun porteur repris sur la travée » est une hypothèse de scénario, pas une analyse du bâtiment. Une détection géométrique de murs/poteaux à l'intérieur de la zone complète ce garde-fou ; elle ne remplace pas la descente de charges.

L'entraxe est réparti uniformément pour ne pas dépasser la valeur demandée, avec une ligne de solive à chaque bord. Le nombre est plafonné à 250 intervalles. Les zones inclinées avec appuis parallèles sont traitées ; les appuis non parallèles ne le sont pas.

### Données et calculs implémentés

- C24 d'étude : flexion caractéristique 24 MPa, cisaillement caractéristique 4 MPa, E moyen 11 000 MPa, G moyen 690 MPa, masse volumique moyenne 420 kg/m³.
- Hypothèses simplifiées : coefficient matériau 1,30 ; modification 0,60 pour permanent seul, 0,80 pour les cas avec exploitation ; coefficient de fluage 0,60 en classe de service 1 ou 0,80 en classe 2. Aucun bénéfice de système ou de taille. Largeur efficace au cisaillement limitée par un coefficient 0,67. Stabilité latérale supposée assurée, non vérifiée.
- Combinaisons examinées : 1,35 G ; 1,35 G + 1,50 Q uniforme ; 1,35 G uniforme + 1,50 P concentrée. Q et P sont ici des cas alternatifs. Pas de neige, vent, séisme, incendie ni charges de chantier.
- Poutre simplement appuyée : inertie b h³ / 12, module de flexion b h² / 6. Moments uniformes q L² / 8 et ponctuels P L / 4. Pour l'enveloppe de cisaillement/réaction, la charge ponctuelle est aussi considérée près d'un appui, sans réduction favorable.
- Déformations de flexion et de cisaillement estimées avec E et G moyens. Flèche finale comprenant le fluage, avec coefficient quasi permanent d'étude 0,30 pour l'habitation.
- Filtres de préétude choisis : flèche instantanée variable L/300, flèche finale L/300, L/400 ou L/500 suivant l'objectif saisi ; souplesse de la solive isolée sous 1 kN au plus 1,5 mm ; fréquence unidimensionnelle indicative au moins 8 Hz. **Ces deux derniers filtres ne constituent pas une vérification vibratoire complète du plancher.** Les plafonds, revêtements fragiles et cloisons peuvent imposer des critères spécifiques non traités.

Les constantes sont exposées pour rendre le modèle vérifiable ; elles ne prouvent pas l'implémentation intégrale de l'Eurocode 5 ou de son annexe nationale. Les tableaux fabricants, normes complètes et détails de l'ouvrage priment. L'application ne réalise ni contrôle de compression perpendiculaire aux fibres, ni justification des sabots, assemblages, diaphragmes, panneaux, déversement réel, feu ou acoustique.

La recherche parcourt un jeu de sections d'essai nettes (pas un catalogue commercial garanti), retient une faible aire satisfaisant les filtres, ou n'en propose aucune. Chaque modification des charges et de la portée relance la comparaison. Une proposition peut nécessiter une fabrication spécifique ou un autre matériau ; sa disponibilité n'est pas vérifiée.

### Léger / alourdi / lourd

Ces mots sont des descriptions des compositions, **pas une classification normative universelle selon un seuil de masse**. L'application distingue bois sans chape, bois avec chape et béton. Elle affiche surtout G en kN/m² et son équivalent de masse en kg/m².

Le poids est calculé d'après les épaisseurs et densités saisies, plus revêtements, plafond, isolant et cloisons. Le poids de toutes les solives est ajouté au total de la zone. La masse volumique de béton retenue est une hypothèse de poids volumique de 25 kN/m³, à remplacer par une étude adaptée si le produit réel diffère. Les compositions d'exemple ne sont pas des prescriptions.

La charge d'exploitation et la charge ponctuelle sont des entrées de scénario habitation (exemples initiaux 1,5 kN/m² et 2 kN). Le comparateur automatique refuse des valeurs inférieures à ces exemples dans son domaine habitation ; il ne couvre pas tous les usages ou toutes les annexes de charges.

## Ajout d'étages et coordination des hauteurs

Un étage nouveau doit recevoir ses propres zones et appuis. Les niveaux sans plancher défini sont signalés. Les charges de chaque zone et leurs réactions simplifiées sur les deux lignes d'appui sont affichées séparément, hors murs et toiture. Il n'existe pas de total bâtiment : les recouvrements de zones ne sont pas contrôlés et aucune réduction liée au nombre d'étages n'est appliquée.

**Le nombre d'étages n'est pas un multiplicateur arbitraire des charges sur les solives inférieures.** Un étage supplémentaire impose de réexaminer les transferts vers murs, poteaux, poutres et fondations. Il n'entraîne pas un agrandissement prétendument réglementaire de toutes les fondations ou sections.

Le bouton de coordination prépare l'altitude du plancher fini et la hauteur des deux murs d'appui à partir de l'objectif de hauteur libre et de l'épaisseur composée. Les autres murs, étages, toiture et escaliers ne sont pas déplacés. Ces modifications sont effectuées seulement à l'application du dialogue et sont annulables. La commande n'est pas proposée comme un dimensionnement de poutre d'appui.

## Références consultées le 23 septembre 2026

- AFNOR, NF DTU 13.1 P1-1, septembre 2019 : https://www.boutique.afnor.org/fr-fr/norme/nf-dtu-131-p11/dtu-131-travaux-de-batiment-fondations-superficielles-partie-11-cahier-des-/fa193423/323032 — minima de semelle filante, §9.3 ; ancrage et hors-gel, §8.
- Légifrance, arrêté du 22 juillet 2020, article 2 : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000042238448
- CSTB, NF DTU 13.3, édition de décembre 2021 : https://boutique.cstb.fr/Detail/Documents-Techniques-Unifies/DTU-NF-DTU/13-Fondations/NF-DTU-13-3-Travaux-de-dallages-Conception,-calcul
- AFNOR, NF DTU 13.3 P1-1-2 : https://www.boutique.afnor.org/fr-fr/norme/nf-dtu-133-p112/travaux-de-dallages-conception-calcul-et-execution-partie-112-cahier-des-cl/fa190588/317419
- Cemex, précautions d'emploi d'un dallage (corroboration du seuil, les spécificités du produit ne sont pas généralisées) : https://www.cemex.fr/produits/betons/evolution-polymere-dalle
- AFNOR, NF EN 1995-1-1 COMPIL 2 : https://www.boutique.afnor.org/fr-fr/norme/nf-en-199511-compil-2/eurocode-5-conception-et-calcul-des-structures-en-bois-partie-11-generalite/fa191476/318309
- AFNOR, annexe nationale française : https://www.boutique.afnor.org/fr-fr/norme/nf-en-199511-na/eurocode-5-conception-et-calcul-des-structures-en-bois-partie-11-generalite/fa163225/35259
- FCBA / CODIFAB, Guide d'initiation à la charpente (méthodes d'étude, pas mise à jour exhaustive des normes) : https://www.codifab.fr/actions-collectives/guide-dinitiation-la-charpente-575
- FCBA, recherches sur le comportement vibratoire : https://www.fcba.fr/travaux/vibois-comportement-vibratoire-plancher-bois-et-confort-lie-a-la-marche/

## Vérifications logicielles réalisées

16 tests automatisés de calcul, géométrie, hypothèses bloquantes, minima conditionnels, sensibilité à la portée/charge et sérialisation. Tests d'interaction dans Chromium avec un banc hors ligne et stockage simulé : saisie, recherche, coordination, dessin 2D/mixte, fondations liées, annuler/rétablir et restauration de projet, sans erreur JavaScript observée. Ces tests ne constituent pas une validation d'ingénierie ou un audit de conformité normative.
