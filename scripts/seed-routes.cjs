#!/usr/bin/env node
// Seeds hiking routes, ski-touring areas and short train-reachable trips into data/destinations.
// Re-runnable: overwrites these ids only.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "data", "destinations");

const alps12 = [0, 0, 0, 0, 20, 70, 90, 90, 85, 40, 0, 0];      // summer hut-to-hut
const ski12 = [55, 85, 95, 85, 45, 0, 0, 0, 0, 0, 10, 35];        // alpine ski touring
const stage = (id, name, place, o) => Object.assign({ id, type: "stage", name, place, defaultDays: 1, minDays: 1, maxDays: 2, crowd: "med", transitHours: 0, see: [], history: null, guidebookPick: true }, o);
const city = (id, name, place, o) => Object.assign({ id, type: "city", name, place, defaultDays: 1, minDays: 1, maxDays: 3, crowd: "med", transitHours: 0, maxAltitudeM: 500, dayHighC: 24, see: [], history: null, guidebookPick: false }, o);
const hutLink = { name: "hut-reservation.org (SAC, DAV, ÖAV, CAI huts)", url: "https://www.hut-reservation.org/" };

const D = [];

/* ---------------- Hiking routes ---------------- */
D.push({
  id: "alta-via-2", kind: "hike", zone: "europe", name: "Alta Via 2 (Dolomites)", region: "Brixen to Feltre, Italy", noFlights: true,
  tagline: "The harder of the two Dolomite high routes: Puez, Sella, Marmolada, Pale di San Martino, with cables on a few stages.",
  tags: ["mountains", "huts", "via-ferrata-light", "limestone"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 230, route: "Brussels→Munich→Innsbruck→Brixen/Bressanone (train, 10 h); home from Feltre→Venice→Munich" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 300, route: "Eurostar→Paris, TGV→Munich (or night train), →Innsbruck→Brixen" }],
  rates: { stage: 90, city: 110, transit: 100, guide: 70 }, lodgingAssumption: "Rifugio half board in dormitories or small rooms; lunches from the hut; one hotel night at each end",
  presets: [
    { name: "Full route (13 stages)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, s10: 1, s11: 1, s12: 1, s13: 1, brixen: 1, feltre: 1 } },
    { name: "Northern half (Brixen→Passo San Pellegrino)", picks: { brixen: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1 } },
    { name: "Pale di San Martino week", picks: { s8: 1, s9: 1, s10: 1, s11: 1, s12: 1, s13: 1, feltre: 1 } }
  ],
  blocks: [
    city("brixen", "Brixen / Bressanone", "Cathedral town at 560 m, start of the route", { transitHours: 10, history: "Prince-bishops of Brixen", dayHighC: 26 }),
    stage("s1", "Stage 1: Plose to Rifugio Genova", "Brixen cable car to the Plose, then the Peitlerkofel", { distanceKm: 12, ascentM: 600, descentM: 700, hours: 5, maxAltitudeM: 2300, difficulty: "T2", hut: { name: "Rifugio Genova / Schlüterhütte", bookAheadMonths: 5 }, dayHighC: 16 }),
    stage("s2", "Stage 2: to Rifugio Puez", "Forcella de Furcia, the Puez plateau", { distanceKm: 11, ascentM: 700, descentM: 500, hours: 5, maxAltitudeM: 2530, difficulty: "T2", hut: { name: "Rifugio Puez", bookAheadMonths: 5 }, dayHighC: 15 }),
    stage("s3", "Stage 3: to Rifugio Pisciadù", "Passo Gardena, the Val Setus cables", { distanceKm: 9, ascentM: 800, descentM: 600, hours: 5, maxAltitudeM: 2585, difficulty: "T3", hut: { name: "Rifugio Pisciadù", bookAheadMonths: 5 }, crowd: "high", dayHighC: 14, note: "Short cabled section; busy around Passo Gardena." }),
    stage("s4", "Stage 4: to Rifugio Castiglioni (Marmolada)", "Across the Sella plateau, Piz Boè optional, down to Pordoi and Fedaia", { distanceKm: 14, ascentM: 700, descentM: 1200, hours: 6, maxAltitudeM: 3152, difficulty: "T3", hut: { name: "Rifugio Castiglioni / Marmolada", bookAheadMonths: 4 }, crowd: "high", dayHighC: 14 }),
    stage("s5", "Stage 5: to Rifugio Contrin", "Under the Marmolada's south face, Passo Ombretta", { distanceKm: 10, ascentM: 650, descentM: 700, hours: 5, maxAltitudeM: 2700, difficulty: "T2", hut: { name: "Rifugio Contrin", bookAheadMonths: 4 }, dayHighC: 15 }),
    stage("s6", "Stage 6: to Passo San Pellegrino", "Passo delle Cirelle, 2,683 m, the Costabella", { distanceKm: 11, ascentM: 700, descentM: 800, hours: 5, maxAltitudeM: 2683, difficulty: "T3", hut: { name: "Rifugio Fuciade or hotel at the pass", bookAheadMonths: 3 }, dayHighC: 16 }),
    stage("s7", "Stage 7: to Rifugio Mulaz", "Forcella di Venegia, the Pale start", { distanceKm: 11, ascentM: 900, descentM: 500, hours: 5, maxAltitudeM: 2600, difficulty: "T3", hut: { name: "Rifugio Mulaz", bookAheadMonths: 4 }, dayHighC: 14 }),
    stage("s8", "Stage 8: to Rifugio Rosetta", "Passo delle Farangole (cables), the Altopiano delle Pale", { distanceKm: 10, ascentM: 700, descentM: 700, hours: 6, maxAltitudeM: 2814, difficulty: "T3+", hut: { name: "Rifugio Rosetta", bookAheadMonths: 4 }, dayHighC: 13, note: "The hardest stage: exposed cables at the Farangole." }),
    stage("s9", "Stage 9: to Rifugio Pradidali", "Across the lunar plateau, Passo di Ball", { distanceKm: 8, ascentM: 400, destcentM: 700, descentM: 700, hours: 4, maxAltitudeM: 2650, difficulty: "T3", hut: { name: "Rifugio Pradidali", bookAheadMonths: 4 }, dayHighC: 14 }),
    stage("s10", "Stage 10: to Rifugio Treviso", "Passo delle Lede, into the Canali valley", { distanceKm: 11, ascentM: 600, descentM: 1000, hours: 6, maxAltitudeM: 2695, difficulty: "T3", hut: { name: "Rifugio Treviso", bookAheadMonths: 3 }, crowd: "low", dayHighC: 16 }),
    stage("s11", "Stage 11: to Passo Cereda", "Forcella d'Oltro, down to the pass", { distanceKm: 9, ascentM: 500, descentM: 700, hours: 4, maxAltitudeM: 2229, difficulty: "T2", hut: { name: "Rifugio Cereda", bookAheadMonths: 2 }, crowd: "low", dayHighC: 18 }),
    stage("s12", "Stage 12: to Rifugio Boz", "Into the Vette Feltrine, the quiet end", { distanceKm: 14, ascentM: 1000, descentM: 700, hours: 7, maxAltitudeM: 2100, difficulty: "T3", hut: { name: "Rifugio Boz", bookAheadMonths: 2 }, crowd: "low", dayHighC: 17 }),
    stage("s13", "Stage 13: to Rifugio Dal Piaz and Croce d'Aune", "Passo di Finestra, the Busa delle Vette, down to the road", { distanceKm: 14, ascentM: 800, descentM: 1100, hours: 7, maxAltitudeM: 2170, difficulty: "T3", hut: { name: "Rifugio Dal Piaz", bookAheadMonths: 2 }, crowd: "low", dayHighC: 18 }),
    city("feltre", "Feltre", "Walled Venetian town, end of the route", { history: "Venetian Republic frontier town", dayHighC: 27, transitHours: 1 })
  ],
  season: { fitByMonth: alps12, events: [{ name: "Ferragosto", from: "08-10", to: "08-20", effect: "crowds", note: "Italian holiday peak; huts full" }], notes: ["Huts open late June to late September; snow on the north sides into early July.", "Afternoon storms are the rule in July and August: on the pass by noon.", "Book huts in January for July and August; most now take online booking."] },
  climate: { representative: "Huts at 2,200–2,500 m", dayHighC: [-3, -2, 1, 5, 10, 14, 17, 17, 13, 8, 2, -2], nightLowC: [-11, -11, -8, -4, 0, 4, 7, 7, 4, 0, -5, -9], rainDays: [6, 6, 8, 10, 13, 14, 13, 13, 10, 9, 8, 7], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [{ name: "Meteo Trentino mountain forecast", url: "https://www.meteotrentino.it/", type: "weather" }, { name: "Südtirol weather (Provinz Bozen)", url: "https://weather.provinz.bz.it/", type: "weather" }, hutLink],
  guides: [{ name: "Cicerone: Alta Via 1 and 2", url: "https://www.cicerone.co.uk/" }]
});

D.push({
  id: "alta-via-1", kind: "hike", zone: "europe", name: "Alta Via 1 (Dolomites)", region: "Lago di Braies to Belluno, Italy", noFlights: true,
  tagline: "The classic Dolomite high route: nine or ten days of rifugio to rifugio with no cables needed.",
  tags: ["mountains", "huts", "limestone", "classic"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 230, route: "Brussels→Munich→Innsbruck→Dobbiaco/Toblach, bus to Lago di Braies; home from Belluno→Venice" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 300, route: "Eurostar→Paris→Munich→Innsbruck→Dobbiaco" }],
  rates: { stage: 90, city: 110, transit: 100, guide: 70 }, lodgingAssumption: "Rifugio half board; one hotel night at each end",
  presets: [
    { name: "Full route (9 stages)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, venice: 1 } },
    { name: "Northern week", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } }
  ],
  blocks: [
    stage("s1", "Stage 1: Lago di Braies to Rifugio Biella / Sennes", "Up from the lake over the Forcella Sora Forno", { distanceKm: 10, ascentM: 900, descentM: 200, hours: 5, maxAltitudeM: 2388, difficulty: "T2", hut: { name: "Rifugio Sennes", bookAheadMonths: 5 }, crowd: "high", transitHours: 10, dayHighC: 15 }),
    stage("s2", "Stage 2: to Rifugio Fanes", "Across the Fanes plateau", { distanceKm: 13, ascentM: 400, descentM: 500, hours: 4, maxAltitudeM: 2200, difficulty: "T2", hut: { name: "Rifugio Fanes", bookAheadMonths: 5 }, dayHighC: 16 }),
    stage("s3", "Stage 3: to Rifugio Lagazuoi", "Forcella del Lago, the WWI tunnels", { distanceKm: 12, ascentM: 900, descentM: 400, hours: 6, maxAltitudeM: 2752, difficulty: "T2", hut: { name: "Rifugio Lagazuoi", bookAheadMonths: 5 }, crowd: "high", history: "Austro-Italian front, 1915–17", dayHighC: 13 }),
    stage("s4", "Stage 4: to Rifugio Nuvolau", "Cinque Torri, the Averau", { distanceKm: 11, ascentM: 600, descentM: 800, hours: 5, maxAltitudeM: 2575, difficulty: "T2", hut: { name: "Rifugio Nuvolau", bookAheadMonths: 5 }, crowd: "high", dayHighC: 14 }),
    stage("s5", "Stage 5: to Rifugio Città di Fiume", "Passo Giau, under the Pelmo", { distanceKm: 14, ascentM: 500, descentM: 1100, hours: 6, maxAltitudeM: 2460, difficulty: "T2", hut: { name: "Rifugio Città di Fiume", bookAheadMonths: 4 }, dayHighC: 16 }),
    stage("s6", "Stage 6: to Rifugio Tissi", "Forcella Staulanza, the Civetta's north wall", { distanceKm: 14, ascentM: 900, descentM: 600, hours: 6, maxAltitudeM: 2250, difficulty: "T2", hut: { name: "Rifugio Tissi", bookAheadMonths: 4 }, dayHighC: 15 }),
    stage("s7", "Stage 7: to Rifugio Carestiato", "Under the Civetta and Moiazza via Vazzoler", { distanceKm: 16, ascentM: 700, descentM: 1100, hours: 7, maxAltitudeM: 2100, difficulty: "T2", hut: { name: "Rifugio Carestiato", bookAheadMonths: 3 }, crowd: "low", dayHighC: 17 }),
    stage("s8", "Stage 8: to Rifugio Pramperet", "Forcella del Camp, the Tamer", { distanceKm: 12, ascentM: 800, descentM: 700, hours: 6, maxAltitudeM: 2050, difficulty: "T2", hut: { name: "Rifugio Pramperet", bookAheadMonths: 3 }, crowd: "low", dayHighC: 17 }),
    stage("s9", "Stage 9: to Rifugio Pian de Fontana and La Pissa", "Forcella de Zità Sud, the Schiara, down to the bus", { distanceKm: 15, ascentM: 700, descentM: 1600, hours: 7, maxAltitudeM: 2395, difficulty: "T3", hut: { name: "Rifugio Pian de Fontana", bookAheadMonths: 3 }, crowd: "low", dayHighC: 18, note: "Long descent on tired legs; the Schiara variant has cables." }),
    city("venice", "Venice (end)", "Train from Belluno, 2 h", { history: "The Republic that owned these mountains", crowd: "high", dayHighC: 29, transitHours: 2 })
  ],
  season: { fitByMonth: alps12, events: [{ name: "Ferragosto", from: "08-10", to: "08-20", effect: "crowds", note: "Huts full" }], notes: ["Huts open late June to late September.", "The most popular hut route in the Alps: book in January.", "Water is scarce on the plateaus; carry two litres."] },
  climate: { representative: "Huts at 2,000–2,500 m", dayHighC: [-3, -2, 1, 5, 10, 14, 17, 17, 13, 8, 2, -2], nightLowC: [-11, -11, -8, -4, 0, 4, 7, 7, 4, 0, -5, -9], rainDays: [6, 6, 8, 10, 13, 14, 13, 13, 10, 9, 8, 7], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [{ name: "ARPA Veneto Dolomiti Meteo", url: "https://www.arpa.veneto.it/", type: "weather" }, hutLink],
  guides: [{ name: "Cicerone: Alta Via 1 and 2", url: "https://www.cicerone.co.uk/" }]
});

D.push({
  id: "tmb", kind: "hike", zone: "europe", name: "Tour du Mont Blanc", region: "France, Italy, Switzerland", noFlights: true,
  tagline: "170 km round the massif in ten or eleven days; refuges, three countries, the most walked long route in the Alps.",
  tags: ["mountains", "huts", "classic", "glaciers"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 220, route: "Brussels→Paris→Saint-Gervais→Chamonix / Les Houches, 7 h" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 240, route: "Eurostar→Paris→Saint-Gervais→Les Houches, 8 h" }],
  rates: { stage: 95, city: 130, transit: 110, guide: 70 }, lodgingAssumption: "Refuge half board (dortoir or small rooms); hotels in Courmayeur and Chamonix",
  presets: [
    { name: "Full tour (10 stages)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, s10: 1 } },
    { name: "Italian and Swiss half", picks: { s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1 } }
  ],
  blocks: [
    stage("s1", "Stage 1: Les Houches to Les Contamines", "Col de Voza or the Col de Tricot variant", { distanceKm: 16, ascentM: 650, descentM: 900, hours: 6, maxAltitudeM: 2120, difficulty: "T2", hut: { name: "Refuge Nant Borrant or hotel in Les Contamines", bookAheadMonths: 5 }, crowd: "high", transitHours: 7, dayHighC: 20 }),
    stage("s2", "Stage 2: to Les Chapieux", "Col du Bonhomme and Col de la Croix du Bonhomme", { distanceKm: 18, ascentM: 1300, descentM: 950, hours: 7, maxAltitudeM: 2479, difficulty: "T2", hut: { name: "Refuge de la Croix du Bonhomme / Les Chapieux", bookAheadMonths: 5 }, crowd: "high", dayHighC: 15 }),
    stage("s3", "Stage 3: to Rifugio Elisabetta", "Col de la Seigne into Italy", { distanceKm: 15, ascentM: 1000, descentM: 400, hours: 6, maxAltitudeM: 2516, difficulty: "T2", hut: { name: "Rifugio Elisabetta", bookAheadMonths: 5 }, crowd: "high", dayHighC: 14 }),
    stage("s4", "Stage 4: to Courmayeur", "The balcony path under the Italian face, Mont Favre", { distanceKm: 17, ascentM: 500, descentM: 1500, hours: 6, maxAltitudeM: 2430, difficulty: "T2", hut: { name: "Hotel in Courmayeur", bookAheadMonths: 3 }, crowd: "high", dayHighC: 22 }),
    stage("s5", "Stage 5: to Rifugio Bonatti", "Val Ferret balcony", { distanceKm: 12, ascentM: 900, descentM: 100, hours: 5, maxAltitudeM: 2025, difficulty: "T2", hut: { name: "Rifugio Bonatti", bookAheadMonths: 5 }, crowd: "high", dayHighC: 16 }),
    stage("s6", "Stage 6: to La Fouly", "Grand Col Ferret into Switzerland", { distanceKm: 20, ascentM: 800, descentM: 1200, hours: 7, maxAltitudeM: 2537, difficulty: "T2", hut: { name: "Auberge in La Fouly", bookAheadMonths: 3 }, dayHighC: 15 }),
    stage("s7", "Stage 7: to Champex", "Valley walk through Swiss villages", { distanceKm: 15, ascentM: 400, descentM: 500, hours: 5, maxAltitudeM: 1600, difficulty: "T1", hut: { name: "Hotel or dortoir in Champex", bookAheadMonths: 3 }, crowd: "low", dayHighC: 20 }),
    stage("s8", "Stage 8: to Trient", "Bovine (easy) or Fenêtre d'Arpette (hard)", { distanceKm: 16, ascentM: 1200, descentM: 1400, hours: 7, maxAltitudeM: 2665, difficulty: "T3", hut: { name: "Auberge Mont Blanc, Trient", bookAheadMonths: 4 }, dayHighC: 16, note: "Arpette is a boulder field at 2,665 m; Bovine is the gentle alternative." }),
    stage("s9", "Stage 9: to Tré-le-Champ", "Col de Balme back into France", { distanceKm: 13, ascentM: 1000, descentM: 900, hours: 5, maxAltitudeM: 2191, difficulty: "T2", hut: { name: "Auberge La Boerne, Tré-le-Champ", bookAheadMonths: 4 }, crowd: "high", dayHighC: 17 }),
    stage("s10", "Stage 10: to Les Houches", "Aiguilles Rouges balcony, Lac Blanc, the Brévent", { distanceKm: 18, ascentM: 1200, descentM: 1700, hours: 8, maxAltitudeM: 2525, difficulty: "T3", hut: { name: "Refuge de Bellachat or hotel", bookAheadMonths: 4 }, crowd: "high", dayHighC: 17, note: "Ladders on the Aiguillette d'Argentière section; a path variant avoids them." })
  ],
  season: { fitByMonth: alps12, events: [{ name: "UTMB week", from: "08-24", to: "09-01", effect: "crowds", note: "Chamonix full; trail busy with runners" }], notes: ["Refuges open mid-June to mid-September.", "The busiest route in the Alps: book every night by February.", "Clockwise is quieter than the classic anticlockwise."] },
  climate: { representative: "Refuges at 1,800–2,500 m", dayHighC: [-2, -1, 2, 6, 11, 15, 18, 18, 14, 9, 3, -1], nightLowC: [-10, -10, -7, -3, 1, 5, 8, 8, 5, 1, -4, -8], rainDays: [8, 7, 9, 10, 13, 13, 12, 12, 10, 10, 9, 9], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [{ name: "Météo-France montagne (Chamonix)", url: "https://meteofrance.com/meteo-montagne", type: "weather" }, { name: "Chamoniarde conditions", url: "https://www.chamoniarde.com/", type: "conditions" }, hutLink],
  guides: [{ name: "Cicerone: Tour of Mont Blanc", url: "https://www.cicerone.co.uk/" }, { name: "autourdumontblanc.com (official booking)", url: "https://www.autourdumontblanc.com/" }]
});

D.push({
  id: "haute-route-walk", kind: "hike", zone: "europe", name: "Walker's Haute Route", region: "Chamonix to Zermatt, Switzerland", noFlights: true,
  tagline: "Twelve or thirteen stages across eleven passes from Mont Blanc to the Matterhorn; harder, higher and emptier than the TMB.",
  tags: ["mountains", "huts", "glaciers", "classic"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 240, route: "Brussels→Paris→Chamonix; home Zermatt→Visp→Basel→Brussels" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 260, route: "Eurostar→Paris→Chamonix; home via Basel" }],
  rates: { stage: 115, city: 150, transit: 120, guide: 80 }, lodgingAssumption: "Swiss cabanes and village dortoirs, half board",
  presets: [
    { name: "Full route (12 stages)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, s10: 1, s11: 1, s12: 1 } },
    { name: "Second half: Arolla to Zermatt", picks: { s7: 1, s8: 1, s9: 1, s10: 1, s11: 1, s12: 1 } }
  ],
  blocks: [
    stage("s1", "Stage 1: Chamonix to Trient", "Col de Balme", { distanceKm: 18, ascentM: 1300, descentM: 1000, hours: 7, maxAltitudeM: 2191, difficulty: "T2", hut: { name: "Auberge Mont Blanc, Trient", bookAheadMonths: 4 }, transitHours: 7, dayHighC: 17 }),
    stage("s2", "Stage 2: to Champex", "Fenêtre d'Arpette (or Bovine)", { distanceKm: 14, ascentM: 1400, descentM: 1200, hours: 7, maxAltitudeM: 2665, difficulty: "T3", hut: { name: "Dortoir in Champex", bookAheadMonths: 3 }, dayHighC: 16 }),
    stage("s3", "Stage 3: to Le Châble", "Down the Val de Bagnes", { distanceKm: 14, ascentM: 200, descentM: 900, hours: 4, maxAltitudeM: 1500, difficulty: "T1", hut: { name: "Hotel in Le Châble", bookAheadMonths: 2 }, crowd: "low", dayHighC: 22 }),
    stage("s4", "Stage 4: to Cabane du Mont Fort", "Up through Verbier's pastures", { distanceKm: 12, ascentM: 1650, descentM: 0, hours: 6, maxAltitudeM: 2457, difficulty: "T2", hut: { name: "Cabane du Mont Fort", bookAheadMonths: 4 }, dayHighC: 15 }),
    stage("s5", "Stage 5: to Cabane de Prafleuri", "Col Termin, Col de Louvie, Col de Prafleuri", { distanceKm: 14, ascentM: 900, descentM: 700, hours: 7, maxAltitudeM: 2965, difficulty: "T3", hut: { name: "Cabane de Prafleuri", bookAheadMonths: 4 }, dayHighC: 12, note: "Highest point of the route; boulder fields, snow patches into July." }),
    stage("s6", "Stage 6: to Arolla", "Lac des Dix, Col de Riedmatten or Pas de Chèvres ladders", { distanceKm: 17, ascentM: 900, descentM: 1200, hours: 7, maxAltitudeM: 2919, difficulty: "T3", hut: { name: "Hotel or dortoir in Arolla", bookAheadMonths: 3 }, dayHighC: 14 }),
    stage("s7", "Stage 7: to La Sage", "Lac Bleu, Les Haudères", { distanceKm: 11, ascentM: 350, descentM: 700, hours: 4, maxAltitudeM: 2100, difficulty: "T1", hut: { name: "Hotel in La Sage", bookAheadMonths: 2 }, crowd: "low", dayHighC: 20 }),
    stage("s8", "Stage 8: to Cabane de Moiry", "Col de Torrent, Lac de Moiry", { distanceKm: 16, ascentM: 1300, descentM: 600, hours: 7, maxAltitudeM: 2919, difficulty: "T2", hut: { name: "Cabane de Moiry", bookAheadMonths: 4 }, dayHighC: 12 }),
    stage("s9", "Stage 9: to Zinal", "Col de Sorebois", { distanceKm: 12, ascentM: 450, descentM: 1600, hours: 5, maxAltitudeM: 2835, difficulty: "T2", hut: { name: "Hotel or dortoir in Zinal", bookAheadMonths: 2 }, dayHighC: 18 }),
    stage("s10", "Stage 10: to Gruben", "Forcletta into the Turtmanntal", { distanceKm: 14, ascentM: 1200, descentM: 1050, hours: 6, maxAltitudeM: 2874, difficulty: "T2", hut: { name: "Hotel Schwarzhorn, Gruben", bookAheadMonths: 3 }, crowd: "low", dayHighC: 16 }),
    stage("s11", "Stage 11: to St Niklaus / Gasenried", "Augstbordpass", { distanceKm: 16, ascentM: 1100, descentM: 1700, hours: 7, maxAltitudeM: 2894, difficulty: "T2", hut: { name: "Hotel in St Niklaus or Gasenried", bookAheadMonths: 2 }, crowd: "low", dayHighC: 20 }),
    stage("s12", "Stage 12: Europaweg to Zermatt", "Europahütte, the Charles Kuonen suspension bridge, Zermatt", { distanceKm: 20, ascentM: 900, descentM: 1100, hours: 8, maxAltitudeM: 2300, difficulty: "T3", hut: { name: "Europahütte (night before) / Zermatt", bookAheadMonths: 4 }, crowd: "med", dayHighC: 17, note: "Usually split over two days with a night at the Europahütte." })
  ],
  season: { fitByMonth: [0, 0, 0, 0, 10, 60, 90, 90, 85, 30, 0, 0], events: [], notes: ["Huts open late June to mid-September; the high cols hold snow into mid-July.", "Fewer walkers than the TMB; still book cabanes by March.", "Swiss prices: budget 15–20% above the French and Italian routes."] },
  climate: { representative: "Cabanes at 2,400–2,900 m", dayHighC: [-4, -4, -1, 3, 8, 12, 15, 15, 11, 6, 0, -3], nightLowC: [-12, -12, -9, -5, -1, 3, 6, 6, 3, -1, -6, -10], rainDays: [7, 7, 8, 9, 12, 12, 11, 11, 9, 9, 8, 8], snowMonths: [1, 2, 3, 4, 5, 6, 10, 11, 12] },
  bulletins: [{ name: "MeteoSwiss", url: "https://www.meteoswiss.admin.ch/", type: "weather" }, { name: "SAC hut portal", url: "https://www.sac-cas.ch/en/huts-and-tours/", type: "huts" }, hutLink],
  guides: [{ name: "Cicerone: Chamonix to Zermatt", url: "https://www.cicerone.co.uk/" }]
});

D.push({
  id: "gr20", kind: "hike", zone: "europe", name: "GR20 (Corsica)", region: "Calenzana to Conca, France", noFlights: true,
  tagline: "Sixteen rough stages down the spine of Corsica; granite, scrambling, basic refuges and the sea at both ends.",
  tags: ["mountains", "scrambling", "camping", "island"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "ferry", costPerPerson: 280, route: "Train Brussels→Paris→Marseille or Nice, ferry to Calvi or Bastia (6–12 h)" },
           { originRegion: "uk", originCity: "London", mode: "ferry", costPerPerson: 300, route: "Eurostar→Paris→Nice, ferry to Calvi" }],
  rates: { stage: 60, city: 110, transit: 90, guide: 60 }, lodgingAssumption: "Refuge dormitory or rented tent, refuge meals; hotel nights at Vizzavona and the ends",
  presets: [
    { name: "Northern half (9 stages, Calenzana→Vizzavona)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, calvi: 1 } },
    { name: "Southern half (7 stages, Vizzavona→Conca)", picks: { s10: 1, s11: 1, s12: 1, s13: 1, s14: 1, s15: 1, s16: 1, portovecchio: 1 } },
    { name: "Full GR20 (16 stages)", picks: { calvi: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1, s10: 1, s11: 1, s12: 1, s13: 1, s14: 1, s15: 1, s16: 1 } }
  ],
  blocks: [
    city("calvi", "Calvi", "Citadel town, ferry port, start", { history: "Genoese citadel", dayHighC: 30, transitHours: 14, crowd: "high" }),
    stage("s1", "Stage 1: Calenzana to Ortu di u Piobbu", "", { distanceKm: 12, ascentM: 1350, descentM: 250, hours: 6, maxAltitudeM: 1570, difficulty: "T3", hut: { name: "Refuge d'Ortu di u Piobbu", bookAheadMonths: 3 }, crowd: "high", dayHighC: 24 }),
    stage("s2", "Stage 2: to Carrozzu", "Bocca Piccaia, scrambling begins", { distanceKm: 8, ascentM: 750, descentM: 1050, hours: 6, maxAltitudeM: 2020, difficulty: "T4", hut: { name: "Refuge de Carrozzu", bookAheadMonths: 3 }, dayHighC: 22 }),
    stage("s3", "Stage 3: to Asco Stagnu", "Spasimata slabs and the suspension bridge, Bocca a i Stagni", { distanceKm: 6, ascentM: 850, descentM: 700, hours: 6, maxAltitudeM: 2010, difficulty: "T4", hut: { name: "Refuge d'Asco Stagnu / hotel", bookAheadMonths: 3 }, dayHighC: 21 }),
    stage("s4", "Stage 4: to Tighjettu", "Bocca Tumasginesca, the Cirque de la Solitude bypass over Pointe des Éboulis", { distanceKm: 8, ascentM: 1200, descentM: 1000, hours: 7, maxAltitudeM: 2607, difficulty: "T4", hut: { name: "Refuge de Tighjettu", bookAheadMonths: 3 }, dayHighC: 18, note: "Highest and hardest day of the north. Monte Cinto (2,706 m) is an optional detour." }),
    stage("s5", "Stage 5: to Ciottulu di i Mori", "Bocca di Foggiale under Paglia Orba", { distanceKm: 9, ascentM: 700, descentM: 400, hours: 5, maxAltitudeM: 1991, difficulty: "T3", hut: { name: "Refuge de Ciottulu di i Mori", bookAheadMonths: 3 }, dayHighC: 21 }),
    stage("s6", "Stage 6: to Manganu", "The Golo valley, Lac de Nino, Castel di Vergio", { distanceKm: 22, ascentM: 650, descentM: 1000, hours: 7, maxAltitudeM: 1760, difficulty: "T2", hut: { name: "Refuge de Manganu", bookAheadMonths: 3 }, crowd: "low", dayHighC: 23 }),
    stage("s7", "Stage 7: to Petra Piana", "Brèche de Capitello, Lac de Capitello and Melo", { distanceKm: 10, ascentM: 850, descentM: 600, hours: 6, maxAltitudeM: 2225, difficulty: "T4", hut: { name: "Refuge de Petra Piana", bookAheadMonths: 3 }, dayHighC: 19 }),
    stage("s8", "Stage 8: to L'Onda", "Ridge or valley variant", { distanceKm: 10, ascentM: 400, descentM: 800, hours: 5, maxAltitudeM: 2100, difficulty: "T3", hut: { name: "Refuge de l'Onda", bookAheadMonths: 3 }, dayHighC: 22 }),
    stage("s9", "Stage 9: to Vizzavona", "Monte d'Oro flank, Cascade des Anglais", { distanceKm: 11, ascentM: 700, descentM: 1200, hours: 6, maxAltitudeM: 2150, difficulty: "T3", hut: { name: "Hotel or gîte in Vizzavona", bookAheadMonths: 2 }, dayHighC: 24 }),
    stage("s10", "Stage 10: Vizzavona to Capannelle", "Easy forest day", { distanceKm: 14, ascentM: 900, descentM: 250, hours: 5, maxAltitudeM: 1650, difficulty: "T2", hut: { name: "Gîte de Capannelle", bookAheadMonths: 2 }, crowd: "low", dayHighC: 24 }),
    stage("s11", "Stage 11: to Prati", "Bocca di Verdi, the Punta Capannella", { distanceKm: 16, ascentM: 900, descentM: 700, hours: 6, maxAltitudeM: 1840, difficulty: "T2", hut: { name: "Refuge de Prati", bookAheadMonths: 2 }, dayHighC: 22 }),
    stage("s12", "Stage 12: to Usciolu", "Airy ridge walking", { distanceKm: 11, ascentM: 700, descentM: 800, hours: 6, maxAltitudeM: 2050, difficulty: "T3", hut: { name: "Refuge d'Usciolu", bookAheadMonths: 2 }, dayHighC: 22 }),
    stage("s13", "Stage 13: to Asinau", "Plateau du Coscione, Monte Incudine 2,134 m", { distanceKm: 17, ascentM: 900, descentM: 1100, hours: 7, maxAltitudeM: 2134, difficulty: "T3", hut: { name: "Refuge d'Asinau", bookAheadMonths: 2 }, dayHighC: 21 }),
    stage("s14", "Stage 14: to Paliri", "Bavella needles, alpine variant", { distanceKm: 13, ascentM: 650, descentM: 1100, hours: 6, maxAltitudeM: 1700, difficulty: "T3", hut: { name: "Refuge de Paliri", bookAheadMonths: 2 }, crowd: "high", dayHighC: 25 }),
    stage("s15", "Stage 15: to Conca", "Down to the maquis and the sea", { distanceKm: 12, ascentM: 300, descentM: 1100, hours: 5, maxAltitudeM: 1300, difficulty: "T2", hut: { name: "Gîte in Conca", bookAheadMonths: 1 }, dayHighC: 29 }),
    stage("s16", "Rest and sea day at Conca / Porto-Vecchio", "", { distanceKm: 0, ascentM: 0, descentM: 0, hours: 0, maxAltitudeM: 100, difficulty: "T1", hut: { name: "Hotel in Porto-Vecchio", bookAheadMonths: 2 }, crowd: "high", dayHighC: 30 }),
    city("portovecchio", "Porto-Vecchio", "Beach town, ferry or bus out", { crowd: "high", dayHighC: 30, transitHours: 1 })
  ],
  season: { fitByMonth: [0, 0, 0, 10, 50, 85, 70, 70, 90, 50, 0, 0], events: [], notes: ["June and September are the months: July and August are hot below 1,500 m and the refuges are full.", "Refuges are basic; bring a sleeping bag liner and expect to queue for the stove.", "Water is scarce on the southern stages in late summer."] },
  climate: { representative: "Refuges at 1,500–2,000 m", dayHighC: [5, 5, 8, 11, 16, 21, 25, 25, 21, 15, 10, 6], nightLowC: [-3, -3, -1, 2, 6, 10, 14, 14, 11, 7, 2, -1], rainDays: [8, 7, 7, 8, 6, 4, 2, 2, 5, 9, 9, 9], snowMonths: [1, 2, 3, 4, 12] },
  bulletins: [{ name: "Météo-France Corse", url: "https://meteofrance.com/meteo-montagne", type: "weather" }, { name: "PNR Corse refuge booking", url: "https://www.pnr.corsica/", type: "huts" }],
  guides: [{ name: "Cicerone: The GR20 Corsica", url: "https://www.cicerone.co.uk/" }]
});

D.push({
  id: "tour-monte-rosa", kind: "hike", zone: "europe", name: "Tour of Monte Rosa", region: "Zermatt, Aosta valleys, Macugnaga, Saas", noFlights: true,
  tagline: "Nine stages around the second-highest massif in the Alps, Walser villages on the Italian side, one glacier pass with a guide.",
  tags: ["mountains", "huts", "glaciers", "quiet"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 240, route: "Brussels→Basel→Visp→Zermatt, 8 h" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 270, route: "Eurostar→Paris→Basel→Visp→Zermatt" }],
  rates: { stage: 105, city: 150, transit: 120, guide: 90 }, lodgingAssumption: "Rifugi and Swiss cabanes half board; village hotels in Gressoney, Alagna, Macugnaga",
  presets: [
    { name: "Full tour (9 stages)", picks: { s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1, s8: 1, s9: 1 } },
    { name: "Italian side without the glacier", picks: { s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, s7: 1 } }
  ],
  blocks: [
    stage("s1", "Stage 1: Zermatt to Cervinia over the Theodulpass", "Glacier crossing at 3,317 m; guide required", { distanceKm: 16, ascentM: 1700, descentM: 1300, hours: 8, maxAltitudeM: 3317, difficulty: "T4 (glacier)", hut: { name: "Hotel in Cervinia", bookAheadMonths: 3 }, transitHours: 8, dayHighC: 8, note: "Cable cars can shorten it. Or skip: take the Klein Matterhorn lift and walk down." }),
    stage("s2", "Stage 2: to Saint-Jacques (Val d'Ayas)", "Colle Superiore delle Cime Bianche", { distanceKm: 14, ascentM: 900, descentM: 1300, hours: 6, maxAltitudeM: 2982, difficulty: "T3", hut: { name: "Hotel in Saint-Jacques", bookAheadMonths: 2 }, crowd: "low", dayHighC: 14 }),
    stage("s3", "Stage 3: to Gressoney-la-Trinité", "Col Pinter or the Bettaforca", { distanceKm: 13, ascentM: 1100, descentM: 1200, hours: 6, maxAltitudeM: 2777, difficulty: "T3", hut: { name: "Hotel in Gressoney", bookAheadMonths: 2 }, crowd: "low", history: "Walser villages", dayHighC: 16 }),
    stage("s4", "Stage 4: to Alagna", "Col d'Olen, 2,881 m", { distanceKm: 12, ascentM: 1200, descentM: 1700, hours: 6, maxAltitudeM: 2881, difficulty: "T3", hut: { name: "Hotel in Alagna", bookAheadMonths: 2 }, crowd: "low", history: "Walser museum at Pedemonte", dayHighC: 17 }),
    stage("s5", "Stage 5: to Rima", "Colle Mud", { distanceKm: 10, ascentM: 1200, descentM: 1000, hours: 6, maxAltitudeM: 2324, difficulty: "T3", hut: { name: "Rifugio or B&B in Rima", bookAheadMonths: 2 }, crowd: "low", dayHighC: 18 }),
    stage("s6", "Stage 6: to Macugnaga", "Colle del Turlo, the Walser paved path", { distanceKm: 16, ascentM: 1400, descentM: 1500, hours: 8, maxAltitudeM: 2738, difficulty: "T3", hut: { name: "Hotel in Macugnaga", bookAheadMonths: 2 }, crowd: "low", history: "Turlo mule track, 1920s", dayHighC: 17 }),
    stage("s7", "Stage 7: to Saas-Almagell", "Monte Moro pass, 2,853 m, under the east face", { distanceKm: 14, ascentM: 1500, descentM: 1200, hours: 7, maxAltitudeM: 2853, difficulty: "T3", hut: { name: "Hotel in Saas-Almagell / Saas-Fee", bookAheadMonths: 2 }, dayHighC: 15 }),
    stage("s8", "Stage 8: to Grächen", "Balcony path above the Saastal", { distanceKm: 16, ascentM: 700, descentM: 900, hours: 6, maxAltitudeM: 2200, difficulty: "T2", hut: { name: "Hotel in Grächen", bookAheadMonths: 2 }, crowd: "low", dayHighC: 19 }),
    stage("s9", "Stage 9: Europaweg to Zermatt", "Europahütte, suspension bridge", { distanceKm: 20, ascentM: 900, descentM: 1100, hours: 8, maxAltitudeM: 2300, difficulty: "T3", hut: { name: "Europahütte, then Zermatt", bookAheadMonths: 4 }, dayHighC: 17 })
  ],
  season: { fitByMonth: [0, 0, 0, 0, 10, 55, 90, 90, 85, 30, 0, 0], events: [], notes: ["July to mid-September; the Theodul glacier needs a guide and crampons any month.", "The Italian side is far quieter and cheaper than the Swiss side.", "Walser culture: Gressoney and Alagna still speak Titsch."] },
  climate: { representative: "Passes at 2,700–2,900 m, villages at 1,600 m", dayHighC: [-3, -3, 0, 4, 9, 13, 16, 16, 12, 7, 1, -2], nightLowC: [-11, -11, -8, -4, 0, 4, 7, 7, 4, 0, -5, -9], rainDays: [7, 7, 8, 10, 13, 13, 11, 11, 9, 9, 8, 8], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [{ name: "MeteoSwiss", url: "https://www.meteoswiss.admin.ch/", type: "weather" }, { name: "Meteo Valle d'Aosta", url: "https://cf.regione.vda.it/", type: "weather" }, hutLink],
  guides: [{ name: "Cicerone: Tour of Monte Rosa", url: "https://www.cicerone.co.uk/" }]
});

/* ---------------- Ski touring ---------------- */
const avy = {
  fr: { name: "Météo-France avalanche bulletin (BRA)", url: "https://meteofrance.com/meteo-montagne", type: "avalanche" },
  ch: { name: "SLF avalanche bulletin (Switzerland)", url: "https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html", type: "avalanche" },
  euregio: { name: "Avalanche.report (Tyrol, South Tyrol, Trentino)", url: "https://avalanche.report/", type: "avalanche" },
  it: { name: "AINEVA bulletins (Italy)", url: "https://bollettini.aineva.it/", type: "avalanche" },
  no: { name: "Varsom (Norway)", url: "https://www.varsom.no/en/avalanche-bulletins/", type: "avalanche" },
  at: { name: "Lawinenwarndienst Tirol", url: "https://lawinen.report/", type: "avalanche" }
};
const wx = {
  meteoblue: { name: "meteoblue multimodel", url: "https://www.meteoblue.com/", type: "weather" },
  mf: { name: "Météo-France montagne", url: "https://meteofrance.com/meteo-montagne", type: "weather" },
  ch: { name: "MeteoSwiss", url: "https://www.meteoswiss.admin.ch/", type: "weather" },
  yr: { name: "yr.no", url: "https://www.yr.no/", type: "weather" }
};
const skiStage = (id, name, place, o) => stage(id, name, place, Object.assign({ crowd: "low" }, o));

D.push({
  id: "vanoise-ski", kind: "skitour", zone: "europe", name: "Vanoise: Pralognan huts", region: "Savoie, France", noFlights: true,
  tagline: "Gentle-to-moderate hut tours around the Grande Casse and the Dôme de Chasseforêt; a classic first week on skins.",
  tags: ["skitour", "huts", "glaciers-easy", "france"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 160, route: "Brussels→Paris→Moûtiers (TGV, 6 h), bus to Pralognan; or drive 9 h" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 190, route: "Eurostar→Paris→Moûtiers, bus to Pralognan" }],
  rates: { stage: 85, transit: 90, guide: 110 }, lodgingAssumption: "Refuge half board in winter rooms (gardien present at the main huts in spring); gîte in Pralognan",
  presets: [
    { name: "Classic 5-day loop", picks: { pralognan: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } },
    { name: "Long weekend", picks: { pralognan: 1, s1: 1, s2: 1, s5: 1 } }
  ],
  blocks: [
    city("pralognan", "Pralognan-la-Vanoise", "Base village at 1,420 m; gear check, bulletin, first short tour", { dayHighC: 4, maxAltitudeM: 1420, transitHours: 7, crowd: "med" }),
    skiStage("s1", "Day 1: to Refuge du Col de la Vanoise", "Up the Glière valley, 2,516 m", { ascentM: 1100, descentM: 0, hours: 4, maxAltitudeM: 2516, difficulty: "WS", hut: { name: "Refuge du Col de la Vanoise (CAF)", url: "https://refugecoldelavanoise.ffcam.fr/", bookAheadMonths: 2 }, dayHighC: -2 }),
    skiStage("s2", "Day 2: Pointe de la Réchasse, to Refuge de l'Arpont", "3,212 m summit, descent to the Arpont", { ascentM: 900, descentM: 1100, hours: 6, maxAltitudeM: 3212, difficulty: "ZS-", hut: { name: "Refuge de l'Arpont", bookAheadMonths: 2 }, dayHighC: -4 }),
    skiStage("s3", "Day 3: Dôme de Chasseforêt, to Refuge de la Dent Parrachée", "Glacier plateau to 3,586 m, long descent", { ascentM: 1300, descentM: 1200, hours: 7, maxAltitudeM: 3586, difficulty: "ZS", hut: { name: "Refuge de la Dent Parrachée", bookAheadMonths: 2 }, dayHighC: -6, note: "Glaciated but gentle; rope up in poor visibility." }),
    skiStage("s4", "Day 4: Col d'Aussois, to Refuge de Péclet-Polset", "Over to the Polset side", { ascentM: 1000, descentM: 900, hours: 6, maxAltitudeM: 2916, difficulty: "WS+", hut: { name: "Refuge de Péclet-Polset", bookAheadMonths: 2 }, dayHighC: -2 }),
    skiStage("s5", "Day 5: Col du Soufre and back to Pralognan", "Down the Chavière valley", { ascentM: 500, descentM: 1500, hours: 5, maxAltitudeM: 2817, difficulty: "WS", hut: { name: "Gîte in Pralognan", bookAheadMonths: 1 }, dayHighC: 2 })
  ],
  season: { fitByMonth: [50, 80, 95, 90, 40, 0, 0, 0, 0, 0, 0, 30], events: [{ name: "French school holidays (zone rotation)", from: "02-08", to: "03-09", effect: "crowds", note: "Huts and gîtes busier; roads slow on Saturdays" }], notes: ["March and early April: the huts are staffed and the snowpack has settled.", "Pralognan is one of the gentler Vanoise bases; the Grande Casse itself is a harder objective.", "Bulletin: Météo-France BRA Vanoise, published daily at 16:00."] },
  climate: { representative: "Huts at 2,500 m", dayHighC: [-5, -4, -1, 3, 8, 12, 15, 15, 11, 6, 0, -4], nightLowC: [-13, -13, -10, -6, -2, 2, 5, 5, 2, -2, -8, -12], rainDays: [8, 7, 8, 9, 12, 12, 11, 11, 9, 9, 8, 8], snowMonths: [1, 2, 3, 4, 5, 11, 12] },
  bulletins: [avy.fr, wx.mf, wx.meteoblue, { name: "FFCAM refuge booking", url: "https://www.ffcam.fr/", type: "huts" }],
  guides: [{ name: "Camptocamp Vanoise outings", url: "https://www.camptocamp.org/" }, { name: "Skitour.fr", url: "https://skitour.fr/" }]
});

D.push({
  id: "ecrins-ski", kind: "skitour", zone: "europe", name: "Écrins: Vallouise and the Glacier Blanc", region: "Hautes-Alpes, France", noFlights: true,
  tagline: "A serious week: Refuge des Écrins, the Barre's glaciers, Dôme de Neige 4,015 m for the strong, quieter valleys for everyone else.",
  tags: ["skitour", "huts", "glaciers", "france", "big-days"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 170, route: "Brussels→Paris→Grenoble or Briançon (train), bus to Vallouise / Ailefroide; or drive 10 h" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 200, route: "Eurostar→Paris→Briançon (night train), bus to Vallouise" }],
  rates: { stage: 85, transit: 90, guide: 120 }, lodgingAssumption: "Refuge winter rooms and staffed huts in spring; gîte in Vallouise",
  presets: [
    { name: "Glacier Blanc week", picks: { vallouise: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } },
    { name: "Gentler: Fournel and Freissinières", picks: { vallouise: 1, s6: 1, s7: 1, s8: 1 } }
  ],
  blocks: [
    city("vallouise", "Vallouise / Ailefroide", "Base at 1,160–1,500 m, bulletin and gear day", { dayHighC: 5, maxAltitudeM: 1500, transitHours: 8, crowd: "low" }),
    skiStage("s1", "Day 1: Pré de Madame Carle to Refuge du Glacier Blanc", "2,542 m", { ascentM: 700, descentM: 0, hours: 3, maxAltitudeM: 2542, difficulty: "WS", hut: { name: "Refuge du Glacier Blanc (CAF)", bookAheadMonths: 2 }, dayHighC: -1 }),
    skiStage("s2", "Day 2: to Refuge des Écrins", "Up the Glacier Blanc to 3,170 m", { ascentM: 650, descentM: 0, hours: 4, maxAltitudeM: 3170, difficulty: "WS+", hut: { name: "Refuge des Écrins (CAF)", bookAheadMonths: 2 }, dayHighC: -5 }),
    skiStage("s3", "Day 3: Dôme de Neige des Écrins", "4,015 m by the Glacier Blanc; crevassed, cold, early", { ascentM: 850, descentM: 850, hours: 7, maxAltitudeM: 4015, difficulty: "ZS+", hut: { name: "Refuge des Écrins", bookAheadMonths: 2 }, dayHighC: -10, note: "A 4,000 m summit on skis: guide, rope, crampons. The Roche Faurio (3,730 m) is the easier day from the same hut." }),
    skiStage("s4", "Day 4: Col des Écrins or Roche Faurio, down to Glacier Blanc hut", "", { ascentM: 500, descentM: 1100, hours: 5, maxAltitudeM: 3730, difficulty: "ZS", hut: { name: "Refuge du Glacier Blanc", bookAheadMonths: 2 }, dayHighC: -6 }),
    skiStage("s5", "Day 5: descent to Ailefroide, Pelvoux slopes", "", { ascentM: 300, descentM: 1300, hours: 4, maxAltitudeM: 2600, difficulty: "WS", hut: { name: "Gîte in Vallouise", bookAheadMonths: 1 }, dayHighC: 3 }),
    skiStage("s6", "Fournel valley: Refuge de Dormillouse", "Gentle valley tours, no glacier", { ascentM: 900, descentM: 900, hours: 5, maxAltitudeM: 2800, difficulty: "WS", hut: { name: "Refuge de Dormillouse / gîte", bookAheadMonths: 1 }, dayHighC: 1 }),
    skiStage("s7", "Freissinières: Tête de Vautisse", "3,156 m, open slopes", { ascentM: 1300, descentM: 1300, hours: 6, maxAltitudeM: 3156, difficulty: "WS+", hut: { name: "Gîte in Freissinières", bookAheadMonths: 1 }, dayHighC: -2 }),
    skiStage("s8", "Puy Saint-Vincent: Pointe de Clapouse", "Day tour from the road", { ascentM: 1100, descentM: 1100, hours: 5, maxAltitudeM: 2990, difficulty: "WS", hut: { name: "Gîte in Vallouise", bookAheadMonths: 1 }, dayHighC: 0 })
  ],
  season: { fitByMonth: [45, 75, 95, 90, 50, 0, 0, 0, 0, 0, 0, 25], events: [{ name: "French school holidays", from: "02-08", to: "03-09", effect: "crowds", note: "Huts busier at weekends" }], notes: ["Late March to early May for the glacier tours; the Écrins hut opens for the spring season in March.", "Cold north faces keep powder into April; south slopes go to spring snow by 10 am.", "Bulletin: Météo-France BRA Écrins and Pelvoux."] },
  climate: { representative: "Huts at 2,500–3,200 m", dayHighC: [-7, -6, -3, 1, 6, 10, 13, 13, 9, 4, -2, -6], nightLowC: [-15, -15, -12, -8, -3, 1, 4, 4, 1, -4, -10, -14], rainDays: [7, 6, 7, 8, 10, 10, 9, 9, 8, 8, 7, 7], snowMonths: [1, 2, 3, 4, 5, 6, 10, 11, 12] },
  bulletins: [avy.fr, wx.mf, wx.meteoblue, { name: "FFCAM refuge booking", url: "https://www.ffcam.fr/", type: "huts" }],
  guides: [{ name: "Camptocamp Écrins", url: "https://www.camptocamp.org/" }, { name: "Skitour.fr", url: "https://skitour.fr/" }]
});

