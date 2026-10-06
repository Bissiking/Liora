# Revue visuelle 1.0.0-beta.1 — 6 octobre 2026

Compétence utilisée : Impeccable, direction Operate décrite dans `.impeccable/directions/liora-100.md`. Revue indépendante sans historique du builder, source et captures Chrome. Premier retour : recapturer le haut de la configuration webhook ; la vue basse est ensuite fournie séparément. L’évidence invalide n’a pas lié le premier retour.

## Findings et verdict

| Finding                                                    | Correction                                                                                                                                    | Verdict |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Texte des messages Paper presque invisible, environ 1,28:1 | Couleur `var(--text)` ; copie normale/emphase lisible, environ 11,64:1 sur Paper                                                              | Résolu  |
| Header de canal mobile trop encombré                       | Identité sur sa rangée, description courte avec texte complet en contexte, actions sur une rangée distincte et cibles 44px ; 390/320 vérifiés | Résolu  |
| Toolbar mobile et nouveau menu en doublon                  | Toolbar héritée masquée sur téléphone, une entrée ellipsis ; copie ID et réaction présentes dans le menu                                      | Résolu  |
| Reply/réactions encore cliquables en lecture seule         | Capacité effective d’envoi sur les deux présentations, compteurs de réactions non interactifs sans ADD_REACTION                               | Résolu  |

Disposition finale : **ship**, les quatre corrections sont résolues. Le verdict final score ces findings ; il n’ouvre pas un nouvel audit global. Le parcours E2E vérifie les affordances absentes sur un compte de lecture, les réactions conservées et l’absence de composeur.

## Portée

Le reviewer a inspecté douze captures requises, une vue d’historique supplémentaire et, après correction, le canal à 320px et le compte de lecture desktop. Hiérarchie personnel/workspaces, profils, paramètres, menus, webhooks et CalDAV sont cohérents à cette portée. Détecteur unique sans findings.

Le reviewer n’a pas relancé lui-même les tests et n’a pas navigué dans l’application ; les exécutions du builder sont consignées dans [VALIDATION.md](VALIDATION.md). La disposition ne prouve ni production, ni fournisseurs réels, ni clients calendrier, ni appareils physiques. La préversion reste beta en attente de ces qualifications.

## Correction messages privés, amis et paramètres — retour utilisateur du 6 octobre

Le retour utilisateur sur les messages privés/amis, les mentions brutes dans Fils actifs et le dialogue Paramètres du canal a déclenché une nouvelle revue ciblée. Aucun nouveau monde graphique : Manrope, palettes et shell communs sont conservés. Les conversations occupent la largeur disponible, les avatars de liste ont une taille fixe, le composeur reste dans le viewport et les paramètres sont regroupés par usage.

La nouvelle revue indépendante a ouvert **16 captures** `social-*.png` et Options (`v1-channel-settings-desktop.png`) : messages desktop/mobile/index, amis desktop/mobile, invitation, Graphite/Papier, Général desktop/390/320, Permissions, Options mobile, Accès privés et fil avec mention résolue. Messages, amis, aperçus de fils et onglets principaux correspondaient au cadre ; un finding matériel restait : Enregistrer les accès pouvait défiler avec la liste.

| Finding                                        | Correction                                                                                                                                                    | Verdict |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Enregistrer les accès dans le contenu défilant | Formulaire flexible, membres/groupes défilants et pied d’action séparé dans ChannelSettings ; mode autonome conservé. Recaptures desktop/390 avec 21 membres. | Résolu  |

Disposition finale : **ship**, sur le finding ciblé évalué. Les nouvelles captures `social-channel-access-desktop.png` et `social-channel-access-mobile.png` montrent les actions visibles avec une liste défilante. Le parcours E2E vérifie aussi qu’un seul dialogue est ouvert et que le suivi personnel conserve les options non enregistrées.

Le détecteur a été exécuté une fois sur les surfaces modifiées : **0 finding principal**, **20 avis** sur les tailles typographiques/rayons par rapport au registre DESIGN.md. Aucun second détecteur après correction. Le documenter enregistre le système effectivement construit. Les 76 tests, le build et Chrome headless/Puppeteer restent des preuves locales sur données synthétiques, sans qualification de production, de fournisseur réel ou d’appareil physique.
