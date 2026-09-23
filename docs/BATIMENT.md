# Bâtiment — v0.9

## Statut

Le logiciel reste un outil d'avant-projet : **aucune conformité structurelle ou réglementaire globale n'est certifiée**. Il calcule des géométries, des quantités brutes et des comparaisons partielles de solives. Choisir « béton », « brique », « parpaing » ou « bois » ne dimensionne pas automatiquement un mur porteur ni ses appuis. Les limites de STRUCTURE.md et FONDATIONS.md restent applicables.

## Planchers-niveaux et calcul automatique

Dans Construction, ouvrir **Planchers-niveaux auto**, puis **+ Plancher entre deux niveaux**. Le plancher apparaît comme un niveau structurel distinct dans la barre : par exemple « Plancher RDC → R+1 ». Il ne s'agit pas d'un étage habitable supplémentaire.

Les murs porteurs, murs extérieurs et poutres du niveau inférieur pilotent l'emprise. Le solivage automatique traite les travées fermées rectangulaires, éventuellement tournées, et les subdivisions par appuis intérieurs. Il choisit la portée géométrique la plus courte, avec une option d'inversion. Les cloisons et les autres métiers ne créent pas d'appuis. Les formes ou reprises hors domaine sont signalées, sans inventer de poutres.

La recherche utilise le comparateur bois massif C24 v0.7, avec hypothèses de maintien latéral, charges renseignées et absence de porteur repris. Elle recherche des sections d'essai et uniformise la section de représentation du plancher. Il ne s'agit pas d'un calcul intégral Eurocode 5. Les trémies, transferts de charges, détails d'appui et assemblages nécessitent une étude spécifique. Une dalle béton portée prend une épaisseur saisie depuis l'étude béton ; elle n'est pas dimensionnée à partir de la seule hauteur disponible.

### Hauteurs et couches

Le haut du niveau inférieur est son altitude + sa hauteur de murs. La sous-face de la structure s'y réfère. L'espace disponible au-dessus des appuis est la différence entre cette arase et le sol fini du niveau supérieur. Le plafond et le plénum sont sous la structure et réduisent la hauteur libre du niveau inférieur. Des arases de murs incohérentes sont signalées.

Le plancher matérialise ses couches renseignées : plafond, vide technique, solives ou béton, panneau bois, isolation rapportée, ravoirage, chape et revêtement. Un excédent de hauteur reste une réserve vide, non comptée en béton. Un déficit suspend les solides ; aucune section n'est comprimée pour rentrer. Les couches sont visibles en 2D et 3D, et les vides ont un contour, pas un matériau plein. Les éléments générés sont verrouillés et suivent les murs.

Le bouton **Coordonner les altitudes** propose de décaler le niveau supérieur et les niveaux au-dessus pour accueillir la composition. L'action demande confirmation et est annulable. Elle ne calcule ni les fondations, ni la stabilité de la surélévation. Les zones v0.7 encore actives au même étage doivent être désactivées avant de générer le nouveau plancher, pour éviter les doublons.

## Matériaux et métré par niveau

**Matériaux & métré** permet une composition indépendante par étage. L'épaisseur de représentation est la somme du cœur, des parements et de l'isolation rapportée. **Appliquer la composition aux murs de ce niveau** affecte ses murs extérieurs, porteurs et cloisons ; les autres étages ne changent pas. La modification de l'épaisseur d'un mur affecté répercute la nouvelle épaisseur de cœur dans son métré.

Le tableau distingue béton des voiles/fondations/planchers, maçonnerie, ossature courante, solives, panneaux, chape, ravoirage, isolants, parements et réserves. Les unités de briques/parpaings nécessitent un taux fabricant en unités/m² : aucun taux universel n'est inventé. L'ossature courante est comptée à partir des montants, entraxes et lisses saisis ; cela ne calcule pas ses renforts ou sa résistance.

**Métré estimatif brut**, et non bordereau de commande : longueurs d'axes, ouvertures non déduites, jonctions non dédupliquées, hors linteaux, armatures, accessoires, découpes, contreventements et renforts. Les ouvertures de l'éditeur ne sont pas encore liées assez fiablement pour une soustraction automatique. Les planchers v0.7 non migrés ne sont pas consolidés dans ce nouveau tableau. Les matériaux des poteaux, poutres et dalles manuels non affectés sont indiqués comme non renseignés. Une réserve ou un vide technique n'est jamais quantifié comme béton.

## Gaines et vides techniques

L'onglet **Gaines / vides** sépare : plénum sous structure, ravoirage au-dessus, incorporation dans une chape et passage dans la structure. Aucun percement de solive ni de dalle n'est généré automatiquement.