D.push({
  id: "queyras-ski", kind: "skitour", zone: "europe", name: "Queyras hut-to-hut", region: "Hautes-Alpes, France / Italian border", noFlights: true,
  tagline: "The gentlest hut-to-hut on skis in the French Alps: sun, larch forests, 3,000 m summits without glaciers.",
  tags: ["skitour", "huts", "gentle", "france", "sunny"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 170, route: "Brussels→Paris→Montdauphin-Guillestre (night train), bus or taxi to Saint-Véran / Ceillac" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 200, route: "Eurostar→Paris→Montdauphin-Guillestre night train" }],
  rates: { stage: 80, transit: 85, guide: 100 }, lodgingAssumption: "Staffed refuges half board, gîtes in the villages",
  presets: [
    { name: "5-day traverse", picks: { ceillac: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } },
    { name: "Long weekend from Saint-Véran", picks: { s2: 1, s3: 1, s4: 1 } }
  ],
  blocks: [
    city("ceillac", "Ceillac", "Village base at 1,640 m", { dayHighC: 3, maxAltitudeM: 1640, transitHours: 10, crowd: "low" }),
    skiStage("s1", "Day 1: Ceillac to Refuge de Furfande", "Col de Bramousse", { ascentM: 1100, descentM: 500, hours: 5, maxAltitudeM: 2430, difficulty: "WS", hut: { name: "Refuge de Furfande", bookAheadMonths: 2 }, dayHighC: 0 }),
    skiStage("s2", "Day 2: to Saint-Véran", "Col de Furfande, the Aigue Blanche valley", { ascentM: 900, descentM: 1200, hours: 6, maxAltitudeM: 2500, difficulty: "WS", hut: { name: "Gîte in Saint-Véran (2,042 m)", bookAheadMonths: 2 }, history: "Highest commune in Europe, sundials", dayHighC: 1 }),
    skiStage("s3", "Day 3: to Refuge de la Blanche", "Pic de Caramantran 3,025 m optional", { ascentM: 1000, descentM: 500, hours: 5, maxAltitudeM: 3025, difficulty: "WS+", hut: { name: "Refuge de la Blanche", bookAheadMonths: 2 }, dayHighC: -3 }),
    skiStage("s4", "Day 4: to Refuge Agnel", "Col Vieux, Pain de Sucre 3,208 m for the keen", { ascentM: 900, descentM: 800, hours: 6, maxAltitudeM: 3208, difficulty: "ZS-", hut: { name: "Refuge Agnel", bookAheadMonths: 2 }, dayHighC: -4 }),
    skiStage("s5", "Day 5: Col Agnel or Pic de Foréant, down to Abriès", "", { ascentM: 600, descentM: 1500, hours: 5, maxAltitudeM: 3081, difficulty: "WS+", hut: { name: "Gîte in Abriès", bookAheadMonths: 1 }, dayHighC: 3 })
  ],
  season: { fitByMonth: [55, 85, 95, 85, 30, 0, 0, 0, 0, 0, 0, 40], events: [{ name: "French school holidays", from: "02-08", to: "03-09", effect: "crowds", note: "Busier huts" }], notes: ["February to early April; the Queyras is the sunniest and driest corner of the French Alps.", "No glaciers on the standard route: the week that suits a mixed group.", "Bulletin: Météo-France BRA Queyras."] },
  climate: { representative: "Huts at 2,400–2,600 m", dayHighC: [-3, -2, 1, 5, 10, 14, 17, 17, 13, 8, 2, -2], nightLowC: [-13, -13, -10, -6, -1, 3, 6, 6, 3, -2, -8, -12], rainDays: [5, 5, 6, 7, 9, 9, 8, 8, 7, 7, 6, 6], snowMonths: [1, 2, 3, 4, 11, 12] },
  bulletins: [avy.fr, wx.mf, wx.meteoblue],
  guides: [{ name: "Skitour.fr Queyras", url: "https://skitour.fr/" }]
});

