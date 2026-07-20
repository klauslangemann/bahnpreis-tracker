# Version 4.2 auf GitHub aktualisieren

1. ZIP-Datei entpacken.
2. Im Repository `bahnpreis-tracker` auf **Add file** → **Upload files**.
3. Alle Dateien aus diesem Ordner hochladen.
4. Unten auf **Commit changes** klicken.
5. Etwa 1 bis 2 Minuten warten.
6. Auf dem iPhone die App vollständig schließen.
7. Die Website einmal in Safari öffnen und neu laden.
8. Danach die App vom Home-Bildschirm erneut öffnen.

## Erinnerungen auf dem iPhone

1. In der App drei Uhrzeiten auswählen.
2. Auf **Kalender-Erinnerungen erstellen** tippen.
3. Die Datei `bahnpreis-erinnerungen.ics` öffnen.
4. Die drei wiederkehrenden Termine dem iPhone-Kalender hinzufügen.

Die Erinnerung erscheint dann täglich zu den gewählten Zeiten.

## Hinweis zu echten Push-Nachrichten

Eine GitHub-Pages-App kann keine zeitgesteuerten Push-Nachrichten versenden, wenn sie geschlossen ist.
Dafür wäre zusätzlich ein Push-Server nötig.
Die Kalenderlösung funktioniert ohne zusätzlichen Server und ist auf dem iPhone zuverlässig.


## DB-Suchbutton

Bei jeder Verbindung gibt es jetzt **Bei DB suchen**.

Der Button übernimmt:
- Kassel-Wilhelmshöhe als Start,
- das jeweilige Ziel,
- das oben gewählte Reisedatum,
- die bei der Verbindung hinterlegte Uhrzeit.

Bitte vor dem Antippen immer zuerst das Reisedatum auswählen.

Hinweis: Die DB kann die Struktur ihrer Buchungslinks ändern. Falls die Felder später nicht mehr vollständig vorausgefüllt werden, muss nur die Linkfunktion in `app.js` angepasst werden.


## Neu in Version 4.2

- Keine erfundenen Abfahrtszeiten mehr.
- Abfahrtszeit ist bei jeder Verbindung direkt editierbar.
- Zugnummer kann zusätzlich eingetragen werden.
- Zeit und Zugnummer werden dauerhaft im Browser gespeichert.
- Der DB-Suchbutton funktioniert erst, nachdem eine Zeit eingetragen wurde.
- Beim Speichern einer Preisbeobachtung werden Zeit und Zugnummer mitgespeichert.
