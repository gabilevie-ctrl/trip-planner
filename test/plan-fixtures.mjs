// A two-day La Palma plan as Claude would send it, shared by the live-plan tests.
const TODAY = "2026-11-09";
const booking = over => Object.assign({ id: "b_x", what: "Thing", category: "other", pick: "", alternative: "", price: null, currency: "EUR", seenOn: TODAY, status: "idea", link: null, bookBy: null, details: "", source: null }, over);
const day = over => Object.assign({ id: "d_1", date: "2027-01-02", move: "Ferry and walk", km: null, ascentM: null, descentM: null, hours: null, night: { name: "Camp", type: "camping", bookingId: null }, fallback: "", legs: [], points: [] }, over);
export function planInput(over = {}) {
  return Object.assign({
    days: [
      day({ id: "d_1", km: 12, night: { name: "Zona de acampada", type: "camping", bookingId: "b_camp" }, legs: [{ id: "l_1", mode: "ferry", from: "Los Cristianos", to: "Santa Cruz", time: "08:00", bookingId: "b_ferry", note: "" }] }),
      day({ id: "d_2", date: "2027-01-03", move: "GR131" })
    ],
    bookings: [
      booking({ id: "b_ferry", what: "Ferry Los Cristianos → Santa Cruz", category: "transport", price: 72, bookBy: "2026-12-01" }),
      booking({ id: "b_camp", what: "Caldera campsite", category: "lodging", price: 20 }),
      booking({ id: "b_bus", what: "Bus to the start", category: "transport", price: null })
    ],
    permits: [{ id: "p_caldera", what: "Caldera camping permit", who: ["all"], how: "Online", leadTime: "2 weeks", bookBy: "2026-12-15", note: "" }],
    admin: [{ id: "a_ins", traveller: "Situ", what: "Travel insurance", note: "" }],
    gear: [{ id: "g_tent", name: "Tent", note: "2-person" }],
    food: "Supermarket in Los Llanos",
    todo: [{ id: "t_permit", date: null, what: "Print the permit" }],
    otherCosts: [{ id: "c_food", what: "Food", amount: 100, currency: "EUR", seenOn: TODAY }],
    sources: [{ name: "Fred Olsen", url: "https://www.fredolsen.es", seenOn: TODAY }],
    rates: [{ currency: "EUR", toTrip: 0.86, seenOn: TODAY, source: null }]
  }, over);
}
