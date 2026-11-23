# Spécification — Répartition des zikr (v2, validée oralement le 21/11/2026)

## Vocabulaire
- **Gestionnaire** (ex-« cheikh ») : administre l'application. Il peut nommer d'autres gestionnaires, qui ont **tous les mêmes droits**.
- **Réserve** (nom validé, ex-« pot commun ») : stock de zikr non attribués à une personne, redistribuable.
- **Surplus** : ce qui ne tombe pas rond lors d'une division. Il revient **au gestionnaire** (il peut le faire ou non, puis le redonner).

## 1. Créer un zikr
Le gestionnaire définit : nom FR/AR, formule arabe (optionnelle), **total** (ex. 124 000), période (tout le séjour ou un jour), et qui participe.

### 1.1 Zikr journalier (sur tout le séjour)
`total ÷ nombre de jours` = quantité du jour ; `quantité du jour ÷ nombre de participants` = part de chacun.
Aperçu avant validation ; le gestionnaire peut corriger. Le surplus de division va au gestionnaire.

### 1.2 Zikr « séjour global »
Le total n'est pas découpé par jour : chaque participant reçoit sa part du total, à accomplir quand il veut pendant le séjour.
Le séjour n'est que la **somme** des objectifs journaliers : le gestionnaire peut en prendre une partie et la redistribuer sur des jours précis ou à des personnes précises (une partie ou la totalité).

### 1.3 Zikr d'un seul jour
Réparti entre tous les participants choisis, ou donné à une seule personne.

### 1.4 Participants
Au choix du gestionnaire : tous les membres, ou une sélection. Le gestionnaire peut participer ou non (libre).

## 2. Côté membre
- Voit ses objectifs par jour et par zikr.
- Saisit à tout moment, en plusieurs fois (100, puis 100 deux heures plus tard…) ; le reste se recalcule.
- Annule ses propres saisies (jamais de modification directe).

## 3. Redistribution (à tout moment, pas seulement en fin de journée)
Le gestionnaire voit sur son graphique qu'une journée risque de ne pas être atteinte. Il peut prendre le reste d'une personne (tout ou partie) et :
- le donner à **une personne précise** (ex. quelqu'un qui a déjà terminé) ;
- le **diviser entre plusieurs personnes** (même quantité ou quantités différentes) ;
- le mettre dans la **Réserve** pour le redistribuer plus tard.

## 4. Report automatique
Un reste non terminé en fin de journée (fuseau Africa/Casablanca) et non redistribué est **reporté automatiquement** sur l'objectif du lendemain de la même personne.
Ex. : 100 salatul fatiha non faits le jour J → +100 à son objectif du jour J+1.

## 5. Suivi gestionnaire
Temps réel par personne, par jour, par zikr et sur tout le séjour (objectif, fait, reste, %), graphiques exportables.

## Invariant
Par zikr : somme des objectifs effectifs des personnes + Réserve = total du zikr.

## Réserve : libre-service
Tout membre peut puiser dans la Réserve : il fait par exemple 1 000 et déclare « je verse dans la Réserve » ; la Réserve passe de 5 000 à 4 000.
Ces saisies sont étiquetées « Réserve » et ne comptent pas dans son objectif personnel. On ne peut pas puiser plus que ce qui reste (contrôle côté serveur).

## Mise en œuvre (v2)
- SQL : `supabase/migrations/20261121000000_repartition.sql` (`distribute_zikr`, report automatique `carry_over_day` + tâche pg_cron à 00h05 Fès, `set_member_role`, garde Réserve dans `sync_member_batch`, attribution vers un jour précis dans `redistribute_remaining`).
- Écrans : Zikr → « Répartir un total » avec aperçu ; Membres → « Nommer gestionnaire » ; Redistribution → jour de destination.
- Reste à faire : bouton d'annulation d'une redistribution dans l'interface ; notification de report visible dans la page Alertes.
