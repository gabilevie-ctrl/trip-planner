// Prefilled deep links. The app books nothing; it opens the right page with the right fields filled.
const q = s => encodeURIComponent(String(s || "").trim());

export function flights(origin, dest, start, end, pax) {
  return `https://www.google.com/travel/flights?q=${q(`Flights from ${origin} to ${dest} on ${start} through ${end} for ${pax} adults`)}`;
}
export function rome2rio(origin, dest) { return `https://www.rome2rio.com/map/${q(origin)}/${q(dest)}`; }
export function trainline() { return "https://www.thetrainline.com/"; }
export function seat61() { return "https://www.seat61.com/"; }
export function booking(place, checkin, checkout, adults, rooms) {
  return `https://www.booking.com/searchresults.html?ss=${q(place)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=${rooms}&group_children=0`;
}
export function airbnb(place, checkin, checkout, adults) {
  return `https://www.airbnb.com/s/${q(place)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}`;
}
export function hutSearch(name) { return `https://www.google.com/search?q=${q(name + " booking")}`; }
export const HUT_PORTALS = [
  { name: "hut-reservation.org (SAC, DAV, ÖAV, CAI)", url: "https://www.hut-reservation.org/" },
  { name: "FFCAM refuges (France)", url: "https://www.ffcam.fr/" },
  { name: "DNT huts (Norway)", url: "https://www.dnt.no/" },
  { name: "STF huts (Sweden)", url: "https://www.swedishtouristassociation.com/" }
];
export function mapsSearch(place) { return `https://www.google.com/maps/search/${q(place)}`; }
export function rooms(adults) { return Math.max(1, Math.ceil(adults / 2.5)); }

// Where testers send feedback (header link on every page).
export const FEEDBACK_EMAIL = "gabilevie@gmail.com";
export function feedbackMailto() { return `mailto:${FEEDBACK_EMAIL}?subject=${q("Trip planner feedback")}`; }