Le calcul d'encombrement utilise les diamètres extérieurs, deux épaisseurs d'isolant radial et, pour les évacuations, la dénivelée = longueur × pente saisie. L'option côte à côte retient le maximum des hauteurs ; l'option superposée les additionne. Le dégagement global prescrit est ajouté, puis comparé à la hauteur minimale du système saisie. C'est un gabarit de réservation, pas un calcul de réseau ni un contrôle complet des croisements.

Sans dégagement, minimum prescrit et référence applicables, le logiciel indique **minimum complet indéterminé**. Aucune valeur générique de 5, 10 ou 20 cm n'est prétendue réglementaire pour tous les réseaux. Les diamètres préremplis sont des exemples à adapter. La présence de gaz déclenche une demande d'étude spécifique ; une hauteur seule ne vérifie ni ventilation, ni accessibilité, ni fourreaux, ni distances.

### Références de contexte consultées le 23 septembre 2026

- [Cimbéton / Infociments, dossier avec LCA-FFB — chapes et incorporations](https://www.infociments.fr/batiment/dossier-technique-chapes-et-carrelage-chapes-incorporations-et-chapes-traditionnelles-base-de-liants-hydrauliques-5) : le domaine DTU 26.2 distingue le ravoirage des chapes/dalles rapportées ; ne pas incorporer les canalisations horizontales dans ces dernières. Cette règle n'est pas transposée indistinctement à toute dalle structurelle.
- [CSTB — chapes fluides](https://www.cstb.fr/nos-offres/toutes-nos-offres/certification-qb-chapes-fluides) : normes, documents techniques et prescriptions du procédé à consulter.
- [Legrand — NF C 15-100, GTL/ETEL](https://www.legrand.fr/pro/normes-et-reglementations/norme-nf-c-15-100/norme-nf-c-15-100-suivez-le-guide) : le repère ETEL 600 × 250 mm du sol au plafond concerne un volume vertical dédié au logement, pas un plénum horizontal. C'est ici un rappel documentaire, pas une implantation ETEL automatiquement certifiée.
- [GRDF Cegibat — gaz et vide sanitaire en maison individuelle](https://cegibat.grdf.fr/reponse-expert/maison-individuelle-canalisation-gaz-vide-sanitaire) : l'accessibilité, le repère de hauteur 0,60 m et la ventilation appartiennent à ce cas particulier. Ne pas transposer aux ERP ni aux faux plafonds.
- [GRDF Cegibat — gaz dans un faux plafond d'habitation](https://cegibat.grdf.fr/node/181) : solutions sous conditions d'aération, visitabilité ou fourreau. Le module ne les certifie pas.
- [Placo — exemple de système de plafond sous plancher bois](https://www.placo.fr/professionnels/solution/sp00012127/plafonds-stil-flam-plancher-bois-2x-placoflam-ba-15-stil-f-530-stil-flam-et-rail-f-530-06-m-portee) : le plénum indiqué appartient à une configuration et à ses performances précises. Il n'est pas utilisé comme minimum universel.

Les textes complets, annexes nationales, prescriptions du produit, usage du bâtiment et études du projet restent nécessaires. Le module ne constitue pas un inventaire exhaustif des règles en vigueur pour toutes les installations.

## Gestes et vue 3D

Le corps du mur coulisse parallèlement : les murs raccordés s'allongent ou se raccourcissent sur leurs axes. Les angles compatibles restent fixes ; les contraintes impossibles bloquent plutôt que de faire pivoter les voisins. Un coin garde le déplacement libre v0.5. Échap annule le geste ; annuler/rétablir le traite en une seule opération.

La vue 3D et la vue mixte montrent le niveau actif et tous les niveaux inférieurs. Les fondations restent masquées jusqu'à activation de **Afficher les fondations en 3D**. Cette case est seulement une autorisation visuelle, jamais une validation technique des fondations. Les réglages de superposition 2D restent séparés.

## Sauvegarde et tests

Les compositions et liens de planchers sont stockés dans `buildingDesign`. Les niveaux structurels sont reconstruits à partir des liens, sans transformer les objets calculés en dessins manuels. Enregistrer le plan avant de recharger une version.

23 tests de géométrie, calcul partiel, quantités, couches, prescription manquante et sérialisation passent, ainsi que les 16 tests de structure v0.7. Les interactions ont été testées dans Chromium sur un banc hors ligne avec stockage simulé : configuration, coordination de hauteurs, métré, gestes, 3D, fondations opt-in et restauration. Aucune erreur JavaScript observée dans ce scénario. Ce sont des tests logiciels, pas une validation d'ingénierie.
