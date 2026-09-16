---
name: Liora
description: Carnet de liaison numérique, compact et calme, pour l’équipe LUMA.
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
  primary-hover: "#cbe8c8"
  nav-active: "#303d38"
  nav-active-text: "#d0e6cd"
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
  light-primary-hover: "#294c30"
  light-active: "#dce8d7"
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
  dusk-rail: "#151629"
  dusk-nav-active: "#39304e"
  dusk-nav-active-text: "#eadcff"
  dusk-avatar: "#453c5b"
  dusk-primary-hover: "#e4d2ff"
typography:
  display:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "clamp(40px, 5.2vw, 77px)"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "27px"
    fontWeight: 650
    letterSpacing: "-0.03em"
  help-title:
    fontSize: "30px"
    lineHeight: 1.2
  help-step:
    fontSize: "14px"
    lineHeight: 1.85
  emoji:
    fontSize: "26px"
    lineHeight: 1.2
  conversation-title:
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "14px"
  message:
    fontSize: "14px"
    lineHeight: 1.85
  button:
    fontSize: "12px"
    fontWeight: 600
  channel:
    fontSize: "13px"
    fontWeight: 500
rounded:
  compact: "5px"
  control: "7px"
  card: "10px"
  container: "12px"
  dialog: "13px"
spacing:
  control-gap: "8px"
  form-gap: "13px"
  card-inset: "16px"
  layout-gap: "20px"
  page-inset: "38px"
  reading-mobile-inset: "24px"
  reading-inset: "40px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "7px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  tag:
    textColor: "{colors.muted}"
    rounded: "{rounded.compact}"
    padding: "5px 9px"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-text}"
  help-topic-active:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "12px"
  emoji-button:
    typography: "{typography.emoji}"
    padding: "7px 2px"
    backgroundColor: "transparent"
  group-members:
    rounded: "{rounded.card}"
    padding: "16px"
  monitoring-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.container}"
    padding: "22px"
---

# Design System: Liora

## Overview

**Creative North Star: "Le carnet de liaison numérique"**

Un carnet de liaison numérique pour le studio : un index étroit, un fil de conversation continu et une table de travail. Le graphite, le texte ivoire et la sauge structurent un environnement calme et compact ; les séparateurs fins et les alignements portent la hiérarchie. Papier et Crépuscule déclinent ce même carnet, respectivement en papier chaud et sauge foncée, puis en bleu nuit et lavande.

Mode de conception : Operate, construction directe en code, choisie dans le cadre de la délégation explicite du brief. Ce document fusionne la direction initiale avec les extensions construites en 0.2.1, d’après `src/client/styles.css`, les composants React et les captures de revue desktop/mobile, aide, amis, Crépuscule, emojis, lecture de page, groupes et board mobile. Il décrit le système construit ; les tokens de couleur correspondent aux variables du thème ou aux états effectivement présents dans le CSS.

**Key Characteristics:**

- Navigation compacte et contenu central lisible.
- Surfaces mates, séparateurs fins et accent sauge ou lavande selon le thème.
- Manrope variable auto-hébergée et chiffres tabulaires pour les mesures.
- États exprimés en mots ; tiroir de navigation sur mobile.

### Historique de direction

La direction initiale consignait sept pistes : régie studio, carnet de production, bulletin d’équipe, signalétique d’atelier, dossier de bibliothèque, tableau d’expédition et carnet de liaison numérique. La septième a été retenue. Les confrontations conceptuelles consignées étaient : affiche de parc (écartée, discipline de palette), catalogue (compétitif en densité mais moins lisible), tensegrité (écartée, états explicites), nuage (écarté, repos visuel), spectrogramme (compétitif sur l’alignement mais trop abstrait), terminal (écarté, continuité du transcript). Les invariants retenus sont la densité ordonnée, peu de couleurs, les états en mots, les alignements fixes et l’historique continu. Cette trace décrit des décisions de conception, sans constituer une preuve de prototypes comparatifs rendus.

## Colors