D.push({
  id: "haute-route-ski", kind: "skitour", zone: "europe", name: "Haute Route on skis (Chamonix–Zermatt)", region: "France and Switzerland", noFlights: true,
  tagline: "The most famous ski tour in the world: six days of glaciers and 3,000 m cols from the Argentière hut to the Matterhorn.",
  tags: ["skitour", "huts", "glaciers", "classic", "big-days"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 230, route: "Brussels→Paris→Chamonix; home Zermatt→Visp→Basel" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 250, route: "Eurostar→Paris→Chamonix; home via Basel" }],
  rates: { stage: 110, transit: 120, guide: 150 }, lodgingAssumption: "Swiss cabanes half board; hotels in Chamonix and Zermatt",
  presets: [
    { name: "Classic 6 days", picks: { chamonix: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1, s6: 1, zermatt: 1 } }
  ],
  blocks: [
    city("chamonix", "Chamonix", "Gear check, guide briefing", { dayHighC: 6, maxAltitudeM: 1035, transitHours: 7, crowd: "high" }),
    skiStage("s1", "Day 1: Grands Montets to Refuge d'Argentière", "Across the Argentière glacier, 2,771 m", { ascentM: 300, descentM: 500, hours: 3, maxAltitudeM: 3275, difficulty: "WS", hut: { name: "Refuge d'Argentière", bookAheadMonths: 4 }, crowd: "high", dayHighC: -4 }),
    skiStage("s2", "Day 2: Col du Chardonnet, Fenêtre de Saleina, to Cabane du Trient", "3,323 m col with an abseil", { ascentM: 1000, descentM: 600, hours: 7, maxAltitudeM: 3323, difficulty: "ZS", hut: { name: "Cabane du Trient", bookAheadMonths: 4 }, crowd: "high", dayHighC: -7 }),
    skiStage("s3", "Day 3: Val d'Arpette to Champex, transfer to Verbier, up to Cabane du Mont Fort", "", { ascentM: 500, descentM: 1700, hours: 6, maxAltitudeM: 3170, difficulty: "ZS-", hut: { name: "Cabane du Mont Fort", bookAheadMonths: 4 }, dayHighC: -1 }),
    skiStage("s4", "Day 4: Rosablanche, to Cabane de Prafleuri", "3,336 m summit", { ascentM: 1200, descentM: 1000, hours: 7, maxAltitudeM: 3336, difficulty: "ZS", hut: { name: "Cabane de Prafleuri", bookAheadMonths: 4 }, dayHighC: -6 }),
    skiStage("s5", "Day 5: Lac des Dix, Pas du Chat, to Cabane des Vignettes", "Pigne d'Arolla 3,796 m", { ascentM: 1500, descentM: 1000, hours: 8, maxAltitudeM: 3796, difficulty: "ZS+", hut: { name: "Cabane des Vignettes", bookAheadMonths: 4 }, crowd: "high", dayHighC: -9 }),
    skiStage("s6", "Day 6: three cols to Zermatt", "Col de l'Évêque, Col du Mont Brulé, Col de Valpelline 3,568 m, down the Stockji glacier", { ascentM: 1200, descentM: 2500, hours: 9, maxAltitudeM: 3568, difficulty: "ZS+", hut: { name: "Hotel in Zermatt", bookAheadMonths: 3 }, dayHighC: -5, note: "The long day; start at 4 am." }),
    city("zermatt", "Zermatt", "Recovery day", { dayHighC: 5, maxAltitudeM: 1600, crowd: "high" })
  ],
  season: { fitByMonth: [10, 40, 90, 95, 50, 0, 0, 0, 0, 0, 0, 0], events: [{ name: "Patrouille des Glaciers", from: "04-15", to: "04-30", effect: "crowds", note: "Race week every two years; huts full" }], notes: ["Late March to early May, with April the classic month.", "Guided for almost everyone: glaciers, crevasse rescue, navigation in whiteout.", "Huts fill months ahead; guides block-book in autumn."] },
  climate: { representative: "Cabanes at 2,800–3,200 m", dayHighC: [-9, -9, -6, -2, 3, 7, 10, 10, 6, 1, -5, -8], nightLowC: [-18, -18, -15, -11, -6, -2, 1, 1, -2, -7, -13, -17], rainDays: [7, 7, 8, 9, 11, 11, 10, 10, 9, 9, 8, 8], snowMonths: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12] },
  bulletins: [avy.ch, avy.fr, wx.ch, wx.mf, { name: "SAC hut portal", url: "https://www.sac-cas.ch/en/huts-and-tours/", type: "huts" }],
  guides: [{ name: "Camptocamp Haute Route", url: "https://www.camptocamp.org/" }]
});

