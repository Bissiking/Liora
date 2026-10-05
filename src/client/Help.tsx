// src/client/Help.tsx
import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
const guides = [
  {
    title: "Trouver mon chemin dans Liora",
    category: "Commencer",
    steps: [
      "L’accueil réunit vos raccourcis et ce qui demande votre attention. La boîte de réception conserve les notifications de l’espace.",
      "Mon espace regroupe les outils personnels. Mes lieux et vos conversations entre amis restent accessibles même sans espace de travail.",
      "Projets, pages et calendrier servent à l’équipe. Les rubriques visibles dépendent de vos permissions dans l’espace sélectionné.",
      "Ouvrez la recherche rapide avec le bouton Rechercher ou le raccourci clavier indiqué. Les réglages personnels se trouvent dans Préférences ; ceux de l’équipe dans Administration.",
    ],
  },
  {
    title: "Mes lieux : à essayer et déjà visités",
    category: "Mon espace",
    steps: [
      "Ouvrez Mes lieux et recherchez une enseigne, un camping, un musée, une ville ou une adresse. Ajoutez une ville pour préciser, par exemple « MacDo Rennes ». Validez avec Rechercher ou Entrée : les résultats OpenStreetMap apparaissent sur la carte et dans la liste. La couverture dépend des lieux référencés ; la liste n’est pas exhaustive.",
      "Choisissez un lieu et cliquez sur À essayer ou Visité : son nom, son adresse et son emplacement sont repris automatiquement. Notes, date et partage permet ensuite de compléter votre suivi ; les notes restent toujours privées.",
      "Si un lieu manque, utilisez Ajouter manuellement, placez un point sur la carte puis indiquez son nom. Les coordonnées sont facultatives, dans Coordonnées avancées. La date de visite n’apparaît que pour un lieu Visité.",
      "Moi uniquement garde la visite privée. Mes amis la montre à vos amis ; Tous les membres de Liora la montre à tout membre connecté. Les lieux du catalogue, leur nom et leur adresse sont communs.",
      "Ouvrez une adresse pour consulter les personnes qui ont partagé une visite avec vous. La liste ne révèle jamais les visites privées ni les notes.",
      "Ma collection recentre la carte sur vos adresses. Autour de moi demande l’autorisation du navigateur, puis recherche votre texte dans un rayon de 15 km ; celle-ci n’est pas enregistrée dans votre profil. Rechercher dans cette zone utilise le centre de la carte. Sans texte, ces deux actions cherchent des restaurants.",
    ],
  },
  {
    title: "Écrire à un ami hors ligne",
    category: "Mon espace",
    steps: [
      "Dans Amis, choisissez Écrire à côté de la personne. La conversation est personnelle et ne nécessite pas d’espace en commun.",
      "Vous devez être connecté à Internet pour envoyer. Votre ami peut être hors ligne : le message est conservé et l’attendra à son retour.",
      "Envoyé signifie que Liora a enregistré le message. Lu signifie que votre ami a ouvert la conversation. Un compteur indique les messages non lus dans Amis.",
      "Si l’envoi échoue, votre texte reste dans la zone de saisie pour réessayer. Retirer une personne des amis ferme l’accès à la conversation ; cela ne supprime pas les messages stockés.",
      "Le réglage Personne dans Préférences → Confidentialité et chat bloque les nouveaux messages privés, même ceux des amis.",
    ],
  },
  {
    title: "Comprendre les dates détectées",
    category: "Conversations",
    steps: [
      "Écrivez par exemple demain à 14h, après-demain à 10h, dans 3 jours à 10h30, 12/10/2026 à 14h ou du 12 au 14 octobre 2026.",
      "Les horaires adjacents sont rattachés à leur date. Une durée comme à 14h pendant 2 heures propose aussi une heure de fin. Une date sans horaire propose une journée entière.",
      "Les expressions relatives restent attachées à la date d’envoi et au fuseau de l’auteur. Elles ne changent pas quand vous relisez le message plus tard.",
      "Les dates impossibles et les horaires ambigus lors d’un changement d’heure ne sont pas proposés. Certaines formulations restent ambiguës : vérifiez toujours la proposition.",
      "Cliquez sur une date pour ouvrir le formulaire de création, puis vérifiez le titre, les horaires et le fuseau. Aucun événement n’est créé automatiquement.",
    ],
  },
  {
    title: "Choisir un univers visuel",
    category: "Préférences",
    steps: [
      "Dans Préférences → Apparence, choisissez un aperçu. Atelier utilise des titres sérif et des lignes nettes ; Orbital adoucit les surfaces ; Terminal utilise une typographie monospace et des angles droits.",
      "Les six palettes classiques restent disponibles. La densité et la taille du texte s’appliquent indépendamment du thème.",
      "Enregistrez pour appliquer votre choix à votre compte. Les réglages ne modifient pas le thème des autres membres.",
    ],
  },
  {
    title: "Organiser et filtrer mes projets",
    category: "Projets",
    steps: [
      "Choisissez un projet, puis un tableau. Sans projet regroupe les tableaux qui ne sont pas encore rattachés à un projet.",
      "Passez du tableau à la liste selon votre manière de travailler. Combinez recherche, priorité, responsable et échéance ; Effacer les filtres rétablit toutes les tâches.",
      "Les options du projet permettent de modifier sa description et de l’archiver. Les options du tableau permettent aussi de le déplacer vers un autre projet.",
      "Créez une tâche depuis sa colonne. Pour la déplacer au clavier, ouvrez-la et changez sa colonne. Les mises à jour détectent les modifications concurrentes.",
      "Restaurez un projet ou tableau archivé avant d’y ajouter ou déplacer une tâche. Les suppressions définitives restent soumises aux permissions et à confirmation.",
    ],
  },
  {
    title: "Parcourir mon calendrier",
    category: "Calendrier",
    steps: [
      "La vue Mois donne une vue d’ensemble. La vue Agenda liste les rendez-vous et s’ouvre par défaut sur un petit écran.",
      "Choisissez un jour pour afficher ses événements. Un nouvel événement commence sur le jour choisi ; vérifiez l’horaire proposé avant de l’enregistrer.",
      "Aujourd’hui revient au mois courant. Les flèches parcourent les mois. La recherche filtre les titres de la période affichée.",
      "Les événements récurrents sont modifiés à l’échelle de la série. Le fuseau et les horaires restent visibles dans le détail.",
    ],
  },
  {
    title: "Connecter DropIt et partager mes fichiers",
    category: "Intégrations",
    steps: [
      "Un administrateur configure d’abord le module DropIt dans Administration → Intégrations, puis teste sa connexion.",
      "Ouvrez votre profil → Comptes connectés → Connecter. Dans DropIt, connectez-vous avec le même compte Kyros, puis autorisez Liora à consulter vos partages.",
      "Mes fichiers affiche vos partages DropIt actifs. Importez d’abord vos fichiers dans DropIt si la liste est vide.",
      "Dans un salon, le bouton de dossier DropIt permet d’insérer un lien dans le brouillon. La confirmation rappelle que tous les fichiers du partage deviennent accessibles aux détenteurs du lien, jusqu’à son expiration.",
      "Déconnecter retire l’accès personnel. Cela ne supprime pas les liens déjà envoyés : révoquez le partage directement dans DropIt pour les invalider.",
    ],
  },
  {
    title: "Retrouver mes notes BrainDump avec une date",
    category: "Intégrations",
    steps: [
      "Dans BrainDump → Applications connectées, créez une application Liora avec l’URL de retour de votre installation. Reportez identifiant et clé dans Administration → Intégrations → BrainDump, puis testez la connexion.",
      "Dans Notes datées, choisissez BrainDump et connectez votre compte. Le même compte Kyros doit être utilisé dans les deux applications. Autorisez uniquement la lecture de vos notes datées.",
      "Activez Lier mes notes BrainDump. Leur titre, contenu et date apparaissent ici ; ils se modifient dans BrainDump. Les tâches, autres types et notes sans date restent à la source.",
      "Retirer l’autorisation dans BrainDump ou déconnecter dans Comptes connectés arrête l’accès. Une révocation détectée retire les copies BrainDump, en conservant les notes originales et les notes Liora.",
    ],
  },
  {
    title: "Configurer un module et ses règles",
    category: "Administration",
    steps: [
      "Dans Administration → Intégrations, ajoutez DropIt ou BrainDump. Son URL et sa clé sont enregistrées en base ; aucune variable de module n’est nécessaire.",
      "Pour DropIt, ouvrez Applications connectées dans DropIt et créez une clé avec l’URL de retour indiquée par Liora. Reportez identifiant du client et clé API, puis testez la connexion.",
      "Copiez l’URL entrante et le secret montrés à la création dans DropIt. Les événements utilisent par défaut le HMAC horodaté Liora.",
      "Créez une règle avec un type exact ou le préfixe dropit.*, un salon et éventuellement une colonne de tâches. Dès qu’une règle existe, seuls les événements correspondants sont publiés.",
      "Le renouvellement change l’URL et le secret : mettez aussi à jour l’émetteur. Désactiver le module bloque ses événements et retire ses connexions personnelles.",
    ],
  },
  {
    title: "Utiliser les commandes de salon",
    category: "Conversations",
    steps: [
      "Saisissez /aide pour afficher les commandes disponibles. Le bouton terminal ouvre aussi cette aide.",
      "Utilisez /salon, /taches suivi éventuellement d’un mot recherché, ou /statut. Les permissions de tâches et de supervision restent appliquées.",
      "Le résultat est visible uniquement pour vous, dans un panneau. La commande ne publie aucun message et ne modifie aucune donnée.",
    ],
  },
  {
    title: "Inviter un ami",
    category: "Commencer",
    steps: [
      "Ouvrez Amis dans la navigation. Cliquez sur Créer une invitation.",
      "Copiez le lien et envoyez-le à la personne de votre choix. Il est valable sept jours et utilisable une fois.",
      "Après connexion Kyros, votre ami accepte le lien. Un administrateur peut cocher l’autorisation de rejoindre l’espace ; sinon l’amitié est créée sans accès à l’espace.",
      "Le lien peut être révoqué depuis Invitations envoyées. Accepter le lien ajoute chacun à la liste d’amis de l’autre.",
    ],
  },
  {
    title: "Écrire, mentionner et partager une image",
    category: "Conversations",
    steps: [
      "Choisissez un salon puis écrivez dans la zone de message. Entrée envoie, Maj + Entrée ajoute une ligne.",
      "Le bouton @ permet de choisir un membre. Son nom s’affiche dans le brouillon et dans les messages.",
      "Le trombone importe un fichier de moins de 1 Mo. Les images PNG, JPEG, WebP et GIF s’affichent dans la conversation.",
      "Un lien direct vers une image HTTPS publique affiche aussi un aperçu. Certains sites bloquent les aperçus ou redirigent leurs liens : le lien reste utilisable.",
      "Le bouton sourire ouvre le catalogue d’emojis, avec recherche française, catégories et teintes de peau.",
    ],
  },
  {
    title: "Épingles et notifications du salon",
    category: "Conversations",
    steps: [
      "Le bouton Épingles affiche les messages épinglés. La liste peut être vide : ce bouton ne choisit pas un message à épingler.",
      "Survolez un message, puis utilisez Épingler. Cette action nécessite la permission MANAGE_MESSAGES. Sur mobile les actions sont visibles à côté du message.",
      "Le bouton de cloche affiche Suivi ou Notifications. Cliquez pour activer ou arrêter le suivi du salon.",
      "Le suivi envoie les nouveaux messages dans votre boîte de réception. Les notifications globales et les sons se règlent dans votre profil.",
    ],
  },
  {
    title: "Répondre dans un fil et retrouver un message",
    category: "Conversations",
    steps: [
      "Sous un message, cliquez sur Ouvrir le fil ou son compteur de réponses.",
      "Répondez dans le panneau du fil. Les réponses restent regroupées et ne remplissent pas le flux principal.",
      "Vous pouvez modifier ou supprimer vos réponses ; les modérateurs peuvent supprimer les réponses des autres.",
      "Rechercher des messages parcourt les salons autorisés. Cliquez sur un résultat pour rejoindre le message, même ancien.",
    ],
  },
  {
    title: "Choisir qui peut vous écrire en privé",
    category: "Confidentialité",
    steps: [
      "Ouvrez votre profil, puis Confidentialité et chat.",
      "Choisissez Tous les membres, Mes amis uniquement ou Personne pour les messages privés.",
      "Une amitié nécessite une invitation acceptée. Les préférences sont recontrôlées à chaque envoi.",
      "Les conversations directes restent limitées à leurs deux participants, y compris pour les administrateurs.",
    ],
  },
  {
    title: "Créer un salon privé et utiliser les groupes",
    category: "Administration",
    steps: [
      "Utilisez + à côté de Salons de l’espace. Choisissez Privé dans Visibilité.",
      "Dans le salon, ouvrez Gérer les accès avec le cadenas. Cochez les membres autorisés, puis enregistrez.",
      "Les groupes se créent dans Administration → Groupes. Ajoutez-y les membres concernés.",
      "Dans les accès du salon, sélectionnez les groupes autorisés. Les gestionnaires de salons gardent accès aux salons privés ; les conversations directes restent exclues de cette règle.",
    ],
  },
  {
    title: "Rédiger une page et vérifier son aperçu",
    category: "Pages",
    steps: [
      "Ouvrez Pages de l’équipe, puis créez une page ou choisissez-en une.",
      "Ajoutez des blocs : texte, titre, liste, code, citation, lien ou contenu embarqué.",
      "Le bouton Aperçu utilise le même rendu que la lecture. Avant enregistrement, il inclut votre brouillon ; les autres voient uniquement la version publiée.",
      "Pour embarquer un board, un message ou une intégration, renseignez son identifiant. Copiez l’identifiant d’un message avec son bouton de copie. Les droits du lecteur restent appliqués.",
      "Les modifications de blocs différents peuvent être fusionnées. Deux modifications du même bloc provoquent un conflit, sans écraser votre brouillon.",
      "L’historique conserve les versions précédentes. Les commentaires permettent d’échanger sans modifier la page.",
    ],
  },
  {
    title: "Organiser les tâches et utiliser un modèle",
    category: "Projets",
    steps: [
      "Créez un projet, un board et des colonnes. Ajoutez une carte dans une colonne.",
      "Ouvrez une carte pour modifier responsable, participants, échéance, priorité, description et checklist.",
      "Importez les pièces jointes depuis la carte. L’activité retrace les champs modifiés et les commentaires sont conservés.",
      "Enregistrez une carte comme modèle pour réutiliser sa description, ses tags et sa checklist. Les fichiers, commentaires et responsables ne sont pas copiés.",
      "Utilisez les réglages du projet ou du board pour renommer, archiver ou supprimer. La suppression est définitive et demande confirmation.",
    ],
  },
  {
    title: "Raccourcis clavier",
    category: "Navigation",
    steps: [
      "⌘/Ctrl + K : ouvrir la commande rapide pour rejoindre une rubrique ou un salon.",
      "⌘/Ctrl + Maj + F : rechercher des messages par salon, auteur et période.",
      "⌘/Ctrl + 0 : retrouver l’accueil et vos priorités.",
      "⌘/Ctrl + 1 : retourner au chat.",
      "⌘/Ctrl + 2 : ouvrir Projets.",
      "⌘/Ctrl + 3 : ouvrir le Calendrier.",
      "⌘/Ctrl + 4 : ouvrir les Rappels.",
      "⌘/Ctrl + 5 : ouvrir les Favoris.",
      "⌘/Ctrl + 6 : ouvrir la Boîte de réception.",
      "⌘/Ctrl + 7 : ouvrir les Pages.",
      "⌘/Ctrl + , : ouvrir les Préférences.",
      "⌘/Ctrl + / : ouvrir l'Aide.",
      "Échap : fermer la navigation latérale ou un dialogue.",
    ],
  },
  {
    title: "Personnaliser votre profil",
    category: "Préférences",
    steps: [
      "Ouvrez votre profil en bas de la navigation. Importez un avatar PNG, JPEG, WebP ou GIF de moins de 1 Mo.",
      "Dans Apparence, choisissez Graphite, Papier, Crépuscule, Minuit, Forêt ou Braise, la densité et la taille du texte.",
      "Dans Notifications, activez les catégories utiles et les sons souhaités. Utilisez Tester le son pour autoriser et vérifier la lecture dans votre navigateur.",
      "Les intégrations personnelles sont des raccourcis HTTPS privés vers vos services ; elles ne donnent pas de droits OAuth ni de synchronisation automatique.",
    ],
  },
  {
    title: "Autoriser la supervision",
    category: "Administration",
    steps: [
      "Ouvrez Administration → Rôles et permissions.",
      "Accordez VIEW_MONITORING au rôle des personnes autorisées, puis attribuez ce rôle dans Membres.",
      "MANAGE_MONITORING permet les opérations de monitoring, dont le heartbeat.",
      "Le retrait d’une permission est appliqué par le serveur et actualise les vues ouvertes. La supervision n’est pas accordée par le nom du rôle.",
    ],
  },
  {
    title: "Gérer sa session Kyros",
    category: "Compte",
    steps: [
      "La connexion passe exclusivement par Kyros. Liora renouvelle la session automatiquement tant que le refresh est valide.",
      "Une panne réseau temporaire conserve la session. L’application réessaie au retour du réseau ou de la fenêtre.",
      "Dans Sessions et appareils, révoquez un appareil que vous n’utilisez plus. Révoquer l’appareil courant vous déconnecte.",
      "Les droits sont définis dans chaque espace Liora ; un rôle Kyros ne donne pas automatiquement accès aux salons.",
    ],
  },
];
export function Help() {
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState(guides[0].title);
  const visible = guides.filter((g) =>
      `${g.title} ${g.category} ${g.steps.join(" ")}`
        .toLocaleLowerCase("fr")
        .includes(q.toLocaleLowerCase("fr")),
    ),
    guide = visible.find((g) => g.title === selected) || visible[0];
  return (
    <div className="help-layout">
      <aside>
        <h1>
          <BookOpen size={25} />
          Aide
        </h1>
        <label className="help-search">
          <Search size={16} />
          <input
            aria-label="Rechercher dans l’aide"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Comment faire…"
          />
        </label>
        <nav aria-label="Tutoriels">
          {visible.map((g) => (
            <button
              key={g.title}
              className={guide?.title === g.title ? "active" : ""}
              onClick={() => setSelected(g.title)}
            >
              <small>{g.category}</small>
              {g.title}
            </button>
          ))}
        </nav>
      </aside>
      <article className="help-article">
        {guide ? (
          <>
            <h2>{guide.title}</h2>
            <p>Les étapes pour le faire dans Liora.</p>
            <ol>
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        ) : (
          <p>Aucun tutoriel ne correspond à cette recherche.</p>
        )}
      </article>
    </div>
  );
}
