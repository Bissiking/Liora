// src/client/Help.tsx
import { useState } from "react";
import { BookOpen, Search } from "lucide-react";
const guides = [
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
    title: "Configurer un module et ses règles",
    category: "Administration",
    steps: [
      "Dans Administration → Intégrations, ajoutez DropIt, GitHub, Nino, Narra ou un fournisseur générique. Les URL et clés sont enregistrées en base ; aucune variable de module n’est nécessaire.",
      "Pour DropIt, ouvrez Applications connectées dans DropIt et créez une clé avec l’URL de retour indiquée par Liora. Reportez identifiant du client et clé API, puis testez la connexion.",
      "Copiez l’URL entrante et le secret montrés à la création dans le service émetteur. GitHub utilise sa signature native ; les autres modules utilisent par défaut le HMAC horodaté Liora.",
      "Créez une règle avec un type exact ou un préfixe comme github.issues.*, un salon et éventuellement une colonne de tâches. Dès qu’une règle existe, seuls les événements correspondants sont publiés.",
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
      "Après connexion Kyros, votre ami accepte le lien. Un administrateur peut cocher l’autorisation de rejoindre l’espace ; sinon la personne doit déjà en être membre.",
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
      "⌘/Ctrl + K : rechercher un salon ou ouvrir la navigation.",
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