D.push({
  id: "silvretta-ski", kind: "skitour", zone: "europe", name: "Silvretta hut-to-hut", region: "Vorarlberg / Tyrol, Austria and Graubünden", noFlights: true,
  tagline: "The friendliest glacier range in the Alps: big staffed huts, moderate cols, Piz Buin for the strong.",
  tags: ["skitour", "huts", "glaciers-easy", "austria"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 200, route: "Brussels→Zürich→Landeck or Bludenz (train, 9 h), bus to Galtür / Partenen" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 240, route: "Eurostar→Paris→Zürich→Landeck" }],
  rates: { stage: 85, transit: 90, guide: 110 }, lodgingAssumption: "DAV/ÖAV huts half board, winter rooms early season",
  presets: [
    { name: "Classic 5-day round", picks: { galtur: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } }
  ],
  blocks: [
    city("galtur", "Galtür / Bielerhöhe", "Base, gear, bulletin", { dayHighC: 2, maxAltitudeM: 2032, transitHours: 9, crowd: "low" }),
    skiStage("s1", "Day 1: Bielerhöhe to Wiesbadener Hütte", "Along the reservoir, 2,443 m", { ascentM: 500, descentM: 0, hours: 3, maxAltitudeM: 2443, difficulty: "WS", hut: { name: "Wiesbadener Hütte (DAV)", bookAheadMonths: 3 }, dayHighC: -2 }),
    skiStage("s2", "Day 2: Piz Buin or Ochsenkopf, back to Wiesbadener", "3,312 m (Buin: short climbing section)", { ascentM: 950, descentM: 950, hours: 6, maxAltitudeM: 3312, difficulty: "ZS", hut: { name: "Wiesbadener Hütte", bookAheadMonths: 3 }, dayHighC: -6 }),
    skiStage("s3", "Day 3: Ochsenscharte, Dreiländerspitze, to Jamtalhütte", "3,197 m", { ascentM: 900, descentM: 1100, hours: 7, maxAltitudeM: 3197, difficulty: "ZS-", hut: { name: "Jamtalhütte (DAV)", bookAheadMonths: 3 }, dayHighC: -5 }),
    skiStage("s4", "Day 4: Breite Krone, to Heidelberger Hütte", "3,079 m, into Switzerland and back", { ascentM: 1000, descentM: 900, hours: 6, maxAltitudeM: 3079, difficulty: "WS+", hut: { name: "Heidelberger Hütte (DAV)", bookAheadMonths: 3 }, dayHighC: -4 }),
    skiStage("s5", "Day 5: Fimbertal down to Ischgl, bus to Galtür", "", { ascentM: 300, descentM: 1000, hours: 3, maxAltitudeM: 2600, difficulty: "WS", hut: { name: "Hotel in Galtür or Ischgl", bookAheadMonths: 1 }, dayHighC: 1 })
  ],
  season: { fitByMonth: [40, 75, 95, 90, 40, 0, 0, 0, 0, 0, 0, 20], events: [{ name: "Easter week", from: "03-28", to: "04-06", effect: "crowds", note: "Huts full; dates shift each year" }], notes: ["March and April; huts staffed from late February.", "Moderate glaciers: a good first glacier week with a guide, or self-led for experienced parties.", "Bulletins: Lawinenwarndienst Tirol and Vorarlberg, SLF for the Swiss side."] },
  climate: { representative: "Huts at 2,200–2,450 m", dayHighC: [-5, -4, -1, 3, 8, 12, 14, 14, 10, 5, -1, -4], nightLowC: [-14, -14, -11, -7, -2, 2, 4, 4, 1, -3, -9, -13], rainDays: [8, 7, 9, 10, 13, 14, 14, 13, 10, 9, 9, 9], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [avy.at, avy.ch, wx.meteoblue, hutLink],
  guides: [{ name: "Alpenvereinaktiv", url: "https://www.alpenvereinaktiv.com/" }]
});

