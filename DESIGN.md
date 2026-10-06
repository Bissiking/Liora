---
name: Liora
description: Conversation et organisation dans un poste de travail personnel et collectif.
colors:
  bg: "#171d23"
  surface: "#20272e"
  surface-2: "#272f37"
  side: "#1c232a"
  text: "#edf0eb"
  muted: "#adb7bd"
  line: "#343d45"
  accent: "#b8dfb4"
  accent-ink: "#213a26"
  hover: "#303a42"
  light-bg: "#f5f5ef"
  light-surface: "#fff"
  light-surface-2: "#e8ebe2"
  light-side: "#eceee6"
  light-text: "#26362d"
  light-muted: "#57685d"
  light-line: "#ced5c8"
  light-accent: "#365f3d"
  light-accent-ink: "#fff"
  light-hover: "#dee5d8"
  dusk-bg: "#191a30"
  dusk-surface: "#25263f"
  dusk-surface-2: "#30314d"
  dusk-side: "#202139"
  dusk-text: "#f0edf9"
  dusk-muted: "#bdb9d1"
  dusk-line: "#45455f"
  dusk-accent: "#d5bcff"
  dusk-accent-ink: "#352548"
  dusk-hover: "#393650"
  midnight-bg: "#0d1117"
  midnight-surface: "#161b22"
  midnight-surface-2: "#1c2128"
  midnight-side: "#0d1117"
  midnight-text: "#e6edf3"
  midnight-muted: "#a2acb9"
  midnight-line: "#30363d"
  midnight-accent: "#58a6ff"
  midnight-accent-ink: "#0d1117"
  midnight-hover: "#21262d"
  forest-bg: "#0f1a0f"
  forest-surface: "#162016"
  forest-surface-2: "#1c281c"
  forest-side: "#0f1a0f"
  forest-text: "#d4e8d4"
  forest-muted: "#a2b6a2"
  forest-line: "#2a3e2a"
  forest-accent: "#7dcea0"
  forest-accent-ink: "#0f1a0f"
  forest-hover: "#1e2e1e"
  ember-bg: "#1a0f0f"
  ember-surface: "#201616"
  ember-surface-2: "#281c1c"
  ember-side: "#1a0f0f"
  ember-text: "#e8d4d4"
  ember-muted: "#c2a5a5"
  ember-line: "#3e2a2a"
  ember-accent: "#e07060"
  ember-accent-ink: "#1a0f0f"
  ember-hover: "#2e1e1e"
  atelier-bg: "#f2efe6"
  atelier-surface: "#faf8f2"
  atelier-surface-2: "#eae5d9"
  atelier-side: "#e8e3d7"
  atelier-text: "#292a26"
  atelier-muted: "#61645a"
  atelier-line: "#c9c5b9"
  atelier-accent: "#375844"
  atelier-accent-ink: "#fffdf5"
  atelier-hover: "#ded9cb"
  atelier-danger: "#9e2937"
  atelier-success: "#29633e"
  atelier-warning: "#805914"
  orbit-bg: "#eaf0f8"
  orbit-surface: "#fff"
  orbit-surface-2: "#f1f5fb"
  orbit-side: "#f8faff"
  orbit-text: "#202b42"
  orbit-muted: "#596883"
  orbit-line: "#cbd6e8"
  orbit-accent: "#2d50c8"
  orbit-accent-ink: "#fff"
  orbit-hover: "#e3ebfa"
  orbit-danger: "#a12540"
  orbit-success: "#206d43"
  orbit-warning: "#815512"
  terminal-bg: "#111714"
  terminal-surface: "#18211b"
  terminal-surface-2: "#212c24"
  terminal-side: "#141d17"
  terminal-text: "#e3eee4"
  terminal-muted: "#a4b7a7"
  terminal-line: "#415648"
  terminal-accent: "#b3e095"
  terminal-accent-ink: "#15200f"
  terminal-hover: "#2a3b2c"
  lagoon-bg: "#edf4f1"
  lagoon-surface: "#fffdf8"
  lagoon-surface-2: "#e1ede7"
  lagoon-side: "#dce9e4"
  lagoon-text: "#19352f"
  lagoon-muted: "#516c61"
  lagoon-line: "#bdd0c6"
  lagoon-accent: "#236e60"
  lagoon-accent-ink: "#ffffff"
  lagoon-hover: "#d0e1d8"
  lagoon-danger: "#a12738"
  lagoon-success: "#20643b"
  lagoon-warning: "#7c5813"
  danger: "#f79494"
  success: "#8ddaab"
  warning: "#ebc17a"
  nav-active: "color-mix(in srgb, var(--accent) 12%, var(--side))"
  selection: "color-mix(in srgb, var(--accent) 13%, var(--surface))"
  accent-hover: "color-mix(in srgb, var(--accent) 88%, var(--text))"
