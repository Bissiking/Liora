// src/client/HelpHint.tsx
import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
export function HelpHint({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="help-hint">
      <summary>
        <CircleHelp size={16} />
        {title}
      </summary>
      <div>{children}</div>
    </details>
  );
}
export const preferenceHelp: Record<string, { title: string; text: string }> = {
  profile: {
    title: "Où apparaît mon profil ?",
    text: "Votre nom et votre avatar apparaissent dans les conversations et les visites partagées. Le statut Invisible masque votre présence ; vos amis peuvent toujours vous écrire.",
  },
  appearance: {
    title: "Comment choisir mon thème ?",
    text: "Atelier, Orbital et Terminal changent la typographie, les formes et les espacements. Graphite, Papier et les quatre palettes conservent la présentation classique. Choisissez un aperçu, puis enregistrez. La densité et la taille du texte restent indépendantes.",
  },
  notifications: {
    title: "Quels réglages affectent mes notifications ?",
    text: "Activez les catégories que vous souhaitez recevoir. Les sons et les notifications système sont deux réglages distincts. Pour les notifications système, autorisez aussi Liora dans votre navigateur.",
  },
  privacy: {
    title: "Qui peut m’envoyer un message ?",
    text: "Le réglage des messages privés s’applique aux salons privés et aux conversations entre amis. Personne bloque les nouveaux envois, sans effacer l’historique. Masquer votre présence ne bloque pas les messages.",
  },
  sessions: {
    title: "Quand révoquer une session ?",
    text: "Révoquez une session si vous ne reconnaissez pas l’appareil ou si vous avez utilisé un ordinateur partagé. Révoquer cet appareil vous déconnecte immédiatement.",
  },
  connections: {
    title: "Quelle différence avec les intégrations ?",
    text: "Un compte connecté donne à Liora un accès personnel au fournisseur configuré par votre administrateur. Déconnecter ce compte retire cet accès, sans supprimer les liens déjà partagés.",
  },
  integrations: {
    title: "À quoi servent mes raccourcis ?",
    text: "Ces liens sont visibles uniquement dans vos préférences. Ajoutez un nom reconnaissable et une URL HTTPS vers un outil que vous utilisez souvent.",
  },
};
export const adminHelp: Record<string, { title: string; text: string }> = {
  overview: {
    title: "Que puis-je vérifier ici ?",
    text: "Cette vue résume l’activité de l’espace. Le journal d’audit vous permet ensuite de retrouver les actions d’administration avec leur auteur et leur date.",
  },
  members: {
    title: "Comment gérer l’accès d’un membre ?",
    text: "Le rôle fixe ses permissions. Suspendre bloque l’accès à l’espace tout en conservant les données. Le propriétaire ne peut pas être suspendu. Les conversations personnelles entre amis sont indépendantes de cet espace.",
  },
  groups: {
    title: "Comment utiliser les groupes ?",
    text: "Réunissez des membres dans un groupe pour organiser l’équipe. Les permissions restent définies par les rôles ; ajouter un groupe n’accorde pas automatiquement de nouveaux droits.",
  },
  roles: {
    title: "Comment attribuer les bonnes permissions ?",
    text: "Créez un rôle avec les seuls droits nécessaires, puis attribuez-le aux membres. Les droits de lecture, de création et de gestion sont distincts. Vous ne pouvez déléguer que les permissions que vous possédez.",
  },
  channels: {
    title: "Comment organiser les conversations ?",
    text: "Une catégorie regroupe les salons. Un salon privé limite son accès aux personnes autorisées. Archiver ferme les nouveaux échanges sans effacer l’historique. Les conversations privées ne se reconfigurent pas comme un salon.",
  },
  categories: {
    title: "À quoi servent les catégories ?",
    text: "Les catégories organisent la liste des salons ; elles ne définissent pas de permissions. Utilisez des noms courts et une position pour régler leur ordre.",
  },
  connectors: {
    title: "Comment connecter un service ?",
    text: "Configurez le fournisseur et testez la connexion. Ajoutez ensuite des règles précisant les événements acceptés et leur destination. Les comptes personnels se connectent dans Préférences → Comptes connectés.",
  },
  accounts: {
    title: "Comment utiliser un bot ou un service ?",
    text: "Ces comptes accèdent à l’API avec des permissions limitées à l’espace. Copiez la clé à sa création, conservez-la chez l’émetteur et révoquez-la si elle est compromise.",
  },
  webhooks: {
    title: "Quand utiliser un webhook entrant ?",
    text: "Il permet à un outil externe de publier dans un salon. Son URL est un secret : ne la partagez pas dans une conversation. Autorisez les tâches seulement si l’émetteur doit en créer.",
  },
  outbound: {
    title: "Comment vérifier une livraison ?",
    text: "Les webhooks sortants transmettent les événements choisis à votre URL HTTPS. Consultez les tentatives et les erreurs avant de relancer. Le secret permet au destinataire de vérifier la signature.",
  },
  attachments: {
    title: "Comment libérer de la place ?",
    text: "Vérifiez à quel message ou tâche appartient un fichier avant de le supprimer. Une suppression peut casser le lien publié. Les fichiers DropIt restent gérés chez le fournisseur.",
  },
  emojis: {
    title: "Comment ajouter un emoji ?",
    text: "Importez d’abord une image dans le stockage, puis utilisez son identifiant. Le nom de l’emoji utilise des lettres minuscules et des tirets bas.",
  },
  audit: {
    title: "Comment lire ce journal ?",
    text: "Le journal conserve l’auteur, l’action et la ressource concernée. Il sert à comprendre un changement ; il ne permet pas d’annuler automatiquement une action.",
  },
  flags: {
    title: "Quand changer une fonctionnalité ?",
    text: "Les indicateurs contrôlent les options expérimentales de l’espace. Vérifiez leur effet avec l’équipe avant de les modifier. Ils n’accordent aucune permission supplémentaire.",
  },
  settings: {
    title: "Quels réglages concernent toute l’équipe ?",
    text: "Le nom et la description identifient cet espace pour tous ses membres. Votre thème, votre présence et vos notifications se règlent séparément dans vos Préférences.",
  },
};