D.push({
  id: "ortler-ski", kind: "skitour", zone: "europe", name: "Ortler group: Sulden and Cevedale", region: "South Tyrol / Lombardy, Italy", noFlights: true,
  tagline: "Spring classic: the Casati hut at 3,254 m, Monte Cevedale 3,769 m, long glacier descents, Italian hut food.",
  tags: ["skitour", "huts", "glaciers", "italy", "spring"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 220, route: "Brussels→Munich→Innsbruck→Landeck or Meran, bus to Sulden (train 11 h); or drive 10 h" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 260, route: "Eurostar→Paris→Munich→Innsbruck→Meran→Sulden" }],
  rates: { stage: 90, transit: 95, guide: 120 }, lodgingAssumption: "Rifugi half board, hotel in Sulden",
  presets: [
    { name: "Cevedale 4 days", picks: { sulden: 1, s1: 1, s2: 1, s3: 1, s4: 1 } }
  ],
  blocks: [
    city("sulden", "Sulden / Solda", "Base at 1,900 m under the Ortler", { dayHighC: 3, maxAltitudeM: 1900, transitHours: 11, crowd: "low" }),
    skiStage("s1", "Day 1: Sulden to Rifugio Casati", "Lifts to the Schaubachhütte, skin to 3,254 m", { ascentM: 700, descentM: 0, hours: 4, maxAltitudeM: 3254, difficulty: "WS+", hut: { name: "Rifugio Casati", bookAheadMonths: 3 }, dayHighC: -6 }),
    skiStage("s2", "Day 2: Monte Cevedale, to Rifugio Pizzini", "3,769 m, down the Forni side", { ascentM: 600, descentM: 1100, hours: 6, maxAltitudeM: 3769, difficulty: "ZS", hut: { name: "Rifugio Pizzini", bookAheadMonths: 3 }, dayHighC: -8 }),
    skiStage("s3", "Day 3: Monte Pasquale or Palon de la Mare, to Rifugio Branca", "", { ascentM: 1000, descentM: 1200, hours: 7, maxAltitudeM: 3553, difficulty: "ZS", hut: { name: "Rifugio Branca", bookAheadMonths: 3 }, dayHighC: -6 }),
    skiStage("s4", "Day 4: San Matteo or down to Santa Caterina", "3,678 m optional, then the valley", { ascentM: 900, descentM: 1800, hours: 7, maxAltitudeM: 3678, difficulty: "ZS", hut: { name: "Hotel in Santa Caterina or Bormio", bookAheadMonths: 2 }, dayHighC: 2 })
  ],
  season: { fitByMonth: [10, 40, 85, 95, 70, 0, 0, 0, 0, 0, 0, 0], events: [], notes: ["April into May: high huts, firn descents, long days.", "Everything is above 3,000 m: acclimatise a night in Sulden, and watch the sun.", "Bulletins: Avalanche.report (South Tyrol) and AINEVA Lombardia."] },
  climate: { representative: "Huts at 2,500–3,250 m", dayHighC: [-8, -8, -5, -1, 4, 8, 11, 11, 7, 2, -4, -7], nightLowC: [-17, -17, -14, -10, -5, -1, 2, 2, -1, -6, -12, -16], rainDays: [5, 5, 7, 8, 11, 12, 12, 11, 8, 7, 7, 6], snowMonths: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12] },
  bulletins: [avy.euregio, avy.it, wx.meteoblue, hutLink],
  guides: [{ name: "Alpenvereinaktiv Ortler", url: "https://www.alpenvereinaktiv.com/" }]
});

