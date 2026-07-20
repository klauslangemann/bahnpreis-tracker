# Bahnpreis-Tracker V8.3

Bugfix:
- Beim Klick auf „Abfrage abschließen“ wird der neue Datensatz zusätzlich
  als letzter Datensatz der jeweiligen Karte gespeichert.
- Die Karte verwendet diesen Datensatz unmittelbar nach dem Speichern.
- JavaScript und CSS erhalten eine Versionskennung; der Service Worker
  liefert diese Dateien nicht mehr aus einem alten Cache.
