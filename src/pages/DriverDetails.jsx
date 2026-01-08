import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1; // 10%

// 🔹 Formatter pour la date
const formatDate = (date) => {
  if (!date) return "-";
  if (date?.toDate) return date.toDate().toLocaleDateString("fr-FR");
  if (date instanceof Date) return date.toLocaleDateString("fr-FR");
  return new Date(date).toLocaleDateString("fr-FR");
};

export default function DriverDetails() {
  const { driverId } = useParams();

  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalCommission: 0
  });

  const fetchTrips = async () => {
    try {
      const q = query(
        collection(db, "requests"),
        where("driverId", "==", driverId),
        where("status", "==", "Confirmé")
      );

      const snap = await getDocs(q);

      const data = snap.docs.map(d => {
        const t = d.data();
        const price = Number(t.prix) || 0;
        const commission = price * COMMISSION_RATE;

        return {
          id: d.id,
          date: t.date?.toDate ? t.date.toDate() : new Date(t.date),
          depart: t.depart || "-",
          destination: t.destination || "-",
          km: t.kilometrage || 0,
          price,
          commission
        };
      });

      // 🔹 Statistiques
      const totalCommission = data.reduce((s, t) => s + t.commission, 0);

      setTrips(data);
      setStats({
        totalTrips: data.length,
        totalCommission
      });
    } catch (err) {
      console.error("Erreur fetch requests:", err);
      alert("Erreur lors du chargement des demandes !");
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [driverId]);

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

      {/* Liste des trajets */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Date</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Km</th>
            <th>Prix</th>
            <th>Commission (10%)</th>
          </tr>
        </thead>
        <tbody>
          {trips.map(t => (
            <tr key={t.id}>
              <td>{formatDate(t.date)}</td>
              <td>{t.depart}</td>
              <td>{t.destination}</td>
              <td>{t.km}</td>
              <td>{t.price} DA</td>
              <td><b>{t.commission} DA</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