D.push({
  id: "dolomites-ski", kind: "skitour", zone: "europe", name: "Dolomites: Sella and Marmolada on skins", region: "South Tyrol / Trentino, Italy", noFlights: true,
  tagline: "Moderate tours between the Sella towers with lift help, Rifugio Boè at 2,871 m, Piz Boè and the Marmolada's glacier.",
  tags: ["skitour", "huts", "moderate", "italy", "lifts"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 220, route: "Brussels→Munich→Innsbruck→Brixen, bus to Corvara or Canazei" },
           { originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 260, route: "Eurostar→Paris→Munich→Innsbruck→Brixen" }],
  rates: { stage: 95, transit: 100, guide: 110 }, lodgingAssumption: "Rifugi and valley hotels; some nights in the valley by choice",
  presets: [
    { name: "4 days around the Sella", picks: { corvara: 1, s1: 1, s2: 1, s3: 1, s4: 1 } }
  ],
  blocks: [
    city("corvara", "Corvara / Canazei", "Valley base, lifts to the plateaus", { dayHighC: 3, maxAltitudeM: 1570, transitHours: 10, crowd: "high" }),
    skiStage("s1", "Day 1: Val Mezdì and Rifugio Boè", "Up from Passo Pordoi by lift, skin to the Boè", { ascentM: 500, descentM: 700, hours: 4, maxAltitudeM: 2871, difficulty: "WS+", hut: { name: "Rifugio Boè (winter room / staffed in spring)", bookAheadMonths: 2 }, crowd: "med", dayHighC: -3 }),
    skiStage("s2", "Day 2: Piz Boè and the Val Lasties descent", "3,152 m", { ascentM: 600, descentM: 1500, hours: 6, maxAltitudeM: 3152, difficulty: "ZS-", hut: { name: "Hotel in Canazei", bookAheadMonths: 2 }, dayHighC: -4 }),
    skiStage("s3", "Day 3: Marmolada, Punta Penia by the glacier", "3,343 m with the final fixed rope", { ascentM: 1100, descentM: 1300, hours: 7, maxAltitudeM: 3343, difficulty: "ZS", hut: { name: "Rifugio Castiglioni / Fedaia", bookAheadMonths: 2 }, dayHighC: -6 }),
    skiStage("s4", "Day 4: Forcella Pordoi and Val Setus", "Classic Sella couloirs", { ascentM: 700, descentM: 1200, hours: 5, maxAltitudeM: 2829, difficulty: "ZS", hut: { name: "Hotel in Corvara", bookAheadMonths: 1 }, crowd: "med", dayHighC: -1 })
  ],
  season: { fitByMonth: [45, 80, 95, 85, 30, 0, 0, 0, 0, 0, 0, 30], events: [{ name: "Sellaronda Skimarathon", from: "03-15", to: "03-25", effect: "crowds", note: "One evening of racers; otherwise quiet" }], notes: ["February to April; the lifts make short days possible for a mixed group.", "Couloirs need settled snow: read the bulletin for the Sella sector.", "Bulletin: Avalanche.report, Dolomiti sector."] },
  climate: { representative: "Plateaus at 2,500–2,900 m", dayHighC: [-5, -5, -2, 2, 7, 11, 14, 14, 10, 5, -1, -4], nightLowC: [-13, -13, -10, -6, -1, 3, 6, 6, 3, -1, -7, -11], rainDays: [6, 6, 8, 10, 13, 14, 13, 13, 10, 9, 8, 7], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [avy.euregio, wx.meteoblue, hutLink],
  guides: [{ name: "Alpenvereinaktiv Dolomiten", url: "https://www.alpenvereinaktiv.com/" }]
});

D.push({
  id: "lyngen-ski", kind: "skitour", zone: "europe", name: "Lyngen Alps: sea to summit", region: "Troms, Arctic Norway", noFlights: false,
  tagline: "Day tours from a lodge or a boat: skin from the fjord, ski back to the water, midnight light by late April.",
  tags: ["skitour", "lodge", "arctic", "fjords", "no-huts"],
  access: [{ originRegion: "europe-west", originCity: "Brussels", mode: "flight", costPerPerson: 380, route: "Brussels→Oslo→Tromsø (SAS, Norwegian), hire car or transfer 2 h to Lyngseidet" },
           { originRegion: "uk", originCity: "London", mode: "flight", costPerPerson: 320, route: "London→Tromsø direct (Norwegian, seasonal) or via Oslo" }],
  rates: { stage: 150, transit: 150, guide: 120 }, lodgingAssumption: "Self-catering lodge or guesthouse shared by the group; no huts in Lyngen",
  presets: [
    { name: "Lodge week, 5 tours", picks: { lyngseidet: 1, s1: 1, s2: 1, s3: 1, s4: 1, s5: 1 } }
  ],
  blocks: [
    city("lyngseidet", "Lyngseidet / Koppangen lodge", "Base on the fjord, bulletin, gear", { dayHighC: 2, maxAltitudeM: 50, transitHours: 7, crowd: "low" }),
    skiStage("s1", "Rørnestinden", "1,041 m straight from the road", { ascentM: 1040, descentM: 1040, hours: 5, maxAltitudeM: 1041, difficulty: "WS", hut: { name: "Lodge", bookAheadMonths: 4 }, dayHighC: -1 }),
    skiStage("s2", "Storgalten", "1,219 m, the classic", { ascentM: 1220, descentM: 1220, hours: 6, maxAltitudeM: 1219, difficulty: "WS+", hut: { name: "Lodge", bookAheadMonths: 4 }, dayHighC: -2 }),
    skiStage("s3", "Kavringtinden", "1,289 m, long open slopes", { ascentM: 1290, descentM: 1290, hours: 6, maxAltitudeM: 1289, difficulty: "ZS-", hut: { name: "Lodge", bookAheadMonths: 4 }, dayHighC: -2 }),
    skiStage("s4", "Tafeltinden or Daltinden", "Bigger days on the east side", { ascentM: 1400, descentM: 1400, hours: 7, maxAltitudeM: 1395, difficulty: "ZS", hut: { name: "Lodge", bookAheadMonths: 4 }, dayHighC: -3 }),
    skiStage("s5", "Rest or boat day: Uløya from the ferry", "", { ascentM: 1000, descentM: 1000, hours: 5, maxAltitudeM: 1114, difficulty: "WS", hut: { name: "Lodge", bookAheadMonths: 4 }, dayHighC: 0 })
  ],
  season: { fitByMonth: [10, 40, 85, 95, 80, 0, 0, 0, 0, 0, 0, 5], events: [{ name: "Easter week", from: "03-28", to: "04-06", effect: "crowds", note: "Norwegians go to the mountains; lodges full" }], notes: ["March for light-and-powder, April and early May for long days and spring snow to the sea.", "No huts: everything from a lodge, so cooking and a hire car are part of the plan.", "Bulletin: Varsom.no, Lyngen region, published daily."] },
  climate: { representative: "Sea level to 1,300 m", dayHighC: [-3, -3, -1, 3, 8, 13, 16, 15, 10, 4, 0, -2], nightLowC: [-9, -9, -7, -3, 1, 6, 9, 8, 4, 0, -5, -8], rainDays: [14, 12, 12, 10, 9, 10, 12, 13, 15, 16, 14, 14], snowMonths: [1, 2, 3, 4, 5, 10, 11, 12] },
  bulletins: [avy.no, wx.yr, wx.meteoblue],
  guides: [{ name: "Lyngen Lodge / local guides", url: "https://www.visitlyngenfjord.com/" }]
});

