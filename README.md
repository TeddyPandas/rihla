# Zikr

PWA mobile du disciple (français / arabe RTL, thèmes clair et sombre, hors ligne).
Sans étape de build : servir le dossier en HTTP(S) (`python3 -m http.server 8741`), puis ouvrir `http://localhost:8741`.

- `index.html`, `app.js`, `styles.css` : application
- `sw.js`, `manifest.webmanifest`, `icons/` : PWA (cache hors ligne, installation)
- `design/` : maquette source (Claude Design)

Note : l'authentification et les données sont locales au navigateur (pas de backend).