Une sauge lumineuse sur des gris graphite, avec des textes ivoire et gris bleuté. Les tokens du frontmatter sont normatifs ; les variantes `light-*` correspondent aux substitutions du thème Papier et `dusk-*` à celles de Crépuscule. Les trois thèmes conservent typographie, densité, rayons et structure.

### Primary

- **Sauge** (`accent`) : action principale, espace actif, liens, focus et disponibilité.
- **Encre végétale** (`accent-ink`) : texte des actions sur fond sauge.
- **Sauge de survol** (`primary-hover`) : retour visuel du bouton principal sombre. Le thème clair emploie son propre survol sombre avec texte blanc.

- **Lavande** (`dusk-accent`) : accent de Crépuscule, repris par les actions principales, le bouton d’envoi et le focus. Son encre et son survol sont propres à ce thème.

### Neutral

- **Graphite** (`bg`) : fond principal du travail.
- **Feuillets** (`surface`, `surface-2`, `side`) : contrôles, panneaux, navigation et niveaux secondaires.
- **Ivoire** (`text`) et **gris de lecture** (`muted`) : contenu principal et informations secondaires.
- **Trait** (`line`) et **survol** (`hover`) : séparations et états des contrôles.
- **Sélection de navigation** (`nav-active`, `nav-active-text`) : salon ou rubrique courante.

Crépuscule superpose bleu nuit, feuillets indigo et texte lilas clair ; le rail et le bandeau sont plus sombres, la sélection des salons et de la navigation est prune, les avatars ont leur propre fond. Le logo conserve sa sauge. Les tokens décrivent les substitutions réellement présentes, sans affirmer que chaque couleur locale historique est remplacée.

La palette claire utilise un papier légèrement chaud et une sauge foncée. Certaines pièces gardent une identité sombre, notamment le rail des espaces ; les substitutions réelles du CSS font autorité. Les états d’erreur et d’indisponibilité utilisent des tons terre cuite locaux, accompagnés de texte.

## Typography

**Display Font / Body Font:** Manrope Variable, avec repli sans-serif, importée via `@fontsource-variable/manrope` et servie avec l’application.

Une seule famille donne de la continuité au produit. Le corps de base et les messages sont à 14 px ; le fil utilise une interligne ample et une largeur maximale de 75 caractères. L’option « grande » porte le texte des messages et du composeur à 15 px.

### Hierarchy

- **Display** : titre de connexion, échelle fluide ; passe à 45 px sur mobile.
- **Headline** : titre de page courant ; titres de salon plus compacts à 18 px, puis 17 px sur mobile.
- **Conversation title** : entrée dans un salon ; 24 px sur mobile.
- **Help title / Help step** : titre de guide à 30 px, réduit à 25 px sur mobile ; étapes à 14 px et interligne 1.85.
- **Emoji** : glyphes Unicode à 26 px ; leur dessin dépend de la police emoji native du système.
- **Body / Message** : contenu de travail. Les paragraphes généraux ont une interligne de 1.7 ; les messages suivent leur token propre.
- **Button / Channel** : commandes compactes et index des salons.
- **Métadonnées** : principalement 10–12 px ; certains détails secondaires restent à 8–9 px. Les horaires de messages et les mesures utilisent des chiffres tabulaires. Cette extraction ne constitue pas une certification globale d’accessibilité.

## Layout

L’application occupe la hauteur dynamique de la fenêtre (`100dvh`). Desktop : rail des espaces de 66 px, index de 235 px, contenu flexible et contexte de 239 px. Le bandeau supérieur mesure 62 px. Le transcript défile indépendamment du composeur, conservé au bas du salon.

- À partir de 1500 px, l’index passe à 254 px et le contexte à 270 px ; les marges du transcript et du composeur passent à 38 px.
- Jusqu’à 1200 px, le contexte disparaît, les cibles de supervision se rangent sur une colonne et les marges courantes diminuent.
- Jusqu’à 900 px, le rail mesure 55 px et l’index 212 px ; les sous-navigations de pages, préférences et administration deviennent horizontales.
- Jusqu’à 700 px, le rail disparaît, l’index devient un tiroir fixe de 260 px avec voile, et le contenu prend toute la largeur. Le bandeau mesure 55 px. Les pages utilisent 19 px de marge horizontale.

