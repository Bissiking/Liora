# Poste de travail Liora — 0.4.9

Mode : Operate. Refonte globale de la navigation et des parcours, demandée le 3 octobre 2026. Priorité confirmée : « Refonte globale : navigation et tous les écrans ». Construction en code ; aucune maquette raster approuvée. L’identité Liora, Manrope et les six préférences de thème sont conservées.

## Contrat de direction

THESIS : entrer par ses priorités personnelles, rejoindre le travail collectif sans chercher parmi des icônes.
WORLD : poste de travail LUMA, surfaces mates, traits fins et alignements communs. La marque sauge demeure ; la composition du carnet précédent est remplacée.
FIRST VIEWPORT : sidebar unique de 232 px, marque et sélecteur d’espace en tête, recherche rapide, rubriques textuelles Mon espace / Équipe / Gestion / Réglages ; accueil avec salutation, notifications, sept prochains jours et salons à gauche, rappels et favoris à droite. Aucun indicateur inventé. Les données arrivent depuis les API existantes.
FORM : composition de poste de travail, héritage de l’identité existante ; exploration structurelle surface/operate, seed `c90d0d8e`. Choix construit en code dans le périmètre global confirmé.
PATH : accueil → notification ou événement → ressource ; conversations → index des salons → fil ; projets → tableau → tâche ; réglages → rubrique visible → sauvegarde avec état explicite.
SIGNATURE : commande rapide ⌘/Ctrl K, recherche locale par nom de rubrique ou de salon, flèches et Entrée pour ouvrir, Échap pour revenir. Recherche de messages distincte via ⌘/Ctrl Maj F.
MOTION : transitions de contrôles 160 ms et ouverture du tiroir 180 ms, uniquement pour exprimer un état ; réduction des mouvements respectée.
MOBILE : navigation basse Accueil / Conversations / Projets / Réception / Menu selon permissions ; tiroir global et panneau Salons indépendants ; accueil en une colonne ; rubriques des réglages défilantes ; Kanban défilant sans élargir la page ; cibles principales de 44 px.
STATES : accueil chargé par rubrique, indisponibilité isolée et réessai ; notifications non lues/toutes/lues, marquage en lot avec retour des erreurs ; filtre de pages et de salons avec résultat vide ; enregistrement des préférences occupé et annoncé.
BOUNDARY : aucune modification du contrat serveur ou de l’authentification ; filtres et navigation respectent les permissions déjà reçues. L’archivage existant retire les notifications de la réponse API ; aucune rubrique d’archives simulée.

## Vérification

Chrome headless / Puppeteer sur serveur de production compilé et PostgreSQL de test. Identités Kyros et DropIt issues des fixtures. Captures sous `.impeccable/review/ux-*.png`, ignorées par Git. Résultats et limites dans `DOCS/VALIDATION.md`.

## Extension 0.5.0 — espace personnel et réglages guidés

Périmètre confirmé le 3 octobre : nouveaux univers structurants, dates françaises stables, carte personnelle Burger King « À essayer » et « Visité », visites visibles sur choix, messages à un ami hors ligne, projets/options, calendrier, administration/préférences et aide. Les deux états de carte ont été choisis explicitement par l’utilisateur. Construction en code dans la grammaire Operate/Read du poste Liora ; le contrat et seed 0.4.9 restent l’autorité de navigation, sans nouveau comp approuvé.