typography:
  display:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "52px"
    fontWeight: 550
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.03em"
  channel-title:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "20px"
    fontWeight: 650
  body:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "14px"
  message:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "14px"
    lineHeight: 1.8
  social-title:
    fontFamily: "\"Manrope Variable\", sans-serif"
    fontSize: "25px"
  detail:
    fontSize: "12px"
  button:
    fontSize: "13px"
    fontWeight: 600
  navigation:
    fontSize: "13px"
  metadata:
    fontSize: "11px"
rounded:
  control: "7px"
  interactive: "8px"
  card: "9px"
  list: "10px"
  avatar: "11px"
  panel: "12px"
  dialog: "13px"
  compact: "5px"
  rail: "15px"
  rail-active: "12px"
spacing:
  control-gap: "8px"
  card-inset: "16px"
  page: "28px"
  page-vertical: "36px"
  page-horizontal: "40px"
  page-mobile-horizontal: "14px"
  row: "14px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.interactive}"
    padding: "9px 13px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "7px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
    width: "100%"
  chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "5px 9px"
  navigation-active:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.text}"
    typography: "{typography.navigation}"
    rounded: "6px"
    padding: "10px"
    height: "44px"
  composer:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  context-menu:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "6px"
    width: "min(260px, calc(100vw - 16px))"
  social-conversation-row:
    textColor: "{colors.text}"
    rounded: "{rounded.list}"
    padding: "12px 10px"
    width: "100%"
  social-list-avatar:
    rounded: "{rounded.panel}"
    size: "38px"
  conversation-avatar:
    rounded: "{rounded.avatar}"
    size: "34px"
  rail-workspace-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.rail-active}"
    size: "48px"
---

# Design System: Liora

## Overview

**Creative North Star: "Le poste de travail LUMA"**

Liora reprend le modèle de navigation de Discord dans son identité existante : rail des espaces, index du contexte, contenu central et contexte utile du canal. Graphite, la sauge et Manrope gardent le poste de travail calme ; les surfaces mates et les traits fins indiquent les frontières sans encadrer chaque message. Les ressources personnelles restent accessibles avec ou sans workspace.

Les dix identifiants de thème sont conservés comme palettes d’un même système. La géométrie, la typographie applicative et les interactions sont communes. La conversation chargée ouvre directement son transcript ; les introductions sont réservées aux états sans message. Le code React et la cascade CSS consolidée constituent la source de vérité, sans maquette raster approuvée.

**Key Characteristics:**

- Rail personnel/workspaces, sidebar contextuelle et corps flexible.
- Manrope auto-hébergée et géométrie commune aux dix palettes.
- Surfaces mates, séparateurs fins, sélection et non-lus explicites.
- Menus d’entité accessibles, rail des serveurs au clic droit/Maj+F10, menus natifs préservés dans les éditeurs.
- Rail mobile, dock personnel et tiroirs de navigation/contexte.

## Colors

Graphite associe des neutres froids, un texte ivoire et une sauge lumineuse. Les primitives du frontmatter sont extraites de `src/client/themes/palettes.css` et `tokens.css` ; les mélanges restent dans leur format CSS source. Les préfixes correspondent aux identifiants persistés, Graphite étant la palette sans préfixe.

### Primary

- **Sauge** (`accent`) et **encre végétale** (`accent-ink`) : commandes principales, liens, focus et sélection du rail.
- **Sauge sombre de Papier**, **lavande de Crépuscule**, **bleu de Minuit**, **vert de Forêt**, **terre cuite de Braise**, **vert éditorial d’Atelier**, **cobalt d’Orbital**, **vert lumineux de Terminal** et **turquoise minérale de Lagune** : substitutions de palette, pas de composants différents.

### Neutral

- **Fond de travail** (`bg`), **surface** et **surface secondaire** (`surface`, `surface-2`) : transcript, champs, composeur et conteneurs.
- **Fond d’index** (`side`) : sidebar et dock ; **trait** (`line`) : frontières et séparateurs.
- **Texte** et **texte secondaire** (`text`, `muted`) : contenu et métadonnées. Le texte des messages utilise `text`, notamment dans Papier.
- **Survol** (`hover`), **sélection** (`selection`) et **sélection de navigation historique** (`nav-active`) : états. La sidebar du nouveau shell sélectionne avec `hover`, le rail avec l’accent plein.

