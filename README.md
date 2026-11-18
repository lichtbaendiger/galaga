# GALAGA – Web Arcade

Ein Galaga-Klon (Homage an Namco, 1981) für den Browser – reines HTML5/Canvas +
JavaScript, keine Frameworks, keine externen Dateien, funktioniert auch per
Doppelklick auf `index.html` (file://).

## Starten

Einfach **`index.html` per Doppelklick** im Browser öffnen (Chrome/Edge/Firefox).
Optional mit kleinem Webserver:

```powershell
python -m http.server 8000    # dann http://localhost:8000
```

## Steuerung

| Aktion   | Tastatur                  | Touch/Maus              |
|----------|---------------------------|--------------------------|
| Bewegen  | Pfeil ← → (oder A/D)      | Auf dem Spielfeld ziehen |
| Feuer    | Leertaste                 | FEUER-Button             |
| Start    | Enter / Leertaste         | START-Button             |
| Pause    | P                         | PAUSE-Button             |
| Ton an/aus | M                       | –                        |

## Eingebaute Galaga-Mechaniken

- Formation aus 5 Reihen: 4 **Boss Galaga**, **Chamäleons** (blinken in
  Wechsel-Farben), **Falter (Goeei)** und **Bienen (Gzap)** – mit Einflug-Choreografie
  entlang geschwungener Kurven und "Pop"-Geräusch beim Einordnen.
- **Sturzangriffe** mit Loop-, Swoop- und Webel-Pfaden; Gegner schießen dabei
  Zielsalven auf den Spieler.
- **Traktorstrahl**: Ab Welle 2 lassen Boss-Galaga Schiffe im Strahl schweben
  und **fangen deinen Fighter**. Der Gefangene kloppt in der Formation und
  beschießt dich – abschießen = **Rettung**, er flieht zu dir zurück und du
  bekommst den **Dual-Fighter** (4 Schüsse gleichzeitig).
- **Challenging Stage** (Welle 3, 7, 11, …) mit eigenem Marsch – alle abschießen
  bringt den Perfekt-Bonus.
- Klassische **Punktwerte** (Biene 50/100, Falter 80/160, Chamäleon 100/200,
  Boss 150/400 mit 2 Treffer, Flagge 800, Rettung 1000).
- Boni: Extraleben bei 20.000 (danach alle 60.000), Wellen-Bonus, Highscore im
  Browser-Speicher.
- Attract-Mode, "PLAYER 1"-Einlauf, Pause, Ton abschaltbar, Retro-Pixel-Font,
  CRT-Scanlines, Sternenfeld – alles prozedural gezeichnet, Sounds per WebAudio
  synthetisiert (eigene Melodien, kein Original-Asset).

## Projektstruktur

```
index.html        – Einstiegspunkt
css/style.css     – Arcade-Rahmen + Scanlines
js/pixel.js       – 16x16-Pixel-Sprites + 5x7-Pixel-Font + Renderer
js/audio.js       – WebAudio-Synth (Schüsse, Explosionen, Strahl, Jingles)
js/game.js        – Spiel-Engine: Splines, Formation, KIs, Wellen, HUD
```