Les pages courantes sont centrées avec une largeur maximale de 1500 px. Le board conserve des colonnes et un défilement horizontal ; sur mobile elles mesurent entre 265 et 280 px. La préférence de densité compacte réduit l’espacement vertical des messages.

L’aide suit une composition de lecture : index secondaire de 280 px sur fond de navigation, recherche et sujets à gauche ; article de 850 px maximum avec 40 px de marge interne. À 700 px et moins, l’index passe au-dessus de l’article, les sujets deviennent une rangée horizontale défilante (180 px minimum par sujet) et l’article prend 24 px de marge. Le flux vertical porte alors toute la lecture.

Sur mobile, chaque message répartit avatar et contenu sur deux colonnes (29 px et largeur restante). La rangée d’actions vient sous le contenu, dans sa colonne, avec retour à la ligne, espacement de 5 px et boutons d’au moins 36 × 36 px. Les commandes du board, les amis et le bloc d’invitation peuvent se replier sur plusieurs lignes.

## Elevation & Depth

La profondeur vient surtout des changements de ton et des traits de séparation. Les surfaces de travail restent sans ombre. Le CSS conserve une ombre pour le petit sélecteur historique (`0 8px 24px #0005`) et celle de la boîte de dialogue (`0 20px 90px #0007`). Le catalogue Unicode actuel emploie le dialogue natif et son voile, comme les autres fenêtres modales. Le dialogue et le tiroir mobile possèdent un voile sombre distinct.

Les changements de fond et de bordure des boutons durent 0.16 s. Le tiroir se déplace en 0.22 s avec une décélération `cubic-bezier(0.22, 1, 0.36, 1)`. La préférence `prefers-reduced-motion: reduce` coupe transitions, animations et défilement animé.

## Shapes

Les angles sont adoucis sans devenir des pilules : petits tags et boutons d’icône, contrôles, cartes, puis conteneurs suivent les rayons du frontmatter. Le composeur et les cartes de tâche utilisent le rayon carte ; les colonnes et cartes de supervision utilisent le rayon conteneur. Les avatars et boutons d’espace sont des carrés arrondis. Les bordures ordinaires font 1 px. Les icônes Lucide ont un trait de 1.75 ; leur taille varie selon le contrôle.

## Components

### Buttons

Le bouton courant associe surface, bordure et texte ; le bouton principal utilise sauge et encre avec une graisse de 750. Le survol change le fond et la bordure. Un bouton désactivé passe à 0.45 d’opacité et utilise le curseur d’indisponibilité. Le bouton d’icône reste transparent au repos. Le focus clavier global utilise un contour sauge de 2 px, décalé de 3 px.

### Chips

Le tag général a un contour fin, une graisse de 650 et un texte de 10 px. Les étiquettes de tâche, le badge bot et les réactions sont des variantes locales plus compactes. Les réactions sélectionnées ont un fond et un contour végétaux.

### Cards / Containers

Les cartes de tâche portent un titre-action, des étiquettes et un pied d’informations ; elles offrent un curseur de déplacement. Les cartes de supervision regroupent nom, état, mesure, historique et date du dernier contrôle. Leur contour visuel provient du fond, sans ombre décorative.

### Inputs / Fields

Les champs utilisent le fond principal, une bordure fine et la couleur de texte du thème. Leur bordure prend l’accent au focus ; les placeholders emploient le texte secondaire. Les formulaires utilisent des libellés visibles, et les erreurs de formulaire sont annoncées via `role="alert"`. Les dialogues natifs défilent intérieurement et gardent leur en-tête visible.

### Navigation

Le rail identifie les workspaces par monogrammes. L’index rassemble recherche, rubriques et groupes de salons. L’élément courant est teinté de sauge ; le profil reste en pied de navigation. Le tiroir mobile conserve cet index. Les boutons de navigation sont alignés à gauche, avec icône puis libellé.

### Transcript et composeur

