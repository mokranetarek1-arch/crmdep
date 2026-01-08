import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1; // 10%

export default function Statistics() {
  const [rows, setRows] = useState([]);
  const [filterMonth, setFilterMonth] = useState("all"); // all = كل الأشهر
  const [filterYear, setFilterYear] = useState("all");   // all = كل السنوات

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const snapshot = await getDocs(collection(db, "requests"));
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

  // 🔹 فلترة حسب الشهر والسنة مع خيار ALL
  const filteredRows = rows.filter(r => {
    if (!r.date) return false;
    const d = r.date instanceof Date ? r.date : new Date(r.date);

    const monthMatch = filterMonth === "all" ? true : d.getMonth() + 1 === Number(filterMonth);
    const yearMatch = filterYear === "all" ? true : d.getFullYear() === Number(filterYear);

    return monthMatch && yearMatch;
  });

  const total = filteredRows.length;
  const cancelled = filteredRows.filter(r => r.status === "Annulé").length;
  const confirmed = filteredRows.filter(r => r.status === "Confirmé").length;
  const pending = filteredRows.filter(r => r.status === "En cours").length;

  const totalCommission = filteredRows.reduce((acc, r) => {
    if (r.status !== "Annulé") return acc + (Number(r.prix) || 0) * COMMISSION_RATE;
    return acc;
  }, 0);

  const cancelRate = total ? ((cancelled / total) * 100).toFixed(1) : 0;
  const confirmRate = total ? ((confirmed / total) * 100).toFixed(1) : 0;

  return (
    <div className="container mt-4">
      {/* ===== FILTRE MOIS / ANNEE ===== */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <label className="form-label">Mois :</label>
          <select
            className="form-select"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">All</option>
            {[...Array(12).keys()].map(m => (
              <option key={m} value={m + 1}>
                {new Date(0, m).toLocaleString('fr-FR', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Année :</label>
          <input
            type="number"
            className="form-control"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value || "all")}
            placeholder="All"
          />
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="row g-3 mb-4">
        <StatCard title="Total des trajets" value={total} color="primary" />
        <StatCard title="Trajets confirmés" value={confirmed} color="success" />
        <StatCard title="Trajets annulés" value={cancelled} color="danger" />
        <StatCard title="En cours" value={pending} color="warning" />
        <StatCard title="Commission totale" value={`${totalCommission.toFixed(2)} DA`} color="info" />
      </div>

      {/* ===== BARRES DE PROGRESSION ===== */}
      <div className="row">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h6 className="card-title">Taux de confirmation / annulation</h6>

              <p className="mb-2">
                Taux d'annulation
                <span className="float-end fw-bold text-danger">{cancelRate}%</span>
              </p>
              <div className="progress mb-3" style={{ height: '20px' }}>
                <div className="progress-bar bg-danger" style={{ width: `${cancelRate}%` }} />
              </div>

              <p className="mb-2">
                Taux de confirmation
                <span className="float-end fw-bold text-success">{confirmRate}%</span>
              </p>
              <div className="progress" style={{ height: '20px' }}>
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
          <h2 className={`text-${color} fw-bold`}>{value}</h2>
        </div>
      </div>
    </div>
  );
}
