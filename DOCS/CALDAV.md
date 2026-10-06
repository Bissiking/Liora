# Calendrier externe — CalDAV dans Liora 1.0

Depuis 1.0.0-beta.1, **CalDAV est le parcours officiel**. Le connecteur Google Calendar OAuth et son worker sont retirés. Les tables historiques Google sont conservées ; elles ne provoquent aucune synchronisation. Aucun compte fournisseur réel n’a été modifié pendant le développement.

Dans Préférences → Synchronisation Agenda, copier le serveur et l’identifiant. Nommer chaque appareil puis « Créer un accès ». Copier le mot de passe affiché une seule fois et le masquer après conservation. Un mot de passe perdu nécessite révocation et nouvel accès ; dix accès maximum par compte. La révocation d’un appareil n’affecte pas les autres.

Configurer un compte CalDAV réseau dans votre application avec ces trois valeurs. Les guides présents dans l’interface accompagnent iOS/iPadOS, macOS, Thunderbird et Android avec un client DAV. Les chemins peuvent varier selon la version : consulter [Apple](https://support.apple.com/fr-fr/guide/iphone/ipha0d932e96/ios), [Thunderbird](https://support.mozilla.org/fr/kb/creer-nouveaux-agendas) et [DAVx⁵](https://manual.davx5.com/accounts_collections.html). Android requiert un adaptateur CalDAV compatible et une application affichant les comptes calendrier de l’appareil ; cette configuration n’ajoute pas une synchronisation Google Web au produit.

Liora publie les événements autorisés dans les deux sens selon les droits courants. Les notes datées personnelles, y compris les copies BrainDump, restent en lecture seule. Une révocation d’accès aux canaux doit également faire disparaître les événements concernés. Un conflit de version est refusé par ETag/412 ; recharger avant de modifier à nouveau.

## Exploitation

`APP_URL` doit être l’origine HTTPS exacte. Conserver les en-têtes Authorization, les méthodes WebDAV et le chemin `/dav/` au reverse proxy ; `/.well-known/caldav` assure la découverte. HTTP n’est accepté que pour localhost pendant les tests. Aucun secret applicatif Kyros ou Google n’est demandé au client calendrier.

Le mot de passe CalDAV est haché en base ; il est distinct de la session web. La liste affiche la dernière utilisation ; supprimer l’accès en cas de perte d’appareil. Ne jamais copier le mot de passe dans un ticket ou un journal partagé.

## Qualification restant à faire

Les tests locaux valident découverte PROPFIND/REPORT, iCalendar, création/lecture/modification/suppression autorisées, ETags/412, révocation, récurrences/fuseaux et notes en lecture seule. Cela ne prouve pas la compatibilité avec les applications réelles. Pour chaque client : découverte, création dans Liora et côté client, édition concurrente, journées entières/récurrences/changement d’heure, suppression, révocation et perte de droits. Reporter versions/appareils et résultats dans VALIDATION.md avant 1.0.0 stable.
