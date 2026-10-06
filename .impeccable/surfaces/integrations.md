# Intégrations, webhooks et comptes connectés — 1.0

Mode : Operate. Modules existants dans le shell et la géométrie commune Liora 1.0.0-beta.1. Les intégrations administrées, consentements personnels et publications restent des parcours distincts.

## Direction contract

THESIS : configurer une intégration et comprendre sa portée avant toute publication.
OWN-WORLD : palettes Liora, Manrope, contrôles communs, plans mats et traits fins ; aucun univers décoratif ajouté pour un fournisseur.
STORY : l’administrateur prépare le module, chacun autorise ses ressources personnelles ; un webhook publie dans son canal et garde un historique.
FIRST VIEWPORT : rail/sidebar de portée, titre et liste de modules puis formulaire ; webhook avec éditeur TEXT/EMBED à gauche et aperçu validé à droite ; comptes en lignes avec état/actions.
FORM : surfaces existantes intégrées au shell utilisateur, sans nouveau comp. Mobile : formulaire/aperçu en une colonne, actions accessibles et menus d’entité visibles.
FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Comportement construit

Le menu partagé porte les actions des modules, webhooks et fichiers par clic droit, Maj+F10 et ellipsis. Les menus natifs restent disponibles dans champs et code. Configuration serveur, activation, test et consentement sont explicites ; une clé laissée vide conserve la valeur enregistrée lorsqu’annoncé par le formulaire.

Webhooks génériques TEXT et EMBED partagent validation, aperçu et publication réelle côté application. EMBED utilise une surface secondaire, un trait d’accent supérieur, champs/repli et médias contraints à la largeur disponible. Prévisualiser, tester/publier et lire l’historique ne sont pas des états fictifs. Les permissions de canal restent appliquées côté serveur.

DropIt conserve son partage personnel explicite et l’insertion dans un brouillon. BrainDump reste personnel, autorisé par compte et en lecture seule pour les notes datées ; voir `braindump-integration.md`. Les contrôles propres à la publication en salon ne sont pas affichés pour BrainDump. Google runtime est retiré ; CalDAV porte le parcours officiel dans `personal-070.md`.

## État de fin et preuve

Captures courantes : `v1-webhooks-desktop.png`, `v1-webhook-history-desktop.png` sous `.impeccable/review/`. Reviewer final **ship** après clôture des corrections matérielles du lot 1.0 ; système enregistré dans `DESIGN.md` et `.impeccable/design.json`. Les parcours locaux utilisent des identités et fournisseurs synthétiques ; ils ne qualifient pas une connexion externe ni une livraison en production. Aucun secret réel à reproduire dans les preuves.
