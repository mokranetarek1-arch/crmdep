import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1; // 10%

const getDayKey = (date) => date.toISOString().split("T")[0];
const getMonthKey = (date) => `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

export default function ConfirmedTrips() {
  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [dailyCommission, setDailyCommission] = useState([]);
  const [monthlyCommission, setMonthlyCommission] = useState([]);

  // 🔹 Filters
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");

  // 🔹 Fetch Confirmed Trips
  const fetchTrips = async () => {
    try {
      const snap = await getDocs(collection(db, "requests"));
      const confirmed = snap.docs
        .map(d => {
          const data = d.data();
          const date = data.date
            ? data.date.toDate
              ? data.date.toDate()
              : new Date(data.date)
            : new Date();

          const price = Number(data.prix) || 0;
          const commission = price * COMMISSION_RATE;

          return {
            id: d.id,
            driverName: data.driverName || "-",
            date,
            depart: data.depart || "-",
            destination: data.destination || "-",
            price,
            commission,
            status: data.status
          };
        })
        .filter(t => t.status === "Confirmé")
        .sort((a, b) => b.date - a.date);

      setTrips(confirmed);
      setFilteredTrips(confirmed);
      calculateCommission(confirmed);
    } catch (err) {
      console.error("Erreur fetch requests:", err);
      alert("Erreur lors du chargement des demandes !");
    }
  };

  // 🔹 Calculate commissions
  const calculateCommission = (data) => {
    const daily = {};
    const monthly = {};

    data.forEach(t => {
      const day = getDayKey(t.date);
      const month = getMonthKey(t.date);

      daily[day] = (daily[day] || 0) + t.commission;
      monthly[month] = (monthly[month] || 0) + t.commission;
    });

    setDailyCommission(Object.entries(daily).sort((a, b) => new Date(b[0]) - new Date(a[0])));
    setMonthlyCommission(Object.entries(monthly).sort((a, b) => new Date(b[0] + "-01") - new Date(a[0] + "-01")));
  };

  // 🔹 Apply filters
  useEffect(() => {
    const filtered = trips.filter(t => {
      const dateObj = t.date;
      const dateStr = getDayKey(dateObj);
      const monthStr = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, "0")}`;

      let matchDate = true, matchDay = true, matchMonthYear = true;

      if (dateFilter) matchDate = dateStr === dateFilter;
      if (dayFilter) matchDay = dateObj.toLocaleDateString("en-US", { weekday: "long" }) === dayFilter;
      if (monthFilter && yearFilter) matchMonthYear =
        dateObj.getMonth() === parseInt(monthFilter) &&
        dateObj.getFullYear() === parseInt(yearFilter);

      return matchDate && matchDay && matchMonthYear;
    });

    setFilteredTrips(filtered);
    calculateCommission(filtered);
  }, [dateFilter, dayFilter, monthFilter, yearFilter, trips]);

  useEffect(() => { fetchTrips(); }, []);

  return (
    <div className="container mt-3">
      <h2>🚗 Trajets Confirmés</h2>

      {/* ================= FILTERS ================= */}
      <div className="row mb-3 g-3 align-items-end">
        <div className="col-md-3">
          <label>Date :</label>
          <input type="date" className="form-control" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>
        <div className="col-md-3">
          <label>Jour :</label>
          <select className="form-select" value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="Monday">Lundi</option>
            <option value="Tuesday">Mardi</option>
            <option value="Wednesday">Mercredi</option>
            <option value="Thursday">Jeudi</option>
            <option value="Friday">Vendredi</option>
            <option value="Saturday">Samedi</option>
            <option value="Sunday">Dimanche</option>
          </select>
        </div>
        <div className="col-md-3">
          <label>Mois :</label>
          <select className="form-select" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="">Tous</option>
            {[...Array(12)].map((_, i) => <option key={i} value={i}>{i+1}</option>)}
          </select>
        </div>
        <div className="col-md-3">
          <label>Année :</label>
          <input type="number" className="form-control" placeholder={new Date().getFullYear()} value={yearFilter} onChange={e => setYearFilter(e.target.value)} />
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>Date</th>
            <th>Conducteur</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Prix (DA)</th>
            <th>Commission (10%)</th>
          </tr>
        </thead>
        <tbody>
          {filteredTrips.length === 0 ? (
            <tr><td colSpan="6" className="text-center text-muted py-3">Aucun trajet trouvé</td></tr>
          ) : (
            filteredTrips.map(t => (
              <tr key={t.id}>
                <td>{t.date.toLocaleDateString()}</td>
                <td>{t.driverName}</td>
                <td>{t.depart}</td>
                <td>{t.destination}</td>
                <td>{t.price} DA</td>
                <td><b>{t.commission} DA</b></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <hr />
      <h3>📅 Commissions Journalières</h3>
      <ul>{dailyCommission.map(([day, total]) => <li key={day}>{day} : <b>{total} DA</b></li>)}</ul>

      <h3>📆 Commissions Mensuelles</h3>
      <ul>{monthlyCommission.map(([month, total]) => <li key={month}>{month} : <b>{total} DA</b></li>)}</ul>
    </div>
  );
}
