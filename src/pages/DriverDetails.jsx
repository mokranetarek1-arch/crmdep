import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

export default function DriverDetails() {
  const { driverId } = useParams();

  const [months, setMonths] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({ totalTrips: 0, totalCommission: 0 });
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  // ✅ FIX DATE (المهم هنا)
  const normalizeTrip = (t, id) => {
    let date = null;

    try {
      if (t.date instanceof Date) {
        date = t.date;
      } else if (t.date?.toDate) {
        date = t.date.toDate();
      } else if (typeof t.date === "string") {
        const parsed = new Date(t.date);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      } else if (t.timestamp?.toDate) {
        date = t.timestamp.toDate();
      }
    } catch (e) {
      console.warn("Date parse error:", t.date);
    }

    const price = Number(t.prix) || 0;

    return {
      id,
      date,
      price,
      commission: price * COMMISSION_RATE,
      depart: t.depart || "-",
      destination: t.destination || "-",
      status: t.status || t.dispatch || "En attente"
    };
  };

  const fetchData = async () => {
    try {
      const rq = query(
        collection(db, "requests"),
        where("driverId", "==", driverId)
      );

      const rsnap = await getDocs(rq);

      const tripsData = rsnap.docs
        .map(d => normalizeTrip(d.data(), d.id))
        .filter(t => t.status === "Confirmé")
        .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

      setTrips(tripsData);

      // 🔹 payments
      const pq = query(
        collection(db, "driverPayments"),
        where("driverId", "==", driverId)
      );

      const psnap = await getDocs(pq);
      const paidMonths = psnap.docs.map(d => d.data());

      // 🔹 monthly aggregation
      const map = {};

      tripsData.forEach(t => {
        if (!t.date) return;

        const year = t.date.getFullYear();
        const month = t.date.getMonth() + 1;
        const key = `${year}-${month}`;

        if (!map[key]) {
          map[key] = {
            year,
            month,
            totalCommission: 0,
            totalTrips: 0,
            regle: false
          };
        }

        map[key].totalCommission += t.commission;
        map[key].totalTrips += 1;
      });

      // 🔹 payment status
      Object.values(map).forEach(m => {
        const paid = paidMonths.find(
          p => p.year === m.year && p.month === m.month && p.regle
        );
        if (paid) m.regle = true;
      });

      const result = Object.values(map).sort(
        (a, b) => b.year - a.year || b.month - a.month
      );

      setMonths(result);

      setStats({
        totalTrips: tripsData.length,
        totalCommission: tripsData.reduce((s, t) => s + t.commission, 0)
      });

    } catch (err) {
      console.error(err);
      alert("Erreur chargement données");
    }
  };

  const markAsPaid = async (m) => {
    await addDoc(collection(db, "driverPayments"), {
      driverId,
      year: m.year,
      month: m.month,
      regle: true,
      paidAt: serverTimestamp()
    });

    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [driverId]);

  // 🔹 filters
  const filteredTrips = trips.filter(t => {
    if (!t.date) return false;

    const year = t.date.getFullYear();
    const month = t.date.getMonth() + 1;

    return (filterYear ? year === Number(filterYear) : true) &&
           (filterMonth ? month === Number(filterMonth) : true);
  });

  const years = [
    ...new Set(trips.filter(t => t.date).map(t => t.date.getFullYear()))
  ].sort((a, b) => b - a);

  return (
    <div className="container mt-3">
      <h2>📄 Détails du conducteur</h2>

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card p-3 text-center">
            <h6>Trajets Confirmés</h6>
            <h4>{stats.totalTrips}</h4>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 text-center">
            <h6>Commission Totale</h6>
            <h4>{stats.totalCommission} DA</h4>
          </div>
        </div>
      </div>

      {/* Monthly */}
      <h5>📆 Commission Mensuelle</h5>
      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>Mois</th>
            <th>Trajets</th>
            <th>Commission</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={i}>
              <td>{m.month}/{m.year}</td>
              <td>{m.totalTrips}</td>
              <td>{m.totalCommission} DA</td>
              <td>
                {m.regle ? (
                  <span className="badge bg-success">RÉGLÉ</span>
                ) : (
                  <span className="badge bg-warning text-dark">À PAYER</span>
                )}
              </td>
              <td>
                {!m.regle && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => markAsPaid(m)}
                  >
                    ✔ Régler
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Filters */}
      <div className="mb-3 d-flex gap-2">
        <select
          className="form-select w-auto"
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
        >
          <option value="">Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          className="form-select w-auto"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        >
          <option value="">Tous les mois</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <button
          className="btn btn-secondary"
          onClick={() => {
            setFilterYear("");
            setFilterMonth("");
          }}
        >
          Réinitialiser
        </button>
      </div>

      {/* Trips */}
      <h5>🚗 Liste des Trajets</h5>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Date</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Prix</th>
            <th>Commission</th>
          </tr>
        </thead>
        <tbody>
          {filteredTrips.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center text-muted py-3">
                Aucun trajet trouvé
              </td>
            </tr>
          ) : (
            filteredTrips.map(t => (
              <tr key={t.id}>
                <td>
                  {t.date
                    ? t.date.toLocaleDateString("fr-FR")
                    : "⚠️ Pas de date"}
                </td>
                <td>{t.depart}</td>
                <td>{t.destination}</td>
                <td>{t.price} DA</td>
                <td>{t.commission} DA</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}