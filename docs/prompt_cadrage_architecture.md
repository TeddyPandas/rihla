# RÔLE
Tu es un architecte logiciel senior et concepteur d'applications web. Tu combines : architecture technique, modélisation de données, UX/UI, sécurité, applications hors-ligne et DevOps. Tu travailles comme un consultant exigeant : tu justifies tes choix, tu signales les risques, tu n'inventes pas de besoins que je n'ai pas exprimés.

# MON PROJET : application de suivi de zikr pour une ziyara à Fès
Contexte : un groupe d'environ 20 personnes voyage à Fès avec un cheikh pour une ziyara, **du 19 au 27 décembre 2026** (9 jours). Pendant le séjour, chaque membre doit accomplir des quantités de zikr fixées par le cheikh. L'application sert à distribuer ces objectifs, collecter les comptages, donner au cheikh une vue en temps réel et offrir un espace de lecture dédié à la biographie de Seydina Cheikh (Cheikh Ahmad Tidjani).
Échéance : application livrée, testée et opérationnelle **pour la fin novembre 2026**, soit avant le départ. Délai court : priorise la simplicité, la robustesse et une exécution rapide.

## Deux rôles
**Cheikh (administrateur)**
- Configure les zikr : nom en français et en arabe (ex. Istighfar / أستغفر الله, Haylala / لا إله إلا الله), formule arabe complète optionnelle, quantité cible, créneau indicatif, portée (`daily` par jour ou `stay` globalement sur tout le séjour).
- Crée les membres (numéro de téléphone + mot de passe par défaut) et peut ajouter ou modifier des objectifs pour un membre précis ou pour tout le groupe (sur une date ou sur les 9 jours).
- **Tableau de bord en temps réel** (mise à jour automatique dès qu'un membre synchronise une saisie via Supabase Realtime + polling de secours 30s), avec pour chaque vue : objectif, fait, reste à faire, pourcentage et statut (terminé / en cours / en retard) :
  - **Par zikr** : progression de chaque zikr pour le groupe, avec le détail par membre.
  - **Par personne** : tout ce que fait un membre donné, zikr par zikr.
  - **Par jour** : une journée précise (ex. le 21 décembre), globale ou filtrée par membre ou par zikr.
  - **Sur la totalité du séjour** : cumul des 9 jours, globale ou filtrée par membre ou par zikr.
  - **Vue d'ensemble** : total groupe, nombre de membres ayant terminé ou non, liste des retardataires par zikr (point de départ de la redistribution), état du pot commun.
  - Filtres combinables (`jour × zikr × membre`) et affichage de l'heure de dernière synchronisation (`last_synced_at`) de chaque membre.
- Gestion des retards et redistribution : liste des membres n'ayant pas terminé, par zikr. Sur un zikr en retard, le cheikh peut redistribuer **tout le reste ou une partie du reste** (il saisit la quantité exacte), selon deux modes qu'il peut combiner en une seule action atomique :
  1. **Réattribution ciblée** : une quantité choisie est donnée à un ou plusieurs membres et s'ajoute à l'objectif de chacun. Le cheikh sélectionne les membres concernés puis choisit :
     - soit **la même quantité pour tous** (ex. 200 chacun) ;
     - soit **une quantité différente par membre** (ex. 100 à l'un, 200 à un autre, 300 à un troisième).
     L'écran affiche en direct le total attribué et le reste non attribué, et refuse une attribution qui dépasse la quantité disponible. Chaque membre concerné reçoit sa notification.
  2. **Pot commun volontaire (bonus)** : une quantité choisie est mise dans un pot visible et accessible par tous les membres, qui peuvent s'en servir.
- Évolution dans le temps (jour par jour) sous forme de graphiques, exportables (image PNG, CSV ; PDF décalé en V2).
- Peut corriger ou annuler n'importe quelle saisie d'un membre, avec traçabilité complète (auteur, horodatage, motif, lien vers saisie de remplacement).

**Membre**
- Connexion : le **numéro de téléphone est son identifiant (login)**, avec un mot de passe par défaut fourni par le cheikh. À la première connexion (en ligne) : changement obligatoire du mot de passe et saisie du nom complet, obligatoire pour valider le compte. Le login reste toujours le numéro de téléphone.
- Voit son programme : ce qu'il doit faire par jour, organisé visuellement par créneaux (*Matin, Après Fajr, Après Dhuhr, Après Asr, Après Maghrib, Après Isha, Nuit, Libre*).
- Saisit à tout moment les quantités accomplies par zikr (pas d'obligation de pointer créneau par créneau ; les créneaux servent uniquement à structurer le programme et déclencher les rappels). Les saisies s'additionnent dans la journée et l'app recalcule le reste à faire.
- Peut annuler ses propres saisies (jamais les modifier directement). Les saisies annulées restent dans l'historique, marquées comme annulées (`cancelled`), et ne comptent plus dans les totaux. Pour corriger, il annule puis ressaisit.
- Peut prendre en charge volontairement une part du pot commun (`source = 'pot'`).
- **Reçoit une notification** quand le cheikh lui attribue une quantité (réattribution ciblée) ou ajoute un objectif, avec le zikr et la quantité. Une notification générale signale l'ouverture d'un pot.
- Voit sa propre progression et le **total du groupe détaillé par zikr** (jamais de classement ni de comparaison individuelle avec les autres membres).

## Règle comptable du pot commun (Validée)
- Quand le cheikh redistribue une quantité (tout le reste ou une partie, au choix), elle est **retirée du reste à faire du membre en retard** (`adjusted_delta`). Ce qu'il ne redistribue pas reste au membre en retard.
- Une quantité donnée à un membre précis s'ajoute à **son** objectif personnel. Une quantité mise dans le pot devient un **objectif collectif séparé** (par zikr, avec un reste à faire).
- Un membre qui prend en charge une part du pot saisit ses comptages dans une saisie **étiquetée « pot »**. Elle est attribuée à celui qui l'a effectuée, réduit le reste du pot, et **ne compte pas dans son propre objectif personnel**.
- Chaque redistribution est tracée (qui, quand, quelle quantité, de qui vers qui) et peut être annulée par le cheikh.
- **Invariant permanent par zikr :**
  $$\sum \text{Objectifs personnels effectifs} + \text{Pot commun alloué} = \sum \text{Objectifs initiaux du groupe}$$

## Module Contenu : Biographie de Seydina Cheikh
- Espace de lecture dédié, accessible 100 % hors-ligne, structuré par chapitres, bilingue français / arabe (RTL), avec réglage de la taille de police et typographie optimisée pour la lecture longue sur mobile.
- Alimenté par un fichier JSON structuré (`src/content/biography-sample.json`) fourni ultérieurement par le porteur de projet (aucun contenu religieux ou historique inventé par l'IA ; chapitres de démonstration clairement balisés `[EXEMPLE]`).

## Décisions techniques arrêtées
- **Stack :** Next.js (App Router, TypeScript) hébergé sur **Vercel** + **Supabase** (PostgreSQL, Auth, Realtime, RPC `SECURITY DEFINER`) + **Dexie.js** (IndexedDB) + **Serwist** (PWA Service Worker).
- **Hors-ligne indispensable (Outbox Pattern) :** Saisie et annulation sans réseau dans IndexedDB avec `client_mutation_id` (UUIDv4 généré côté client), mise à jour optimiste immédiate, puis dépilement automatique vers la RPC idempotente `sync_member_batch` (`ON CONFLICT (client_mutation_id) DO NOTHING`) dès le retour du réseau.
- **Authentification sans SMS/OTP :** Normalisation E.164 (`libphonenumber-js`) convertie côté serveur en identifiant déterministe `digits@ziyara.local`. Création des comptes via Route Handler serveur (`/api/admin/members`) protégé par rôle `cheikh` et `SUPABASE_SERVICE_ROLE_KEY`.
- **Horaires de prière de Fès :** Table JSON statique précalculée des horaires officiels de Fès du 18 au 28 décembre 2026, forcée sur le fuseau `Africa/Casablanca` (indépendamment de `Africa/Dakar` ou de l'horloge système du téléphone), avec fallback astronomique `adhan` (`34.0181° N, 5.0078° W`, paramètres Maroc Fajr 19° / Isha 17°).
- **Rappels & Notifications :** Centre de notifications in-app persistant (`user_notifications`) + générateur de calendrier `.ics` sur les 9 jours à Fès (garantissant des alarmes sonores 100 % hors-ligne sur iPhone/iOS Safari et Android) + Web Push optionnel.

## Contraintes & Design
- **Langues :** Français et Arabe avec bascule instantanée et support complet RTL (`dir="rtl"`).
- **Design validé :** Direction 1 **« Zellige de Fès & Parchemin Solaire »** en thème Jour par défaut (`#FAF7F0` / `#0E4D3E` / `#B8862D`), et Direction 2 **« Nocturne de la Zaouïa & Cèdre »** en mode Nuit activable (`#0F1715` / `#D4A853` / `#2E8B6E`).
- **Sécurité :** Row Level Security (RLS) stricte sur toutes les tables ; exposition des totaux collectifs par zikr aux membres uniquement via la fonction agrégée `get_group_zikr_summary`.
```

```markdown:Spécifications du Système de Design UI/UX:design_system_ziyara_fes.md
# Système de Design & Charte UI/UX — Application Ziyara Fès 2026

Ce document définit l'identité visuelle, les jetons de design (*design tokens*), la typographie bilingue (Français / Arabe RTL) et les règles ergonomiques de l'application **Ziyara Fès**.

---

## 1. Philosophie Visuelle & Ancrage Culturel
L'interface est conçue pour un usage spirituel quotidien, souvent dans la pénombre d'une zaouïa ou aux heures de prière (Fajr, Maghrib, Isha), par des pèlerins de tous âges :
- **Sobriété & Recueillement :** Zéro blanc pur `#FFFFFF` éblouissant, zéro dégradé synthétique générique.
- **Double ambiance Jour / Nuit :**
  - **Thème Jour (par défaut) — « Zellige de Fès & Parchemin Solaire » :** Inspiré du plâtre sculpté (*gebs*) baigné de lumière naturelle, de l'émail vert émeraude profond des zelliges de Fès et du laiton patiné.
  - **Mode Nuit (activable en un clic) — « Nocturne de la Zaouïa & Cèdre » :** Inspiré des boiseries de cèdre sombre de l'Atlas et de la lueur douce d'une lanterne en cuivre sur écran OLED.
- **Ergonomie mobile-first :** Zones tactiles d'une hauteur minimale de `48px` (`56px` pour les boutons de comptage rapide), hiérarchie claire des grands nombres et alignement tabulaire fixe.

---

## 2. Jetons de Couleurs (CSS Custom Properties)

### 2.1 Thème Jour : `Zellige de Fès & Parchemin Solaire` (`[data-theme="light"]`)

| Rôle sémantique | Variable CSS | Code Hex / RGBA | Usage |
|---|---|---|---|
| **Fond principal (Toile)** | `--bg-canvas` | `#FAF7F0` | Arrière-plan général (Ivoire Parchemin chaud) |
| **Surface secondaire** | `--bg-surface` | `#F2ECE0` | Encarts horaires, barres de progression, champs inactifs |
| **Carte élevée** | `--bg-elevated` | `#FFFDF8` | Cartes de zikr, modales, en-tête collant |
| **Bordure fine** | `--border-subtle` | `#E2D9C8` | Séparateurs de listes et contours de cartes |
| **Bordure accentuée** | `--border-strong` | `#C9BBA2` | Encadrements actifs et motif zellige en filigrane |
| **Texte principal** | `--text-primary` | `#1A1D1B` | Titres, compteurs, corps de lecture (contraste > 12:1) |
| **Texte secondaire** | `--text-secondary` | `#5A625E` | Libellés, sous-titres, horodatages |
| **Texte sur accent** | `--text-on-accent` | `#FAF7F0` | Texte des boutons primaires pleins |
| **Accent primaire** | `--accent-primary` | `#0E4D3E` | Vert Zellige Fassi (CTA principaux, barres d'avancement) |
| **Accent primaire survol** | `--accent-primary-hover` | `#0A3A2F` | État actif / pression tactile |
| **Accent primaire doux** | `--accent-primary-soft` | `rgba(14, 77, 62, 0.10)` | Badges « Synchronisé », fonds d'icônes |
| **Accent secondaire (Or)** | `--accent-gold` | `#B8862D` | Laiton patiné (objectifs atteints à 100 %, reste à faire) |
| **Accent secondaire doux** | `--accent-gold-soft` | `rgba(184, 134, 45, 0.14)` | Badges « Terminé », bouton « Tout le reste » |
| **Statut Retard / Annulation** | `--status-late` | `#A63A2B` | Terre cuite de Fès (alertes retards, bouton annuler) |
| **Statut Hors-ligne** | `--status-offline` | `#8C6239` | Ambre discret (indicateur mode hors-ligne) |
| **Statut Pot commun** | `--status-pot` | `#1D6366` | Turquoise zellige (actions et compteurs du pot commun) |

### 2.2 Mode Nuit : `Nocturne de la Zaouïa & Cèdre` (`[data-theme="dark"]`)

| Rôle sémantique | Variable CSS | Code Hex / RGBA | Usage |
|---|---|---|---|
| **Fond principal (Toile)** | `--bg-canvas` | `#0F1715` | Nuit d'Émeraude OLED profonde |
| **Surface secondaire** | `--bg-surface` | `#172320` | Encarts et zones secondaires |
| **Carte élevée** | `--bg-elevated` | `#1E2D29` | Cartes et fenêtres modales |
| **Bordure fine** | `--border-subtle` | `#253632` | Séparateurs discrets |
| **Texte principal** | `--text-primary` | `#F3EFE6` | Blanc cassé chaud (sans halo agressif) |
| **Texte secondaire** | `--text-secondary` | `#9AA8A3` | Métadonnées et libellés |
| **Texte sur accent** | `--text-on-accent` | `#0F1715` | Contraste fort sur boutons dorés |
| **Accent primaire** | `--accent-primary` | `#D4A853` | Or Safran doux (haute lisibilité nocturne) |
| **Accent secondaire** | `--accent-gold` | `#2E8B6E` | Jade apaisé (validation et complétion) |
| **Statut Retard** | `--status-late` | `#D96B52` | Corail doux |
| **Statut Pot commun** | `--status-pot` | `#4DA6A9` | Turquoise lumineux apaisé |

---

## 3. Typographie & Gestion Bilingue (FR / AR RTL)

Les polices sont chargées localement via `next/font/google` et mises en cache par le Service Worker PWA pour un rendu 100 % hors-ligne.

| Usage | Police Latine (FR) | Police Arabe (AR) | Règles CSS |
|---|---|---|---|
| **Titres, En-têtes & Formules de Zikr** | `Fraunces` (Serif éditorial) | `Amiri` (Calligraphie Naskh) | `.font-display` et `.font-arabic-script` (`line-height: 1.6` en arabe pour préserver les voyelles/tashkeel) |
| **Interface, Boutons & Lecture courante** | `Plus Jakarta Sans` | `IBM Plex Sans Arabic` | Bascule automatique selon `[dir="ltr"]` ou `[dir="rtl"]` |
| **Compteurs & Horaires de prière** | `Plus Jakarta Sans` | `IBM Plex Sans Arabic` | Classe `.tabular-nums` (`font-variant-numeric: tabular-nums`) obligatoire pour éviter tout décalage horizontal lors de l'incrémentation |

### Règles de directionnalité RTL
- La bascule `FR / عربي` modifie dynamiquement `<html lang="ar" dir="rtl">` et persiste le choix dans `localStorage`.
- Les numéros de téléphone (`+221...`, `+212...`) conservent systématiquement `dir="ltr"` afin de ne jamais inverser l'indicatif pays.
- Les flèches de navigation (chapitres de biographie, boutons de retour) s'inversent sémantiquement entre le français et l'arabe.

---

## 4. Composants Clés & Micro-Interactions

### 4.1 Barre d'État Réseau & Synchronisation (Sticky Header)
- **En ligne & synchronisé :** Pastille verte/dorée `--accent-primary` + libellé `Synchronisé` / `متزامن`.
- **Hors-ligne :** Pastille ambre `--status-offline` + libellé `Hors-ligne (saisie locale active)` / `بدون إنترنت`.
- **File d'attente non vide :** Badge compteur tabulaire `N en attente` qui se décrémente automatiquement dès la reconnexion.

### 4.2 Carte de Zikr (Espace Membre)
- **En-tête :** Nom du zikr dans la langue active + formule arabe calligraphiée (`Amiri`) + badge de pourcentage (`tabular-nums`).
- **Jauge de progression :** Barre horizontale épaisse (`10px`, coins arrondis) qui passe de `--accent-primary` à `--accent-gold` lorsque l'objectif atteint `100 %`.
- **Grille 3 colonnes :** `Objectif` | `Fait` | `Reste` en chiffres tabulaires gras.
- **Ligne collective :** Affiche uniquement le total du groupe pour ce zikr (`Total groupe : X / Y`), sans aucun classement ni mention d'autres membres.
- **Action principale :** Bouton pleine largeur de `48px` de hauteur (`+ Saisir un comptage`).

### 4.3 Pavé Tactile de Saisie Rapide (Modale)
- **3 boutons raccourcis géants (`56px` de hauteur) :** `+100`, `+500`, `+1 000`.
- **Bouton contextuel :** `Valider tout le reste (+N)` affiché tant que le reste à faire est strictement positif.
- **Champ libre numérique :** Clavier numérique mobile (`inputMode="numeric"`) couplé à un bouton `Valider` de `56px`.

### 4.4 Lecteur de Biographie de Seydina Cheikh
- **Contrôle typographique intégré :** Sélecteur `A` / `A+` / `A++` ajustant la taille et l'interlignage (`leading-7` à `leading-9`) pour un confort maximal sur écran mobile.
- **Navigation par chapitres :** Onglets horizontaux défilants + boutons `Chapitre précédent` / `Chapitre suivant` en bas de lecture.

### 4.5 Tableau de Bord Temps Réel & Graphiques (Espace Cheikh)
- **5 vues commutables :** *Vue d'ensemble*, *Par zikr*, *Par personne*, *Par jour*, *Totalité séjour*, croisées avec 3 listes déroulantes combinables (`Jour × Zikr × Membre`).
- **Graphique d'évolution :** Diagramme en barres empilées SVG natif distinguant les accomplissements sur objectifs personnels (`#0E4D3E`) et les contributions au pot commun (`#B8862D`), exportable en un clic en **PNG** (1400×760 px) et **CSV** (UTF-8 BOM).
```

Ces deux fichiers Markdown sont maintenant prêts dans ton espace de travail : tu peux les copier, les modifier ou les exporter directement dans le dossier `docs/` de ton dépôt.