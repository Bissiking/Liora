# Sécurité

## Préversion 1.0

Les capacités de canal héritent du rôle puis des exceptions de rôle/utilisateur ; garde de membership, compte actif, salon privé/DM et permission effective à chaque accès. Owner ne reçoit pas d’override. Les gestionnaires ne peuvent accorder un droit qu’ils ne possèdent pas. Les nouvelles files personnelles sont liées au propriétaire et réévaluées avant livraison, avec payload push/Gotify générique sans contenu privé. Rich content webhook validé et médias via réseau contrôlé ; secrets absents des historiques de réception.

Les tables Google historiques sont conservées sans code de lecture/synchronisation runtime. Les Pages restent une API autorisée historique. Pour un rollback, restaurer une base cohérente : un ancien code ne sait pas appliquer les nouveaux overrides. La qualification locale et la revue UI ne remplacent pas un audit sécurité/charge externe avant stable.

## Kyros v4

Configurer une application Kyros **SSO v4**, code d’autorisation + PKCE S256 et PAR. Callback exact : `${APP_URL}/auth/callback`. Scopes par défaut `profile email offline_access`. Si des scopes supplémentaires sont configurés, ils sont tous exigés dans le JWT. `KYROS_AUDIENCE` désigne l’audience JWT globale ; `KYROS_RESOURCE_AUDIENCE` doit être identique à celle de l’application Kyros.

Les signatures RS256/JWKS, iss, aud, sub, exp, client_id, resource_aud, sso_version et scopes sont vérifiés. Les tentatives d’authentification ont un état lié au navigateur, expirent à dix minutes et ne sont consommables qu’une fois. Aucun mot de passe ni bypass local.

La session navigateur est un jeton aléatoire opaque, dont seul le hash est stocké. Tokens Kyros chiffrés en JWE AES-256-GCM dans PostgreSQL. `SESSION_SECRET` >=32 caractères, généré cryptographiquement, sauvegardé hors dépôt. Cookies HttpOnly, SameSite=Lax, Secure en production. Un verrou `FOR UPDATE` sérialise le refresh entre processus. Erreur réseau : session conservée, accès temporairement 503 après expiration du jeton ; refus permanent : suppression de session.

## Autorisations

Permissions strictement locales. Un administrateur Kyros ne reçoit aucun rôle automatiquement. Le sujet BOOTSTRAP_OWNER_KYROS_ID peut réclamer un espace seed sans membre. Un membre connecté peut créer son propre espace. Les rôles Owner ne sont ni éditables ni rétrogradables par l’interface ALPHA. Les attributions de rôles ne peuvent accorder des permissions que l’acteur n’a pas.

## Protection HTTP

Validation Origin sur toutes les mutations utilisant les cookies. Les tokens Bearer et webhooks sont des secrets explicites, sans cookies. Helmet/CSP en production, aucun HTML utilisateur injecté, URLs affichées limitées à HTTP(S), liens externes noopener. JSON limité à 1,5 Mo, fichiers 1 Mo. Limites par IP : API lectures 1200/minute et mutations 300/minute, auth 30/minute, webhooks 60/minute. Proxy : aucun `trust proxy` par défaut ; ne l’ajouter que pour un proxy explicitement maîtrisé.

## Sorties réseau

Webhooks sortants : HTTPS public IPv4 sur 443 uniquement, pas d’identifiants URL, pas de redirection. Résolution contrôlée puis adresse épinglée lors de la connexion ; TLS vérifie le nom d’hôte. IPv6 différé. Monitoring : URL uniquement en configuration opérateur, accepte le réseau privé pour surveiller Argus. Timeout de cinq secondes.

## Révocation et rotation

Bot : renouveler le jeton ou révoquer dans Administration. Entrant : révoquer et recréer le webhook. Sortant : désactiver puis recréer ; annuler les livraisons en attente si nécessaire. Session : révoquer depuis Préférences. Changer SESSION_SECRET invalide les jetons chiffrés existants : révoquer les sessions et recréer les secrets sortants lors d’une maintenance. Aucun secret dans les journaux d’accès, URLs de webhook ou en-têtes ne sont journalisés.

## Frontière de validation

Tests locaux avec fournisseur Kyros isolé, aucune validation du compte réel impliquée. Audit de sécurité indépendant, limitations distribuées, rotation à plusieurs clés et restauration régulière exigés avant 1.0. Les données du seed ne représentent pas l’état réel de l’infrastructure.

## Confidentialité 0.2.0

La supervision et les salons de type monitoring exigent VIEW_MONITORING, y compris pour les lectures directes et la recherche. Le preset Moderator n’accorde plus ce droit. Les changements d’attribution déclenchent la relecture des permissions côté client, mais l’autorité reste le serveur à chaque requête.

Les conversations directes sont accessibles aux seuls participants, même pour un administrateur. Les salons privés autorisent leurs membres invités et les gestionnaires de salons. Les endpoints messages, réactions, suivis et fichiers liés vérifient cette visibilité. Le fichier général ou historique sans channel_id reste partagé dans le workspace. Les webhooks entrants restent explicitement limités au salon choisi par leur créateur autorisé ; aucune destination DM.

## Contrôles 0.2.1

Les liens d’invitation ne sont stockés qu’avec leur hash ; usage unique, expiration à sept jours, révocation et contrôle de l’émetteur lors de l’acceptation. Rejoindre un workspace exige un rôle Member et les droits d’administration toujours valides. Les préférences DMs sont vérifiées à chaque envoi. Les groupes s’appliquent aux salons privés sans contourner DMs ou supervision.

Le récupérateur HTTPS résout et épingle une adresse IPv4 publique, bloque les réseaux privés/réservés, refuse les redirections et applique un délai total de cinq secondes. Aucun cookie ou en-tête d’authentification utilisateur n’est transmis. HTML limité à 512 Ko, images à 3 Mo, signatures validées ; le HTML récupéré n’est jamais injecté. Les liens HTTP restent des liens ordinaires.

Les pièces jointes d’une tâche exigent les permissions de board ; l’upload exige MANAGE_TASK. Les fichiers de salon restent soumis à son ACL. Les suppressions vérifient l’espace du parent avant de supprimer les descendants. Les blocs embarqués vérifient les droits du lecteur, même si leur auteur dispose de davantage de permissions. Les profils, amis, invitations et intégrations personnelles exigent une session humaine.

## Intégrations 0.3.0

Administration humaine sous MANAGE_WORKSPACE + MANAGE_WEBHOOK, réseau privé sous MANAGE_SECURITY. Appels de modules limités, sans redirection, résolution IPv4 épinglée ; aucun jeton personnel transmis vers une nouvelle URL après modification. DropIt : clé applicative + autorisation personnelle, PKCE/state, vérification émetteur/sub, propriétaire contrôlé côté module. Signatures entrantes sur le corps brut et fenêtre de 5 minutes pour le mode Liora. Les liens DropIt sont publics pour leurs détenteurs : confirmation avant insertion, portée de tout le partage affichée. Voir INTEGRATIONS.md pour révocation distante et limites.