/* ---------------- Short train trips (one week, winter-friendly) ---------------- */
const shortRates = { city: 110, hike: 95, transit: 100 };
D.push({
  id: "lake-district", kind: "explore", zone: "europe", name: "Lake District + Settle–Carlisle", region: "Cumbria and the Yorkshire Dales, England", noFlights: true,
  tagline: "A winter week of fells, lakes and pubs by train: Windermere, Keswick, the Settle–Carlisle line, Hadrian's Wall if you like.",
  tags: ["mountains", "walking", "villages", "winter-ok", "short"],
  access: [{ originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 90, route: "Euston→Oxenholme→Windermere (3 h) or Penrith for Keswick" },
           { originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 220, route: "Eurostar→London, then Euston→Oxenholme" }],
  rates: shortRates, lodgingAssumption: "B&B or a cottage for the week; pub food",
  presets: [
    { name: "Keswick week", picks: { keswick: 3, catbells: 1, borrowdale: 2, ullswater: 1 } },
    { name: "Dales and Lakes by rail", picks: { settle: 1, dales: 2, keswick: 2, catbells: 1, ullswater: 1 } }
  ],
  blocks: [
    city("keswick", "Keswick", "Market town on Derwentwater; Theatre by the Lake, Pencil Museum, Castlerigg stone circle", { history: "Castlerigg, Lakeland mining", dayHighC: 7, crowd: "med", transitHours: 4 }),
    city("settle", "Settle and the Settle–Carlisle line", "England's finest railway, Ribblehead viaduct", { history: "Victorian railway engineering", dayHighC: 6, crowd: "low", transitHours: 3 }),
    { id: "catbells", type: "hike", name: "Catbells and the Derwentwater shore", place: "Short fell, 451 m, launch back across the lake", defaultDays: 1, minDays: 1, maxDays: 1, maxAltitudeM: 451, dayHighC: 5, crowd: "med", transitHours: 0.5, history: null, guidebookPick: true, see: ["Catbells ridge from Hawse End", "Launch from Hawse End back to Keswick", "Lingholm for tea"] },
    { id: "borrowdale", type: "hike", name: "Borrowdale and the higher fells", place: "Castle Crag, or Scafell Pike / Great Gable in good weather with winter kit", defaultDays: 2, minDays: 1, maxDays: 3, maxAltitudeM: 978, dayHighC: 3, crowd: "med", transitHours: 0.5, history: null, guidebookPick: true, see: ["Castle Crag and the Bowder Stone (short)", "Great Gable from Seathwaite (long, winter kit)", "Honister slate mine"], note: "Winter: check the Lake District fell-top conditions report; ice axe and crampons for the tops." },
    { id: "ullswater", type: "hike", name: "Ullswater Way and the steamer", place: "Howtown to Glenridding, 11 km, boat one way", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 400, dayHighC: 6, crowd: "low", transitHours: 1, history: "Wordsworth's daffodils", guidebookPick: true, see: ["Steamer from Glenridding to Howtown", "Walk back along the lakeshore", "Aira Force waterfall"] },
    { id: "dales", type: "hike", name: "Yorkshire Dales from the railway", place: "Ribblehead, Dent, Ingleborough", defaultDays: 2, minDays: 1, maxDays: 3, maxAltitudeM: 724, dayHighC: 5, crowd: "low", transitHours: 0.5, history: "Dry-stone walls and lead mining", guidebookPick: true, see: ["Ribblehead viaduct walk", "Ingleborough from Clapham (caves on the way)", "Dent village and its pubs"] }
  ],
  season: { fitByMonth: [60, 60, 70, 80, 85, 80, 70, 70, 85, 80, 65, 60], events: [{ name: "Christmas and New Year", from: "12-20", to: "01-03", effect: "crowds", note: "Cottages booked out" }], notes: ["Rain is the constant; January brings short days (sunset 16:30), empty paths and snow on the tops.", "Winter fell walking needs an ice axe and crampons above 600 m some weeks; the Fell Top Assessors post daily reports.", "Trains: book Advance tickets 8–12 weeks out for the cheap fares."] },
  climate: { representative: "Keswick (90 m); tops 600–900 m colder and windier", dayHighC: [7, 7, 9, 12, 15, 18, 19, 19, 16, 13, 9, 7], nightLowC: [1, 1, 2, 3, 6, 9, 11, 11, 9, 6, 3, 1], rainDays: [19, 15, 17, 14, 13, 14, 15, 16, 16, 19, 19, 20], snowMonths: [1, 2, 3, 12] },
  bulletins: [{ name: "Lake District Weatherline (fell top conditions)", url: "https://www.lakedistrictweatherline.co.uk/", type: "conditions" }, { name: "Met Office mountain forecast", url: "https://www.metoffice.gov.uk/weather/specialist-forecasts/mountain", type: "weather" }],
  guides: [{ name: "Lonely Planet Lake District", url: "https://www.lonelyplanet.com/england/the-lake-district" }, { name: "Routard Angleterre", url: "https://www.routard.com/guide/code_dest/angleterre.htm" }]
});

D.push({
  id: "snowdonia", kind: "explore", zone: "europe", name: "Eryri (Snowdonia) + the Llŷn by train", region: "North Wales", noFlights: true,
  tagline: "Castles, slate and the highest ground south of Scotland, reached by the Conwy Valley line and the Ffestiniog steam railway.",
  tags: ["mountains", "castles", "coast", "winter-ok", "short"],
  access: [{ originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 95, route: "Euston→Llandudno Junction (3 h), Conwy Valley line to Betws-y-Coed / Blaenau" },
           { originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 230, route: "Eurostar→London→Llandudno Junction" }],
  rates: shortRates, lodgingAssumption: "B&B or hostel; Betws-y-Coed or Llanberis as base",
  presets: [
    { name: "Betws-y-Coed week", picks: { conwy: 1, betws: 2, snowdon: 1, moelwyn: 1, ffestiniog: 1, caernarfon: 1 } }
  ],
  blocks: [
    city("conwy", "Conwy", "Walled town and Edward I's castle", { history: "Edwardian castles of Wales (UNESCO)", dayHighC: 8, crowd: "med", transitHours: 3.5 }),
    city("betws", "Betws-y-Coed", "Forest village base, Swallow Falls, Tŷ Hyll", { dayHighC: 7, crowd: "med", transitHours: 0.5 }),
    city("caernarfon", "Caernarfon", "The grandest of the castles, Welsh-speaking town", { history: "Investiture castle, Roman Segontium", dayHighC: 8, crowd: "low", transitHours: 1 }),
    { id: "snowdon", type: "hike", name: "Yr Wyddfa (Snowdon) in winter", place: "Llanberis path or Pyg track, 1,085 m; or the Glyderau", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 1085, dayHighC: 1, crowd: "med", transitHours: 0.5, history: null, guidebookPick: true, see: ["Llanberis path (safest in winter)", "Glyder Fach and Tryfan for a scramble in good conditions", "Pen-y-Gwryd hotel, where Everest 1953 trained"], note: "Winter kit above the snowline; the railway does not run in winter." },
    { id: "moelwyn", type: "hike", name: "Moelwynion and Cwm Idwal", place: "Quieter hills, slate ruins, the Devil's Kitchen", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 770, dayHighC: 3, crowd: "low", transitHours: 0.5, history: "Slate quarrying", guidebookPick: true, see: ["Cwm Idwal nature reserve loop", "Moelwyn Mawr from Croesor", "Cwmorthin quarry ruins"] },
    { id: "ffestiniog", type: "hike", name: "Ffestiniog railway and Blaenau slate", place: "Steam railway to Porthmadog, Llechwedd caverns", defaultDays: 1, minDays: 1, maxDays: 1, maxAltitudeM: 300, dayHighC: 6, crowd: "low", transitHours: 0.5, history: "Slate landscape of north-west Wales (UNESCO)", guidebookPick: true, see: ["Llechwedd deep mine tour", "Steam train down to Porthmadog", "Portmeirion from Minffordd"] }
  ],
  season: { fitByMonth: [55, 55, 65, 80, 85, 80, 70, 70, 85, 80, 60, 55], events: [], notes: ["Wet and windy in winter; the castles and railways fill the bad days.", "Short days; plan hill days for the clear forecast.", "Welsh is the first language in Caernarfon and Blaenau."] },
  climate: { representative: "Betws-y-Coed (60 m); tops 700–1,000 m", dayHighC: [7, 7, 9, 12, 15, 18, 19, 19, 17, 13, 10, 8], nightLowC: [1, 1, 2, 3, 6, 9, 11, 11, 9, 6, 3, 2], rainDays: [18, 14, 16, 13, 12, 12, 14, 15, 15, 18, 19, 19], snowMonths: [1, 2, 3, 12] },
  bulletins: [{ name: "Met Office mountain forecast (Snowdonia)", url: "https://www.metoffice.gov.uk/weather/specialist-forecasts/mountain", type: "weather" }],
  guides: [{ name: "Lonely Planet Wales", url: "https://www.lonelyplanet.com/wales" }, { name: "Routard Pays de Galles", url: "https://www.routard.com/guide/code_dest/pays_de_galles.htm" }]
});

