# Kijkdoos – ontwerpregels

Gebaseerd op de skill *ui-ux-pro-max* (profiel "Video Streaming/OTT": **Dark Mode (OLED)**, de posters geven de kleur, één merkaccent), aangepast voor een 10-foot UI met afstandsbediening.

## Kleuren (tokens in `css/app.css` → `:root`)
| Token | Waarde | Gebruik |
|---|---|---|
| `--bg` | `#08090b` | Achtergrond van alle schermen (neutraal zwart, geen blauw) |
| `--panel` / `--panel2` | `#16171b` / `#23252b` | Rijen, kaarten / geselecteerd-maar-niet-gefocust |
| `--text` / `--text2` | `#f5f5f7` / `#d0d1d6` | Hoofdtekst / beschrijvingen |
| `--muted` / `--subtle` | `#a6a8b0` / `#80838c` | Bijzaken (contrast 8:1 en 5:1 op `--bg`) |
| `--accent` | `#f2a93b` | Merkkleur uit het logo: voortgangsbalken, "Nieuw"-labels, actief menu-item, geselecteerde categorie |
| `--focus` / `--focus-ink` | wit / `#0b0c0e` | Focus |

Geen losse hexwaarden in componenten; altijd een token.

## Focus (belangrijkste regel)
- **Er is altijd precies één focus zichtbaar.**
- Tekstelementen (knoppen, menu, lijsten, instellingen, gids, afleveringen, dialogen): **witte achtergrond met donkere tekst**.
- Beelden (posters, brede kaarten, personen, zenderlogo's): **witte rand van 5px**, kaart iets omhoog.
- Geselecteerd zonder focus (bv. huidige categorie): `--panel2` met een **oranje balkje links** (`inset 4px 0 0 var(--accent)`).
- Heeft het menu bovenaan de focus, dan wordt de focus in de lijst gedimd naar "geselecteerd".

## Navigatie
- Elk hoofdscherm heeft het menu bovenaan (`TopNav`; voor lijstschermen via `UI.addNav(scherm, id)`).
- **Omhoog** bovenaan een lijst gaat naar het menu, **omlaag** of **Terug** gaat terug naar de inhoud.
- Detailpagina's (film, serie, persoon) hebben geen menu; Terug gaat naar het vorige scherm.

## Iconen en tekst
- Alleen SVG-iconen uit `Icons` (lijnstijl 2px; ster/afspelen/pauze gevuld). **Geen emoji** als icoon.
- Waardering altijd via `UI.rating(r)` (ster-icoon + cijfer).

## Beweging
- Tokens: `--t-fast` (.12s, focus), `--t-med` (.2s), `--t-slow` (.4s, achtergrondbeelden).
- Alleen focus, panelen en achtergrondbeelden animeren; `prefers-reduced-motion` zet overgangen uit.
