# Bahnpreis-Tracker auf GitHub Pages veröffentlichen

## 1. Neues Repository anlegen
1. Bei GitHub anmelden.
2. Oben rechts auf das Pluszeichen klicken.
3. **New repository** wählen.
4. Repository-Name: `bahnpreis-tracker`
5. Sichtbarkeit: **Public**
6. Auf **Create repository** klicken.

## 2. Dateien hochladen
1. Im neuen Repository auf **uploading an existing file** klicken.
2. Alle Dateien aus diesem Ordner hochladen:
   - index.html
   - styles.css
   - app.js
   - manifest.json
   - service-worker.js
   - icon.svg
3. Unten auf **Commit changes** klicken.

## 3. GitHub Pages einschalten
1. Im Repository auf **Settings** klicken.
2. Links auf **Pages** gehen.
3. Unter **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Auf **Save** klicken.

Nach kurzer Zeit erscheint oben die Webadresse. Sie sieht ungefähr so aus:

`https://DEIN-GITHUB-NAME.github.io/bahnpreis-tracker/`

## 4. Auf dem iPhone installieren
1. Die Webadresse in **Safari** öffnen.
2. Unten auf das Teilen-Symbol tippen.
3. **Zum Home-Bildschirm** wählen.
4. Namen bestätigen und auf **Hinzufügen** tippen.

Danach erscheint der Bahnpreis-Tracker wie eine App auf dem Startbildschirm.

## 5. Wichtige Datensicherung
Die Daten werden im Browser des jeweiligen Geräts gespeichert.

Deshalb:
- möglichst immer dasselbe Handy verwenden,
- mindestens einmal pro Woche auf **CSV sichern** tippen,
- die CSV-Datei in iCloud Drive, Google Drive oder Dropbox speichern.

Die CSV-Dateien können später zusammengeführt und mit Python ausgewertet werden.

## 6. Verbindungen ändern
In der App oben auf **Verbindungen** tippen.
Jede Verbindung steht in einer eigenen Zeile.