Les états sémantiques réutilisent `danger`, `success` et `warning`, avec libellés explicites ; Atelier, Orbital et Lagune déclarent leurs substitutions. Les autres palettes utilisent les valeurs héritées. Les miniatures de galerie restent isolées de la palette active.

**The Theme Rule.** Utiliser les variables du thème pour le contenu, les surfaces et les états ; accompagner un statut de mots lisibles.

## Typography

**Display Font / Body Font:** Manrope Variable, repli sans-serif, chargée via `@fontsource-variable/manrope` et servie avec l’application.

La même famille relie les dix palettes applicatives. Les titres utilisent une graisse de travail plutôt qu’une police décorative ; les dates et mesures emploient des chiffres tabulaires. Les miniatures historiques Atelier et Terminal conservent des surcharges locales de police dans la galerie, sans modifier la police du compte.

### Hierarchy

- **Display** : titre de connexion, réduit à (36 px) sur mobile.
- **Headline** : titre de page et panneau de réglages ; titre de page réduit à (24 px) sur mobile.
- **Channel title** : identité de la conversation ; réduit à (18 px) sur mobile, avant les actions d’en-tête.
- **Body / Message** : corps de travail, transcript à interligne généreuse, largeur maximale de (75ch) et retours à la ligne rédigés. La préférence de grande taille porte message et composeur à (15 px).
- **Button / Navigation** : commandes et destinations compactes. La sidebar distingue le non-lu par graisse (650), texte et point ; les mentions ajoutent un compte.
- **Social title / Detail** : titres de Messages privés et Amis, réduits à (23 px) sur téléphone ; détails de liste, identité et aide des réglages à taille compacte. Les sections de réglages utilisent (20 px), puis (18 px) sur mobile ; les états vides de l’index utilisent (15 px). Ces tailles locales complètent les rôles communs sans changer la typographie des autres pages.
- **Metadata** : heure, rôle et source, secondaires au contenu. Les valeurs ponctuelles plus petites ne définissent pas une échelle à reproduire.

**The Shared Geometry Rule.** Changer la palette ne change ni le shell, ni la typographie applicative, ni les dimensions des contrôles.

## Layout

Le shell occupe la hauteur disponible (`100dvh`) et distribue rail (68 px), sidebar (236 px) et corps flexible. À (900 px) et moins, rail et sidebar deviennent (64 px / 216 px). Le corps contient une barre de contexte (54 px), puis la surface qui défile indépendamment. Le contexte de canal mesure (260 px), avec minimum (220 px), et quitte la colonne permanente à (1100 px) et moins ; il reste accessible par le bouton de contexte dans un dialogue/tiroir.

À (700 px) et moins, le rail reste visible (56 px), les boutons du rail mesurent (44 px), la sidebar devient un tiroir depuis le bord du rail (`min(284px, calc(100vw - 56px))`) et le dock personnel occupe le bas (60 px), avec adaptation à la zone sûre. La navigation se ferme par action, Échap ou fond de tiroir ; le focus est géré lors de son ouverture et de son retour. Le contenu est inerte pendant l’ouverture de la navigation.

Les pages courantes restent centrées jusqu’à (1400 px). Le shell mobile leur donne des marges de (22 px / 14 px). L’en-tête de canal mobile place l’identité sur une première rangée et les actions sur la suivante ; la description est limitée à une ligne. Les éléments de liste et les messages replient leur contenu dans la largeur disponible. Le Kanban défile horizontalement dans son propre cadre. Les formulaires à deux colonnes, comme les webhooks, passent à une colonne sur mobile.

Messages privés et Amis utilisent toute la largeur et la hauteur disponibles du corps, avec index latéral (300 px), réduit à (250 px) à (1100 px) et moins. L’index et le transcript défilent dans leurs propres zones ; l’en-tête de conversation et le composeur restent dans le viewport. À (760 px) et moins, l’index ou la discussion occupe la surface ; un retour explicite retrouve l’index. Ce seuil appartient aux conversations personnelles, distinct du seuil mobile du shell.

