import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1; // 10%

// Helpers pour formater les dates
const getDayKey = (date) => date.toISOString().split("T")[0];
const getMonthKey = (date) => `${date.getFullYear()}-${date.getMonth() + 1}`;

export default function ConfirmedTrips() {
  const [trips, setTrips] = useState([]);
  const [dailyIncome, setDailyIncome] = useState({});
  const [monthlyIncome, setMonthlyIncome] = useState({});

  // 🔹 Récupérer les trajets confirmés depuis "requests"
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
        .filter(t => t.status === "Confirmé"); // uniquement Confirmé

      setTrips(confirmed);
      calculateIncome(confirmed);
    } catch (err) {
      console.error("Erreur fetch requests:", err);
      alert("Erreur lors du chargement des demandes !");
    }
  };

  // 🔹 Calcul des revenus quotidiens et mensuels (basé sur commission seulement)
  const calculateIncome = (data) => {
    const daily = {};
    const monthly = {};

    data.forEach(t => {
      const day = getDayKey(t.date);
      const month = getMonthKey(t.date);

      daily[day] = (daily[day] || 0) + t.commission;
      monthly[month] = (monthly[month] || 0) + t.commission;
    });

    setDailyIncome(daily);
    setMonthlyIncome(monthly);
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  return (
    <div className="container mt-3">
      <h2>🚗 Trajets Confirmés</h2>

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
          {trips.map(t => (
            <tr key={t.id}>
              <td>{t.date.toLocaleDateString()}</td>
              <td>{t.driverName}</td>
              <td>{t.depart}</td>
              <td>{t.destination}</td>
              <td>{t.price} DA</td>
              <td><b>{t.commission} DA</b></td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr />

      <h3>📅 Revenus Journaliers (Commission)</h3>
      <ul>
        {Object.entries(dailyIncome).map(([day, total]) => (
          <li key={day}>{day} : <b>{total} DA</b></li>
        ))}
      </ul>

      <h3>📆 Revenus Mensuels (Commission)</h3>
      <ul>
        {Object.entries(monthlyIncome).map(([month, total]) => (
          <li key={month}>{month} : <b>{total} DA</b></li>
        ))}
      </ul>
    </div>
  );
}
