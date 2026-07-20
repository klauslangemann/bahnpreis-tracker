# Bahnpreis-Tracker Version 5

## Installation auf GitHub Pages

1. ZIP entpacken.
2. Im Repository `bahnpreis-tracker` alle enthaltenen Dateien hochladen.
3. Bestehende Dateien überschreiben.
4. Commit ausführen.
5. Etwa zwei Minuten warten.
6. Die GitHub-Pages-Seite in Safari öffnen und neu laden.
7. Danach die Web-App vom Home-Bildschirm öffnen.

## Neu in Version 5

- Projekte werden ausschließlich nach Reisedatum geführt.
- Das Reisedatum bleibt dauerhaft gespeichert.
- Mehrere Projekte können parallel geführt werden.
- Startbahnhof, Ziele, Abfahrtszeiten und Zugnummern werden je Projekt gespeichert.
- Pro Verbindung wird nur der günstigste Preis plus Preisart und Auslastung erfasst.
- Der DB-Button verwendet das jeweilige Reisedatum und die gespeicherte Abfahrtszeit.
- Dashboard, Preisstatistik und Preisdiagramm.
- CSV-Export pro Projekt.
- Vollständiges JSON-Backup aller Projekte mit Wiederherstellung.

## Speicherung

Die Daten liegen automatisch im lokalen Speicher des Browsers auf dem jeweiligen Gerät.
GitHub speichert nur die Programmdateien. Daher regelmäßig das vollständige Backup herunterladen.


## Kalender-Erinnerungen

In der App können drei tägliche Uhrzeiten eingestellt werden.
Der Button „Kalender-Erinnerungen erstellen“ erzeugt eine Apple-kompatible ICS-Datei
mit Zeitzone Europe/Berlin und Erinnerungsalarm.

Auf iPhone/iPad:
1. Datei erzeugen und herunterladen.
2. In der Dateien-App lange auf die ICS-Datei drücken.
3. „Teilen“ wählen.
4. Am zuverlässigsten: an die eigene Mail-Adresse senden und die Anlage in Apple Mail öffnen.
5. Dort „Alle hinzufügen“ wählen.

Direktes Öffnen aus der Dateien-App wird von iOS je nach Version nicht immer angeboten.


## Screenshot-Erkennung (Testversion)

1. Bei einer Verbindung auf „Bei DB suchen“ tippen.
2. Auf der DB-Seite einen Screenshot aufnehmen.
3. Zurück zum Bahnpreis-Tracker wechseln.
4. „Screenshot auswählen“ tippen und das gerade aufgenommene Bild auswählen.
5. Die App ordnet den Screenshot automatisch der zuletzt geöffneten Verbindung zu.
6. Preis und Preisart prüfen und in die Eingabemaske übernehmen.

Die OCR läuft lokal im Browser. Beim ersten Import werden über das Internet die
Tesseract-OCR-Komponenten und die deutschen Sprachdaten geladen. Die Erkennung ist
eine Testfunktion und sollte vor dem Speichern kontrolliert werden.


## Drei Tarifpreise pro Screenshot

Die Screenshot-Erkennung übernimmt nun getrennt:

- Super Sparpreis
- Sparpreis
- Flexpreis

Die drei Werte werden je Verbindung und Abfragezeit separat gespeichert.
Für ältere Datensätze bleibt der bisher gespeicherte günstigste Preis weiterhin lesbar.
Die Auswertung kann zwischen den drei Tarifarten und dem jeweils günstigsten Preis umgeschaltet werden.

Wichtig: Die OCR-Zuordnung bitte kurz prüfen. Wenn auf dem Screenshot zusätzliche
Euro-Beträge stehen, kann eine manuelle Korrektur erforderlich sein.


## Änderung: zwei Preise und korrigierter DB-Link

Gespeichert werden nur noch:

- Super Sparpreis
- Sparpreis

Der Flexpreis wurde entfernt, weil er für die Beobachtung nicht benötigt wird.

Der DB-Link verwendet nun die aktuelle Fahrplan-Suche der Deutschen Bahn und
übergibt Start, Ziel, Reisedatum und Abfahrtszeit. Die frühere URL über
`/buchung/start` konnte einzelne Angaben ignorieren und dadurch eine falsche
Verbindung anzeigen.

Hinweis: Die DB-Seite öffnet die Suche zur gespeicherten Abfahrtszeit. Eine
bestimmte Zugnummer lässt sich über einen stabilen öffentlichen DB-Link nicht
zuverlässig direkt auswählen. Die gewünschte Verbindung sollte jedoch in der
Trefferliste an der passenden Uhrzeit erscheinen.