Les paramètres de canal forment un dialogue limité à (880 px), avec navigation latérale (185 px), contenu flexible et hauteur contenue. Les champs défilent au-dessus d’un pied d’actions séparé qui reste visible. À (700 px) et moins, la navigation se replie sur plusieurs lignes, les paires de champs se superposent et les commandes conservent leur cible tactile. L’accès privé intégré partage ce dialogue, son défilement de liste et son pied d’actions ; son entrée autonome garde le défilement naturel.

**The Context Rule.** Le rail choisit la portée ; la sidebar nomme cette portée ; le contenu identifie la ressource ouverte.

## Elevation & Depth

Les surfaces ordinaires sont mates et sans ombre de panneau. Fond, surface secondaire, frontières et états teintés créent la profondeur. Les menus et dialogues utilisent une ombre pour signaler une couche temporaire ; les repères de carte peuvent porter leurs petites ombres propres à la carte. Le dialogue des paramètres de canal retire son ombre propre et utilise le fond modal pour sa séparation. Ces exceptions ne justifient pas des ombres sur les listes de travail.

### Shadow Vocabulary

- **Menu flottant** (`0 10px 35px #0005`) : actions contextuelles.
- **Dialogue** (`0 20px 90px #0007`) : formulaire modal courant.
- **Dialogue de carte** (`0 18px 70px #0007`) : contenu et propriétés d’une tâche.

Les contrôles changent d’état en (150–160 ms) ; le tiroir de navigation se déplace en (180 ms). `prefers-reduced-motion` supprime animations et transitions ainsi que le défilement animé. Le mouvement explique l’ouverture ou l’état ; il ne porte pas de contenu essentiel.

## Shapes

Les contrôles et champs sont légèrement arrondis, les panneaux un peu plus ouverts. Le shell utilise les mêmes formes dans toutes les palettes : boutons de rail à silhouette arrondie, état actif plus serré, sidebar à coins discrets (6 px), avatars et indicateurs distincts. Les champs gardent une bordure fine et le focus visible du shell dessine un trait de (2 px), décalé de (3 px).

Les listes personnelles utilisent le rayon de liste ; leurs avatars gardent une taille fixe et le rayon de panneau. L’avatar d’en-tête reste plus compact. Ces formes complètent les contrôles communs et ne dépendent pas du thème.

Les rayons de la galerie sont une exception locale héritée : miniatures Atelier (2–3 px), Orbital (18–22 px), Terminal (0 px). Ils ne décrivent pas les formes de l’application active et ne sont pas des tokens applicatifs du frontmatter.

## Components

### Buttons

Commandes compactes, texte explicite et icônes de trait.

- **Primary** : accent plein, encre d’accent et survol mélangé au texte du thème.
- **Secondary** : surface et bordure fine ; survol `hover` ; état désactivé à opacité (0.45).
- **Ghost / Icon** : fond transparent, texte secondaire puis texte normal au survol. Les cibles mobiles du shell sont au moins (44 × 44 px).
- **Focus** : visible au clavier ; la couleur seule ne signale pas le rôle d’une action.

### Chips

Petits repères de source, état ou catégorie : texte secondaire, trait fin et coins compacts. Les comptes de mention utilisent accent et encre d’accent ; le point de non-lu accompagne la graisse de navigation. Une réaction sans droit d’ajout conserve son compte dans un élément de lecture, sans callback ni état interactif trompeur.

### Cards / Containers

Conteneurs mats, séparateurs et contenu avant décoration. Les cartes de tâche utilisent titre, extrait Markdown et propriétés ; menus et commentaires gardent leurs actions réelles. Notes datées, activité personnelle et historique webhook privilégient des lignes à traits fins. Le composeur reste une surface distincte au bas du transcript, avec modes de mise en forme et aperçu, sans perdre le brouillon après une erreur d’envoi.

### Inputs / Fields

Fond de travail, texte du thème, bordure et coins de contrôle. Libellés visibles, aide au bon endroit, erreurs écrites et secret masqué quand nécessaire. Le focus des champs teinte la bordure ; le shell ajoute son contour visible. Les éditeurs partagent Markdown et aperçu ; les menus natifs du navigateur restent disponibles dans les champs, zones éditables, code et sélection de texte.

### Navigation

Le rail distingue accueil personnel, messages, workspaces et réglages. La sidebar affiche le nom de la portée, la commande rapide, puis outils personnels ou rubriques/catégories/canaux du workspace. Les catégories se replient par compte. Revenir à un workspace retrouve sa vue et son canal enregistrés dans la session. Les favoris, rappels et activité personnels agrègent les ressources autorisées sans exiger un workspace. Le dock mobile propose Personnel / Amis / Navigation.