FIRST VIEWPORT : action et état de la rubrique avant les réglages secondaires. Les projets exposent le projet/tableau, les modes et filtres en une rangée desktop ; les tâches restent accessibles sans traverser une pile de contrôles. Les réglages utilisent une liste de rubriques stable et une aide spécifique déroulante. L’aide privilégie la recherche et un guide lisible.
OWN-WORLD : Graphite et les six palettes classiques sont conservés. Atelier : ivoire, sérif Georgia sur titres, angles de 2–3px et traits fins. Orbital : clair cobalt, surfaces de 18–24px, marges et cartes aérées. Terminal : mono système, angles droits, rythme régulier et traits techniques. Les palettes ne changent pas la structure ; les nouveaux univers changent police, géométrie, rythme et composition. Les aperçus doivent être isolés du thème courant.
PATH : Mes lieux → recherche ville/adresse/restaurant → résultat sur la carte → À essayer/Visité → notes privées et choix de partage ; Amis → conversation personnelle → envoi durable → lecture ; Projet → Tableau/Liste → filtres → tâche ; Calendrier → Mois/Agenda → rendez-vous ; Réglages → rubrique → aide → sauvegarde.
SIGNATURE : carte et collection synchronisées, épingles de suivi distinctes, « Ils connaissent ce lieu » limité aux visites visibles. Aucun événement automatique depuis la détection de dates ; confirmation avec horaires locaux et fuseau explicite.
MOBILE : Agenda initial à 390px ; rubriques de réglages défilantes ; filtres projet compacts ; carte et liste, panneau de recherche/détail/ajout avant la carte lors de son ouverture ; envoi et historique entre amis accessibles à une main. Pas de débordement du document dans les trois nouveaux thèmes.
STATES : chargement et erreur des données, collection vide et recherche vide, notes toujours privées, visites privées par défaut, message Envoyé/Lu et brouillon conservé après erreur d’envoi, refus d’ajout dans les archives, droits de gestion atomiques.
BOUNDARY : ressources personnelles indépendantes des espaces et réservées aux humains ; historique privé de salon distinct. Fond OSM en ligne, catalogue alimenté par résultat choisi ou ajout manuel et Burger King premier registre. Captures de test avec tuiles SVG synthétiques explicitement marquées, aucun fond réel certifié. Version et migration 007 documentées dans DOCS/RELEASE_0.5.0.md.

## Correction du parcours Mes lieux — 3 octobre 2026

Retour utilisateur après la première livraison : recherche attendue « un peu comme Maps » ; la modale Ajouter un lieu est jugée peu intuitive, notamment les coordonnées. Ce retour prime sur la précédente validation des marqueurs. Le parcours courant conserve le monde Liora et supprime ce blocage.

FIRST VIEWPORT : recherche géographique clairement nommée et validée avec Entrée/bouton ; carte et liste avec adresses, états, zone et attribution OSM. Le filtre de collection est distinct de la découverte. Aucun appel fournisseur pendant la saisie ni ajout de catalogue sans action explicite.
SIGNATURE INTERACTION : résultat → À essayer ou Visité, sans formulaire de coordonnées ; ajout manuel dans un panneau avec point cliqué ou placé au centre de la carte, nom et choix d’état. Date seulement pour Visité ; notes/partage et coordonnées avancées repliés. Une épingle déplaçable confirme l’emplacement.
STATES : recherche occupée, résultat vide, fournisseur indisponible avec Réessayer/ajout manuel, enregistrement annoncé, notes conservées. Le brouillon manuel reste visible en cas d’erreur. Mobile : résultat/détail/formulaire avant la carte ; action Placer sur la carte pour rejoindre celle-ci, placement central accessible au clavier.
BOUNDARY : recherche Photon explicite, meilleure correspondance de zone puis résultats dans un rayon de 15 km, au plus 20, cache/throttle serveur et contrôle humain ; pas de couverture exhaustive ni import en masse. Les E2E utilisent une fixture de recherche, un fond simulé et une position Chrome simulée. Un essai API réel sur Rennes est distinct de cette qualification locale.

## Recherche libre — extension du 3 octobre 2026

Demande utilisateur : basculer en mode libre pour rechercher ce que l’on veut. Le champ garde sa composition et son titre, mais cherche désormais enseignes, lieux, villes et adresses sans restriction Burger King. MacDo/McDo sont reconnus comme McDonald’s. Le résultat est lui-même enregistrable, aucune recherche d’une autre enseigne en arrière-plan.

PATH : texte libre → résultats dans l’ordre fournisseur → À essayer/Visité, ou panneau manuel avec type Lieu libre par défaut. Les catégories et suivis Burger King existants sont conservés.
STATES : résultat vide générique, erreurs et reprise inchangées ; Autour de moi et Rechercher dans cette zone utilisent le texte courant, ou restaurant si vide, avec rayon de 15 km et tri par distance. Recherche libre sans restriction de rayon ; ajouter une ville pour préciser.
BOUNDARY : mêmes limites/cache/identités humaines et données OSM non exhaustives. Migration 008 ajoute seulement Lieu libre. Recherche réelle MacDo/camping testée séparément des fixtures. Composition Liora préservée ; pas de nouvelle maquette ni de monde visuel.
