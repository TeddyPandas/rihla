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