### Entity menus and channel context

Un fournisseur partagé centralise les menus des workspaces, canaux, messages, membres, projets, cartes/colonnes, événements, notes, intégrations, webhooks et fichiers. Clic droit, Maj+F10 et ellipsis rejoignent la même liste d’actions, construite selon les droits et l’objet. Dans le rail des serveurs, seul le clic droit ou Maj+F10 ouvre le menu : aucun ellipsis visible. Le menu reste dans le viewport ; flèches, Home/End et Échap déplacent ou rendent le focus. L’en-tête de canal et les messages possèdent des commandes visibles sur téléphone : un seul ellipsis par message remplace la barre d’actions au survol.

Le contexte affiche membres/rôles, fils actifs, épingles et fichiers réels, avec chargement, erreur et états vides. Les profils sont limités à leur portée ; les actions sensibles gardent les droits requis. Réponses et réactions affichent les comptes filtrés par les permissions du compte. Le titre d’un fil actif est un extrait du message d’origine : mentions résolues vers les noms enregistrés de l’espace, marqueurs Markdown retirés, repli « @membre » si le nom manque. Les épingles partagent cet aperçu lisible ; le compte utilise « 1 réponse » ou « n réponses ». Ce libellé dérivé ne crée pas de nom de fil enregistré. Un fil désactivé ne propose pas son entrée.

**The Reachable Action Rule.** Les actions d’entité restent accessibles au clavier. Leur entrée est visible, sauf dans le rail des serveurs qui utilise le menu contextuel ; les contrôles mobiles du shell et du canal gardent une cible de 44 px.

### Personal conversations and channel settings

Messages privés propose recherche et filtres Toutes / Non lues. Amis conserve recherche et filtres Tous / Non lus / En ligne ; Ajouter un ami ouvre le dialogue de création du lien d’invitation ; l’acceptation utilise la route dédiée au jeton. Les avatars de liste mesurent (38 px), ceux de l’en-tête (34 px). La sélection utilise le mélange de thème ; les bulles entrantes utilisent la surface secondaire et les sortantes la sélection, sans ombre. Dates et états Envoyé / Lu restent secondaires au texte.

Les paramètres de canal séparent identité, organisation, fonctionnement et visibilité dans Général. Options associe délai et bascules avec aide ; Permissions explicite Hériter / Autoriser / Refuser pour un rôle ou membre. Les accès privés sélectionnent membres et groupes dans le même dialogue. Les champs et la longue liste défilent, tandis que leur pied d’enregistrement reste visible. Suivre ce canal enregistre immédiatement le choix et conserve les options encore non enregistrées, notamment le délai.

### Webhooks and CalDAV

Le webhook générique distingue TEXT et EMBED, formulaire et aperçu validé, publication/test et historique écrit. Le bloc EMBED réutilise une surface secondaire, une bordure fine et un trait d’accent supérieur, sans imiter un nouveau thème. CalDAV présente serveur/identifiant à copier, accès nommé par appareil, mot de passe visible une seule fois, masquage et révocation. Les guides repliables restent adjacents à cette configuration.

## Do's and Don'ts

### Do:

- **Do** réutiliser le rail et la sidebar de la portée active.
- **Do** conserver les dix palettes et la géométrie applicative commune.
- **Do** utiliser le texte du thème pour les messages, y compris dans Papier.
- **Do** garder les retours à la ligne rédigés et les limites de lecture du transcript.
- **Do** choisir une entrée de menu adaptée à l’objet : clic droit/Maj+F10 sans ellipsis dans le rail des serveurs ; bouton visible lorsqu’il aide ailleurs.
- **Do** laisser les menus natifs dans les champs, le code et le texte sélectionné.
- **Do** garder le Kanban et les listes longues dans leurs cadres de défilement.
- **Do** rendre les états de chargement, erreur, absence de droits et révocation explicites.

### Don't:

- **Don’t** changer police ou rayons applicatifs lorsque seule la palette change.
- **Don’t** ajouter une introduction décorative au-dessus d’une conversation qui contient déjà des messages.
- **Don’t** réserver une action de message au survol sur mobile.
- **Don’t** donner aux réactions en lecture seule l’apparence d’un bouton actif.
- **Don’t** transformer chaque message ou rubrique en carte à ombre décorative.
- **Don’t** afficher des ressources, comptes ou compteurs auxquels le compte n’a pas accès.