D.push({
  id: "alsace-black-forest", kind: "explore", zone: "europe", name: "Alsace + the Black Forest by train", region: "Strasbourg, Colmar, Freiburg, Vosges", noFlights: true,
  tagline: "Two wine regions either side of the Rhine, half-timbered towns, winter walking in the Vosges and the Schwarzwald, four hours from London.",
  tags: ["cities", "food", "wine", "forest", "winter-ok", "short"],
  access: [{ originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 150, route: "Eurostar→Paris, TGV→Strasbourg (1 h 45); total 5 h" },
           { originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 110, route: "Brussels→Strasbourg direct TGV (3 h 30)" }],
  rates: { city: 120, hike: 100, transit: 100 }, lodgingAssumption: "Small hotels and winstubs; a Black Forest guesthouse",
  presets: [
    { name: "Strasbourg, Colmar, Freiburg", picks: { strasbourg: 2, colmar: 2, vosges: 1, freiburg: 2, schwarzwald: 1 } }
  ],
  blocks: [
    city("strasbourg", "Strasbourg", "Cathedral, Petite France, Musée Alsacien, European quarter", { history: "Imperial free city, Franco-German border", dayHighC: 5, crowd: "med", transitHours: 5 }),
    city("colmar", "Colmar + the wine route", "Unterlinden (Isenheim altarpiece), Riquewihr, Kaysersberg", { history: "Grünewald's Isenheim altarpiece", dayHighC: 5, crowd: "med", transitHours: 0.5 }),
    city("freiburg", "Freiburg im Breisgau", "Minster, Bächle, the market, the Schauinsland cable car", { history: "Habsburg university town", dayHighC: 6, crowd: "med", transitHours: 1.5 }),
    { id: "vosges", type: "hike", name: "Vosges crests: Hohneck and the Grand Ballon", place: "Snowshoe or walk on the Route des Crêtes, 1,360–1,424 m", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 1424, dayHighC: -1, crowd: "low", transitHours: 1, history: "1914–18 front at the Hartmannswillerkopf", guidebookPick: true, see: ["Hohneck from the Col de la Schlucht", "Hartmannswillerkopf memorial", "Ferme-auberge lunch"] },
    { id: "schwarzwald", type: "hike", name: "Black Forest: Feldberg and the Höllental", place: "Feldberg 1,493 m, Titisee, Ravenna gorge", defaultDays: 1, minDays: 1, maxDays: 3, maxAltitudeM: 1493, dayHighC: -1, crowd: "med", transitHours: 1, history: null, guidebookPick: true, see: ["Feldberg summit loop (snowshoes in January)", "Ravenna gorge and its viaduct", "Titisee and Schluchsee by train"] }
  ],
  season: { fitByMonth: [70, 65, 70, 80, 85, 85, 80, 80, 90, 90, 70, 80], events: [{ name: "Christmas markets", from: "11-25", to: "12-24", effect: "crowds", note: "Strasbourg and Colmar at their busiest and prettiest" }], notes: ["January: cold, often grey in the plain, snow on the Vosges and Feldberg; museums and winstubs for the rest.", "Trains every hour between all four stops; no car needed.", "Grey days are common in the Rhine plain in winter; the hills are often above the cloud."] },
  climate: { representative: "Strasbourg (140 m); Vosges crest 1,300 m about 8°C colder", dayHighC: [5, 7, 12, 16, 20, 24, 26, 26, 21, 15, 9, 5], nightLowC: [-1, 0, 3, 6, 10, 13, 15, 15, 11, 7, 3, 0], rainDays: [10, 9, 10, 10, 12, 11, 11, 10, 9, 10, 11, 11], snowMonths: [1, 2, 12] },
  bulletins: [{ name: "Météo-France Vosges", url: "https://meteofrance.com/meteo-montagne", type: "weather" }],
  guides: [{ name: "Routard Alsace", url: "https://www.routard.com/guide/code_dest/alsace.htm" }, { name: "Lonely Planet Alsace", url: "https://www.lonelyplanet.com/france/alsace" }]
});

D.push({
  id: "bernese-winter", kind: "explore", zone: "europe", name: "Bernese Oberland in winter, by train", region: "Interlaken, Lauterbrunnen, Wengen, Mürren", noFlights: true,
  tagline: "Car-free villages under the Eiger, winter walking and sledging trails, the Jungfrau railway, all by train from London in a day.",
  tags: ["mountains", "villages", "winter", "trains", "short"],
  access: [{ originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 220, route: "Eurostar→Paris, TGV Lyria→Basel, →Interlaken Ost (total 8 h)" },
           { originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 180, route: "Brussels→Basel→Interlaken (6 h)" }],
  rates: { city: 160, hike: 150, transit: 140 }, lodgingAssumption: "Apartment in Wengen or Mürren for the week; cook most evenings",
  presets: [
    { name: "Wengen week", picks: { interlaken: 1, wengen: 2, mannlichen: 1, murren: 2, grindelwald: 1 } }
  ],
  blocks: [
    city("interlaken", "Interlaken + Thun", "Lakes, Thun castle, arrival", { history: "Thun castle, Bernese patricians", dayHighC: 4, crowd: "med", transitHours: 8 }),
    city("wengen", "Wengen (car-free, 1,274 m)", "Base; winter walking paths, sledging to Lauterbrunnen", { dayHighC: 2, crowd: "med", transitHours: 0.5, maxAltitudeM: 1274 }),
    city("murren", "Mürren (car-free, 1,650 m)", "Across the valley, Schilthorn, the Allmendhubel loop", { dayHighC: 0, crowd: "low", transitHours: 1, maxAltitudeM: 2970 }),
    { id: "mannlichen", type: "hike", name: "Männlichen to Kleine Scheidegg panorama trail", "place": "Groomed winter path at 2,100 m under the Eiger", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 2230, dayHighC: -3, crowd: "high", transitHours: 0.5, history: null, guidebookPick: true, see: ["Royal Walk to the Männlichen summit", "Panorama trail to Kleine Scheidegg (1.5 h, easy)", "Sledge run down to Wengen"] },
    { id: "grindelwald", type: "hike", name: "Grindelwald: First and the Bachalpsee, Jungfraujoch", place: "Winter walk to Bachalpsee; the Jungfrau railway to 3,454 m (optional, expensive)", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 3454, dayHighC: -8, crowd: "high", transitHours: 0.5, history: "Jungfrau railway, 1912", guidebookPick: true, see: ["First to Bachalpsee winter trail", "Jungfraujoch only on a clear day (CHF 200+)", "Grindelwald–Pfingstegg sledge run"], note: "3,454 m is a lift, not a walk: fine for a day if nobody has an altitude limit below it." }
  ],
  season: { fitByMonth: [85, 90, 80, 50, 60, 85, 90, 90, 90, 75, 40, 80], events: [{ name: "Lauberhorn ski races, Wengen", from: "01-14", to: "01-19", effect: "crowds", note: "Village full; dates vary each January" }], notes: ["January: cold and often clear above the fog line (Wengen and Mürren sit above it), snow guaranteed.", "Winter walking paths are groomed and signed; no skis needed. Half-fare card pays for itself in two days.", "Swiss prices: self-catering keeps a week under budget."] },
  climate: { representative: "Wengen (1,274 m); trails 1,800–2,200 m about 5°C colder", dayHighC: [1, 2, 5, 9, 13, 17, 19, 19, 15, 11, 5, 2], nightLowC: [-6, -6, -4, -1, 3, 6, 9, 9, 6, 2, -2, -5], rainDays: [8, 7, 9, 10, 13, 14, 13, 13, 10, 9, 9, 9], snowMonths: [1, 2, 3, 4, 11, 12] },
  bulletins: [{ name: "MeteoSwiss", url: "https://www.meteoswiss.admin.ch/", type: "weather" }, { name: "SLF avalanche bulletin (for off-path plans)", url: "https://www.slf.ch/en/avalanche-bulletin-and-snow-situation.html", type: "avalanche" }],
  guides: [{ name: "Lonely Planet Bernese Oberland", url: "https://www.lonelyplanet.com/switzerland/bernese-oberland" }, { name: "Routard Suisse", url: "https://www.routard.com/guide/code_dest/suisse.htm" }]
});

D.push({
  id: "scottish-winter", kind: "explore", zone: "europe", name: "Highlands in winter by sleeper", region: "Fort William, Glencoe, Skye in the quiet season", noFlights: true,
  tagline: "The Caledonian Sleeper north, snow on the Ben, empty Skye, whisky and open fires; the Highlands at their most dramatic.",
  tags: ["mountains", "islands", "winter", "trains", "short"],
  access: [{ originRegion: "uk", originCity: "London", mode: "train", costPerPerson: 160, route: "Caledonian Sleeper Euston→Fort William (overnight, 12 h)" },
           { originRegion: "europe-west", originCity: "Brussels", mode: "train", costPerPerson: 280, route: "Eurostar→London, Caledonian Sleeper→Fort William" }],
  rates: { city: 110, hike: 95, transit: 110 }, lodgingAssumption: "B&B and one hostel night; hire car for Skye",
  presets: [
    { name: "Fort William and Glencoe", picks: { fortwilliam: 2, glencoe: 2, nevisrange: 1, ardnamurchan: 1 } },
    { name: "Add Skye", picks: { fortwilliam: 1, glencoe: 2, skyewinter: 3 } }
  ],
  blocks: [
    city("fortwilliam", "Fort William", "West Highland Museum, Glenfinnan by train, Neptune's Staircase", { history: "Jacobite rising, Glenfinnan", dayHighC: 6, crowd: "low", transitHours: 12 }),
    { id: "glencoe", type: "hike", name: "Glencoe low-level walks", place: "Lost Valley, Glencoe Lochan, the Devil's Staircase in good weather", defaultDays: 2, minDays: 1, maxDays: 3, maxAltitudeM: 550, dayHighC: 4, crowd: "low", transitHours: 0.5, history: "1692 massacre", guidebookPick: true, see: ["Lost Valley (Coire Gabhail), 3 h", "Glencoe visitor centre and the Clachaig", "Devil's Staircase to the top only in settled weather"], note: "Winter conditions change fast; the Munros need winter skills." },
    { id: "nevisrange", type: "hike", name: "Nevis Range and Glen Nevis", place: "Gondola to 650 m, Steall falls walk", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 1345, dayHighC: 2, crowd: "med", transitHours: 0.5, history: null, guidebookPick: true, see: ["Steall falls through the Nevis gorge", "Nevis Range gondola for the view and a short ridge walk", "Ben Nevis only with winter kit and a guide"] },
    { id: "ardnamurchan", type: "hike", name: "Ardnamurchan and the Corran ferry", place: "Empty peninsula, Sanna beach, the lighthouse", defaultDays: 1, minDays: 1, maxDays: 2, maxAltitudeM: 200, dayHighC: 6, crowd: "low", transitHours: 2, history: null, guidebookPick: false, see: ["Sanna bay dunes", "Ardnamurchan Point lighthouse", "Otters at Kilchoan"] },
    { id: "skyewinter", type: "hike", name: "Skye in the quiet season", place: "Quiraing, Storr, Fairy Pools with nobody there", defaultDays: 3, minDays: 2, maxDays: 4, maxAltitudeM: 700, dayHighC: 5, crowd: "low", transitHours: 3, history: "Clan MacLeod, Dunvegan", guidebookPick: true, see: ["Quiraing loop in low sun", "Old Man of Storr", "Talisker distillery and Elgol in a storm"], note: "Short daylight (16:00 sunset in January); plan one walk a day." }
  ],
  season: { fitByMonth: [55, 60, 70, 80, 90, 85, 70, 65, 85, 75, 55, 50], events: [{ name: "Hogmanay", from: "12-30", to: "01-02", effect: "crowds", note: "Everything booked" }], notes: ["January and February: gales and snow, but also the emptiest Highlands and the best light.", "The sleeper is the trip's best moment; book a room 12 weeks ahead.", "Midges are gone; ticks are not an issue; roads can close in snow."] },
  climate: { representative: "Fort William (sea level); Glencoe tops 1,000 m", dayHighC: [6, 7, 9, 12, 15, 17, 19, 18, 16, 12, 9, 7], nightLowC: [1, 1, 2, 3, 6, 9, 11, 11, 9, 6, 3, 1], rainDays: [20, 16, 18, 14, 13, 14, 16, 16, 17, 20, 19, 20], snowMonths: [1, 2, 3, 12] },
  bulletins: [{ name: "Scottish Avalanche Information Service", url: "https://www.sais.gov.uk/", type: "avalanche" }, { name: "MWIS mountain weather", url: "https://www.mwis.org.uk/", type: "weather" }],
  guides: [{ name: "Lonely Planet Scotland", url: "https://www.lonelyplanet.com/scotland" }, { name: "Routard Écosse", url: "https://www.routard.com/guide/code_dest/ecosse.htm" }]
});

for (const d of D) {
  d.lastReviewed = "2026-11-08"; d.sources = d.sources || [];
  for (const b of d.blocks) { if (b.destcentM !== undefined) delete b.destcentM; }
  fs.writeFileSync(path.join(dir, d.id + ".json"), JSON.stringify(d, null, 2));
}
// rebuild index
const all = fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
all.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
fs.writeFileSync(path.join(__dirname, "..", "data", "index.json"), JSON.stringify(all.map(d => ({ id: d.id, kind: d.kind, name: d.name, zone: d.zone, noFlights: !!d.noFlights, tags: d.tags || [], file: "destinations/" + d.id + ".json" })), null, 2));
console.log("seeded", D.length, "destinations; index has", all.length);
