# Reste à faire / à prévoir

Mis à jour le 21/11/2026.

## Avant le départ (Fès, 19–27 décembre 2026)
- [ ] Tester le déploiement de la branche `feat/repartition` sur téléphone, puis fusionner dans `main`.
- [ ] Remplacer le mot de passe provisoire pré-rempli (`Ziyara2026`) dans l'écran de création de membre.
- [ ] Vérifier les horaires de prière de Fès (18–28 décembre) avec une source officielle (Habous).
- [ ] Fournir le contenu de la biographie de Seydina Cheikh (chapitres FR/AR).
- [ ] Brancher le bouton « annuler une redistribution » dans l'interface (la fonction SQL `cancel_redistribution` existe).
- [ ] Afficher les notifications de report (`carried_over`) dans la page Alertes.
- [ ] Vérifier que le tableau de bord gestionnaire calcule les objectifs « séjour global » comme la base (`goal_done`).
- [ ] Icônes PWA définitives, adresse de production stable, test hors-ligne sur téléphone installé.
- [ ] Répétition avec 2–3 personnes sur plusieurs jours ; chaque membre ouvre l'appli une fois en ligne avant le départ.
- [ ] Garder la base Supabase active la semaine précédant le départ (pause automatique du plan gratuit après 7 jours).

## À prévoir : plusieurs voyages (demandé le 21/11/2026)
Le gestionnaire doit pouvoir **créer et gérer d'autres voyages** : choisir un nom, un lieu et une période.
Exemples : Fès du 19 au 27 décembre 2026 ; La Mecque du 5 au 15 février ; un voyage en Algérie, etc.

Ce que cela implique (rien n'est développé aujourd'hui, l'application est pensée pour un seul voyage) :
- **Données :** la table `ziyaras` existe déjà et toutes les autres tables sont rattachées à un voyage ; il faudra un écran « Voyages » (créer, modifier, archiver) et ajouter un champ lieu / pays / fuseau horaire.
- **Choix du voyage actif :** les écrans chargent aujourd'hui « le premier voyage actif » ; il faudra un sélecteur de voyage (gestionnaire et membres) et gérer un membre inscrit à plusieurs voyages.
- **Membres par voyage :** un même numéro de téléphone peut participer à plusieurs voyages (le compte de connexion reste unique, la participation est par voyage) ; le gestionnaire choisit qui inscrire à quel voyage.
- **Gestionnaires :** décidé le 21/11 : un gestionnaire l'est pour **tous les voyages** ; on peut en nommer ou en retirer à tout moment (déjà possible dans « Membres »).
- **Dates et libellés en dur à rendre dynamiques :** sous-titre « 19 – 27 Décembre 2026 », bornes de dates des écrans, appli hors-ligne qui ne garde qu'un profil.
- **Horaires de prière et fuseau :** table et fuseau actuellement propres à Fès (`Africa/Casablanca`) ; il faudra des horaires par lieu (calcul par coordonnées GPS, avec méthode adaptée au pays) et un fuseau par voyage.
- **Report quotidien :** déjà calculé par voyage et selon son fuseau (`carry_over_all`), à garder tel quel.
- **Historique :** pouvoir consulter un voyage terminé sans le mélanger au voyage en cours.

Décisions prises le 21/11/2026 :
- Un gestionnaire est le même pour tous les voyages (modifiable en nommant / retirant des gestionnaires).
- Un membre peut revoir ses anciens voyages.

Reste à trancher : les zikr (modèles) peuvent-ils être copiés d'un voyage à l'autre ?

**Prochaine étape : réfléchir à l'implémentation le 22/11/2026.**