Les messages forment une liste continue avec avatar, auteur, heure et texte. Les séparateurs de date traversent le fil. Les actions se révèlent au survol ou au focus à l’intérieur du message ; elles restent visibles en rangée sous le contenu sur mobile. Le composeur est un conteneur bordé avec zone de saisie, outils et bouton d’envoi. Les raccourcis sont expliqués sous la saisie. Les mentions affichent les noms des membres ; les résumés résolvent ces noms avant de tronquer le texte.

Les images partagées apparaissent dans le fil, avec 12 px de séparation, une largeur maximale de 420 px et une hauteur d’image plafonnée à 340 px, sans rogner l’image. Leur contour fin et leur rayon carte suivent le carnet. Les aperçus de liens sont des blocs bordés limités à 480 px, avec 14 px de marge interne, titre et métadonnées secondaires. Le lien textuel reste présent.

### Aide et lecture des pages

L’aide met en avant une recherche, une catégorie par sujet et des étapes numérotées. Le sujet courant utilise le fond de survol et le texte d’accent ; les étapes sont séparées par 25 px. La lecture de page conserve le titre, les blocs et les citations, avec un groupe compact de commandes « Modifier / Aperçu » et « Historique ». Le libellé distingue explicitement version publiée, brouillon non publié et édition. L’aperçu utilise le même rendu des blocs que la lecture ; les commentaires restent séparés par un trait.

### Amis et invitations

La liste d’amis utilise des rangées, un avatar, un nom et un état de présence écrit accompagné d’un point ; les actions sont alignées à droite sur desktop. Les rangées ont 18 px de marge verticale et une séparation fine. Le lien d’invitation occupe un feuillet mat avec champ copiable, validité et bouton « Copier ». Les invitations envoyées exposent leur état et leur expiration dans des lignes compactes ; ces informations ne sont pas portées uniquement par une couleur.

### Catalogue d’emojis

Le dialogue « Choisir un emoji » rassemble recherche française, catégorie, teinte de peau et nombre de résultats. Les caractères sont des emojis Unicode natifs, sans images de substitution. La grille de neuf colonnes passe à sept sur mobile ; son défilement est limité à 340 px de haut. Chaque bouton a un nom accessible ; le survol utilise le fond du thème et le focus reprend le contour global. Chargement et erreur sont exprimés en texte.

### Groupes et cases à cocher

Les groupes sont des boutons compacts suivis d’un formulaire. Les membres occupent un `fieldset` avec légende, rayon carte, marge interne de 16 px et espacement de 12 px. Chaque case conserve son libellé sur une même ligne horizontale avec un écart de 10 px ; cette disposition reste explicite dans les formulaires, sans hériter de leur empilement vertical. La commande d’enregistrement peut porter le retour « Groupe enregistré ».

### Historique de supervision

La bande de contrôles colorés est complétée par une section native `details/summary`. Chaque entrée affiche date, état écrit, détail et latence disponible. Cette alternative textuelle reste utilisable au clavier et au toucher. Le statut, les unités et les informations de contrôle utilisent désormais 11 px. Les revues précédentes ont traité le survol principal clair et cet historique accessible. Le dernier verdict « ship » de 0.2.1 a seulement confirmé la résolution du P2 sur les mentions tronquées avant résolution des noms ; il ne constitue pas une certification de toute l’application.

## Do's and Don'ts

### Do:

- **Do** conserver le fil continu de conversation et ses repères de date.
- **Do** utiliser les couleurs du thème pour les nouveaux textes et contrôles, y compris Crépuscule.
- **Do** conserver les repères textuels de publication, présence, invitation et enregistrement.
- **Do** accompagner les signaux colorés de leur état écrit et conserver l’historique détaillé des contrôles.
- **Do** garder les actions accessibles au clavier et visibles sur mobile.
- **Do** respecter la préférence de réduction des mouvements.

### Don't:

- **Don't** remplacer le système de séparateurs et de surfaces mates par des ombres décoratives.
- **Don't** transformer chaque message du transcript en carte isolée.
- **Don't** employer le survol comme seul accès à une action sur mobile.
- **Don't** assimiler la palette claire à une simple inversion des couleurs.
