# Liora 0.7.1 — intégration BrainDump

> Guide historique 0.x. Pour la branche 1.0, Google OAuth/runtime est retiré et les accès CalDAV suivent [CALDAV.md](CALDAV.md). Les migrations déjà appliquées et les données historiques sont conservées.

BrainDump devient un fournisseur configurable dans **Administration → Intégrations**, aux côtés de DropIt. Les autres fournisseurs restent masqués dans les paramètres ; leurs API existantes ne sont pas supprimées. Les notes restent personnelles : la configuration d'un espace ne donne accès à aucun contenu d'un membre.

## Configurer les deux applications

1. Installer **BrainDump 2.1.0** et Liora 0.7.1. Les deux applications doivent vérifier le même émetteur Kyros V4.
2. Dans BrainDump, ouvrir **Applications connectées** depuis le menu du compte, ou **Plus** sur mobile. Créer Liora avec l'URL exacte `https://liora.exemple.fr/api/v1/integration-callback`. Copier l'identifiant et la clé, affichée une seule fois.
3. Dans Liora → Administration → Intégrations → Ajouter un module, choisir BrainDump et renseigner URL, identifiant et clé. Enregistrer puis **Tester la connexion**. HTTPS est requis ; le mode réseau privé exige MANAGE_SECURITY et HTTP reste limité à la boucle locale.
4. Chaque personne ouvre **Notes datées**, choisit l'intégration puis **Connecter mon compte BrainDump**. Elle confirme, dans BrainDump avec le même compte Kyros, la lecture de ses notes datées. Le parcours est aussi disponible dans **Comptes connectés**.
5. De retour dans Liora, activer **Lier mes notes BrainDump**, puis Actualiser. Le titre, contenu Markdown et rendez-vous sont récupérés. Modifier le contenu se fait dans BrainDump. Les autres types et les notes sans date ne sont pas importés.

BrainDump ne demande pas d'ajouter les scopes Liora à son client Kyros : son SSO V4 authentifie le consentement, puis des accès propres à l'application assurent la délégation. Liora ne transmet pas son jeton Kyros à ce nouveau connecteur.

## Accès et révocation

La clé authentifie l'application et ne suffit jamais à lire des notes. Consentement par compte, code cinq minutes à usage unique, PKCE S256, URL exacte et état lié à la session Liora. Liora vérifie émetteur Kyros, sujet et scope `notes:dated:read` à l'échange et au renouvellement. Jetons chiffrés côté Liora ; empreintes SHA-256 seulement côté BrainDump. Accès quinze minutes, refresh trente jours glissants avec rotation. Réponses personnelles et consentement ne sont pas mis en cache.

Dans BrainDump, **Accès à mes notes** retire une autorisation. **Mes applications** permet de changer une clé ou révoquer une application ; cela retire ses accès existants. Au prochain passage, Liora détecte le refus 401/403, désactive le lien et retire uniquement ses copies BrainDump. Déconnecter dans Liora retire les accès locaux et tente la révocation distante. Changer les credentials ou désactiver le module retire les délégations locales et les copies correspondantes. Les notes originales BrainDump et les notes créées dans Liora sont conservées.

Une panne réseau conserve les dernières copies et affiche l'erreur. La récupération passe à la demande et chaque minute pendant que Notes datées est ouverte. La source choisie est unique par compte, même avec plusieurs espaces. Les droits d'espace, la configuration et l'autorisation personnelle sont réévalués avant de conserver une réponse. Une source hors de l'espace accessible n'est pas proposée. Au-delà de **500 notes datées actives**, BrainDump refuse le snapshot ; aucune suppression basée sur un résultat tronqué.

La configuration historique `BRAINDUMP_BASE_URL` de la 0.7.0 reste une compatibilité pour les installations existantes ; le nouveau parcours utilise les intégrations en base. Il n'exige ni cette variable ni le relais Kyros LUMA de BrainDump. Les notes ne deviennent pas des événements d'équipe ou Google.

## Mise à jour et qualification

Liora : appliquer **011_braindump_integration.sql** après la 010. BrainDump : la migration SQLite additive 3 crée applications, codes et autorisations au démarrage. Sauvegarder la base BrainDump avant le premier démarrage de la nouvelle version. Aucun ancien dump ou propriétaire n'est réattribué.

Contrat côté BrainDump : [guide 2.1.0](../../BrainDump/DOCS/LIORA_2.1.0.md). Preuves et limites : [VALIDATION.md](VALIDATION.md). Les tests utilisent les vrais routeurs BrainDump et une SQLite isolée, avec identité Kyros et notes synthétiques ; ils ne qualifient pas un consentement Kyros réel, un déploiement ou les bases principales.
