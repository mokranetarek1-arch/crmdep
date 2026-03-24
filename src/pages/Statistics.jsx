import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Statistics() {
  const [rows, setRows] = useState([]);
  const [assuranceRows, setAssuranceRows] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const reqSnap = await getDocs(collection(db, "requests"));
      const assSnap = await getDocs(collection(db, "assuranceTrips"));
      const drvSnap = await getDocs(collection(db, "drivers"));

      setRows(reqSnap.docs.map(d => ({
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : new Date(d.data().date)
      })));

      setAssuranceRows(assSnap.docs.map(d => ({
        ...d.data(),
        date: new Date(d.data().date)
      })));

      setDrivers(drvSnap.docs);
    };

    fetchData();
  }, []);

  // FILTER
  const filterFn = (r) => {
    if (!r.date) return false;
    const d = new Date(r.date);

    const m = filterMonth === "all" || d.getMonth() + 1 === Number(filterMonth);
    const y = filterYear === "all" || d.getFullYear() === Number(filterYear);

    return m && y;
  };

  const filteredReq = rows.filter(filterFn);
  const filteredAss = assuranceRows.filter(filterFn);

  // ===== MERGE =====
  const totalTrips = filteredReq.length + filteredAss.length;

  const confirmed =
    filteredReq.filter(r => r.status === "Confirmé").length +
    filteredAss.length;

  const cancelled = filteredReq.filter(r => r.status === "Annulé").length;
  const pending = filteredReq.filter(r => r.status === "En cours").length;

  // ✅ رجعنا taux
  const cancelRate = totalTrips
    ? ((cancelled / totalTrips) * 100).toFixed(1)
    : 0;

  const confirmRate = totalTrips
    ? ((confirmed / totalTrips) * 100).toFixed(1)
    : 0;

  // ===== COMMISSIONS =====
  const dispatchCommission = filteredReq.reduce(
    (acc, r) =>
      r.status !== "Annulé"
        ? acc + (Number(r.prix) || 0) * 0.1
        : acc,
    0
  );

  const assuranceCommission = filteredAss.reduce(
    (acc, r) => acc + (Number(r.commission) || 0),
    0
  );

  const totalCommission = dispatchCommission + assuranceCommission;

  const max = Math.max(dispatchCommission, assuranceCommission, totalCommission);

  return (
    <div className="container mt-4">
      <h2>📊 Dashboard Global</h2>

      {/* FILTER */}
      <div className="row mb-4">
        <div className="col-md-3">
          <select
            className="form-select"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            <option value="all">All months</option>
            {[...Array(12).keys()].map(m => (
              <option key={m} value={m + 1}>
                {new Date(0, m).toLocaleString("fr-FR", { month: "long" })}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <input
            type="number"
            className="form-control"
            placeholder="Year"
            onChange={(e) => setFilterYear(e.target.value || "all")}
          />
        </div>
      </div>

      {/* CARDS */}
      <div className="row g-3 mb-4">
        <Card title="Total Trajets" value={totalTrips} color="primary" />
        <Card title="Confirmés" value={confirmed} color="success" />
        <Card title="Annulés" value={cancelled} color="danger" />
        <Card title="En cours" value={pending} color="warning" />
        <Card title="Total Commission" value={totalCommission.toFixed(0) + " DA"} color="dark" />
        <Card title="Chauffeurs" value={drivers.length} color="info" />
      </div>

      {/* ✅ TAUX */}
      <div className="card p-3 mb-4">
        <h5>📊 Taux global</h5>

        <p className="mb-2">
          Taux d'annulation
          <span className="float-end text-danger fw-bold">{cancelRate}%</span>
        </p>
        <div className="progress mb-3">
          <div className="progress-bar bg-danger" style={{ width: cancelRate + "%" }} />
        </div>

        <p className="mb-2">
          Taux de confirmation
          <span className="float-end text-success fw-bold">{confirmRate}%</span>
        </p>
        <div className="progress">
          <div className="progress-bar bg-success" style={{ width: confirmRate + "%" }} />
        </div>
      </div>

      {/* GRAPH */}
      <div className="card p-3">
        <h5>📊 Comparaison des commissions</h5>

        <Bar label="Particulier" value={dispatchCommission} max={max} color="bg-primary" />
        <Bar label="Assurance" value={assuranceCommission} max={max} color="bg-success" />
        <Bar label="Total" value={totalCommission} max={max} color="bg-dark" />
      </div>
    </div>
  );
}

// CARD
function Card({ title, value, color }) {
  return (
    <div className="col-md-3">
      <div className={`card border-${color}`}>
        <div className="card-body text-center">
          <h6>{title}</h6>
          <h3 className={`text-${color}`}>{value}</h3>
        </div>
      </div>
    </div>
  );
}

// BAR GRAPH
function Bar({ label, value, max, color }) {
  const percent = max ? (value / max) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between">
        <span>{label}</span>
        <b>{value.toFixed(0)} DA</b>
      </div>
      <div className="progress">
        <div className={`progress-bar ${color}`} style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}
