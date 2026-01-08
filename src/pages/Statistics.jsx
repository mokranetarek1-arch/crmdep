import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // عدل المسار حسب ملف firebase.js عندك

const COMMISSION_RATE = 0.1; // 10%

export default function Statistics() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const snapshot = await getDocs(collection(db, "requests")); // نجيب من "requests"
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            date: d.date?.toDate ? d.date.toDate() : d.date ? new Date(d.date) : null
          };
        });
        setRows(data);
      } catch (err) {
        console.error("Erreur fetch trips:", err);
      }
    };

    fetchTrips();
  }, []);

  const total = rows.length;
  const cancelled = rows.filter(r => r.status === "Annulé").length;
  const confirmed = rows.filter(r => r.status === "Confirmé").length;
  const pending = rows.filter(r => r.status === "En cours").length;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthTrips = rows.filter(r => {
    if (!r.date) return false;
    const d = r.date instanceof Date ? r.date : new Date(r.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // 🔹 Calcul des commissions
  const totalCommission = rows.reduce((acc, r) => acc + (Number(r.prix) || 0) * COMMISSION_RATE, 0);
  const monthCommission = rows.reduce((acc, r) => {
    if (!r.date) return acc;
    const d = r.date instanceof Date ? r.date : new Date(r.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      return acc + (Number(r.prix) || 0) * COMMISSION_RATE;
    }
    return acc;
  }, 0);

  const cancelRate = total ? ((cancelled / total) * 100).toFixed(1) : 0;
  const confirmRate = total ? ((confirmed / total) * 100).toFixed(1) : 0;

  return (
    <div className="container mt-4">
      <div className="row g-3">
        <StatCard title="Total des trajets" value={total} color="primary" />
        <StatCard title="Trajets confirmés" value={confirmed} color="success" />
        <StatCard title="Trajets annulés" value={cancelled} color="danger" />
        <StatCard title="En cours" value={pending} color="warning" />
        <StatCard title="Trajets ce mois" value={monthTrips} color="info" />
        <StatCard title="Commission totale" value={`${totalCommission.toFixed(2)} DA`} color="secondary" />
        <StatCard title="Commission ce mois" value={`${monthCommission.toFixed(2)} DA`} color="dark" />

        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="card-title">Taux</h6>

              <p className="mb-2">
                Taux d'annulation
                <span className="float-end fw-bold text-danger">{cancelRate}%</span>
              </p>
              <div className="progress mb-3">
                <div className="progress-bar bg-danger" style={{ width: `${cancelRate}%` }} />
              </div>

              <p className="mb-2">
                Taux de confirmation
                <span className="float-end fw-bold text-success">{confirmRate}%</span>
              </p>
              <div className="progress">
                <div className="progress-bar bg-success" style={{ width: `${confirmRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="col-md-3">
      <div className={`card border-${color} shadow-sm`}>
        <div className="card-body text-center">
          <h6 className="text-muted">{title}</h6>
          <h2 className={`text-${color}`}>{value}</h2>
        </div>
      </div>
    </div>
  );
}
