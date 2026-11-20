# Ziyara Fès 2026 — Suivi de Zikr (Offline-First PWA)

Application web mobile-first installable (PWA) bilingue **Français / Arabe (RTL)** avec thème Jour (*Zellige de Fès*) et mode Nuit (*Nocturne de la Zaouïa*), conçue pour le suivi des objectifs de zikr d'un groupe lors d'une ziyara à Fès (**19 au 27 décembre 2026**).

## Installation rapide

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Copier `.env.example` vers `.env.local` et renseigner les clés Supabase.
3. Exécuter la migration SQL `supabase/migrations/20261120000000_init_ziyara_fes.sql` dans l'éditeur SQL de Supabase.
4. Créer le séjour (`ziyaras`) et le compte initial du Cheikh (`digits@ziyara.local` dans Auth + ligne `role = 'cheikh'` dans `group_members`).
5. Lancer en développement (`npm run dev`) ou compiler en production (`npm run build && npm start`) pour activer le Service Worker hors-ligne.

Voir le détail complet dans `docs/CAHIER_TECHNIQUE.md`.
