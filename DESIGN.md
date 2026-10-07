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
- Zoeken: eigen toetsenbord links (geen Samsung-toetsenbord), resultaten rechts; rechts vanaf de laatste toets gaat naar de resultaten, links vanaf de eerste kaart terug.

## Iconen en tekst
- Alleen SVG-iconen uit `Icons` (lijnstijl 2px; ster/afspelen/pauze gevuld). **Geen emoji** als icoon.
- Waardering altijd via `UI.rating(r)` (ster-icoon + cijfer).

## Beweging
- Tokens: `--t-fast` (.12s, focus), `--t-med` (.2s), `--t-slow` (.4s, achtergrondbeelden).
- Alleen focus, panelen en achtergrondbeelden animeren; `prefers-reduced-motion` zet overgangen uit.

## Taal
- Elke tekst die je ziet loopt via `T('Nederlandse tekst')`; de vertalingen staan per taal in `js/lang/<code>.js` (en, de, fr, es, el, it, pl, tr). Standaard is de app Engels.
- Houd teksten kort: Duits is vaak 30% langer dan Engels en moet ook in knoppen en smalle kolommen passen.
- Zinnen met variabelen als één sjabloon: `T('Omdat je {title} keek', { title: x })`, nooit in stukjes.
- Nooit `T()` aanroepen bij het laden van een script (de taal is pas bekend na `I18N.init()`); vaste lijsten houden Nederlandse tekst en vertalen bij het tonen.
- Na nieuwe teksten: vertaling in élke taal toevoegen en `node scripts/i18n-check.js` draaien (de tests falen anders).
