# Cahier Technique & Dossier d'Architecture — Application Ziyara Fès (19–27 Décembre 2026)

**Version :** 1.0 (Intégrant Cadrage, Architecture, Conception SQL/RLS, Design Jour/Nuit & Lots 1 à 6)  
**Échéance de livraison :** 30 novembre 2026  
**Stack cible :** Next.js (App Router, TypeScript) • Serwist (PWA) • Dexie.js (IndexedDB) • Supabase (PostgreSQL, Auth, Realtime) • Vercel

## 1. Contexte & Périmètre Fonctionnel
- **Période du séjour :** 19 au 27 décembre 2026 (9 jours) à Fès, Maroc (`Africa/Casablanca`).
- **Invariant comptable du groupe :**
  `Objectifs personnels actifs + Pot commun = Total initial du groupe (par zikr)`
- **Hors-ligne & Synchronisation :** Outbox Pattern dans IndexedDB (`Dexie.js`) avec `client_mutation_id` (UUIDv4) et idempotence garantie côté PostgreSQL (`ON CONFLICT (client_mutation_id) DO NOTHING`).
- **Horaires de prière de Fès :** Table officielle embarquée forcée sur `Africa/Casablanca` + fallback `adhan`.
- **Notifications & Rappels :** Centre de notifications in-app persistant + export calendrier `.ics` sur 9 jours pour alarmes 100 % hors-ligne sur iOS et Android.
