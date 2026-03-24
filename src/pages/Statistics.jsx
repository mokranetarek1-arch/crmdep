// src/pages/Statistics.jsx
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Statistics() {
  const [requests, setRequests] = useState([]);
  const [assuranceTrips, setAssuranceTrips] = useState([]);
  const [societeTrips, setSocieteTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const reqSnap = await getDocs(collection(db, "requests"));
      const assSnap = await getDocs(collection(db, "assuranceTrips"));
      const socSnap = await getDocs(collection(db, "societeTrips"));
      const drvSnap = await getDocs(collection(db, "drivers"));

      setRequests(reqSnap.docs.map(d => ({
        ...d.data(),
        date: d.data().date?.toDate ? d.data().date.toDate() : new Date(d.data().date)
      })));

      setAssuranceTrips(assSnap.docs.map(d => ({
        ...d.data(),
        date: new Date(d.data().date)
      })));

      setSocieteTrips(socSnap.docs.map(d => ({
        ...d.data(),
        date: new Date(d.data().date)
      })));

      setDrivers(drvSnap.docs);
    };

    fetchData();
  }, []);

  const filterFn = r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    const monthMatch = filterMonth === "all" || d.getMonth() + 1 === Number(filterMonth);
    const yearMatch = filterYear === "all" || d.getFullYear() === Number(filterYear);
    return monthMatch && yearMatch;
  };

  const filteredReq = requests.filter(filterFn);
  const filteredAss = assuranceTrips.filter(filterFn);
  const filteredSoc = societeTrips.filter(filterFn);

  // ===== STATS =====
  const totalTrips = filteredReq.length + filteredAss.length + filteredSoc.length;
  const confirmed = filteredReq.filter(r => r.status === "Confirmé").length + filteredAss.length + filteredSoc.length;
  const cancelled = filteredReq.filter(r => r.status === "Annulé").length;
  const pending = filteredReq.filter(r => r.status === "En cours").length;

  const cancelRate = totalTrips ? ((cancelled / totalTrips) * 100).toFixed(1) : 0;
  const confirmRate = totalTrips ? ((confirmed / totalTrips) * 100).toFixed(1) : 0;

  // ===== COMMISSIONS =====
  const dispatchCommission = filteredReq.reduce((acc, r) => r.status !== "Annulé" ? acc + (Number(r.prix) * 0.1 || 0) : acc, 0);
  const assuranceCommission = filteredAss.reduce((acc, r) => acc + (Number(r.commission) || 0), 0);
  const societeCommission = filteredSoc.reduce((acc, r) => acc + (Number(r.commission) || 0), 0);
  const totalCommission = dispatchCommission + assuranceCommission + societeCommission;
  const max = Math.max(dispatchCommission, assuranceCommission, societeCommission, totalCommission);

  return (
    <div className="container mt-4">
      <h2 className="mb-4 text-primary fw-bold">📊 Statestique</h2>

      {/* FILTER */}
      <div className="row mb-4 g-3">
        <div className="col-md-3">
          <select
            className="form-select"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          >
            <option value="all">Tous les mois</option>
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
            placeholder="Année"
            onChange={e => setFilterYear(e.target.value || "all")}
          />
        </div>
      </div>

      {/* CARDS */}
      <div className="row g-4 mb-4">
        <DashboardCard title="Total Trajets" value={totalTrips} color="bg-primary text-white" />
        <DashboardCard title="Confirmés" value={confirmed} color="bg-success text-white" />
        <DashboardCard title="Annulés" value={cancelled} color="bg-danger text-white" />
        <DashboardCard title="En cours" value={pending} color="bg-warning text-dark" />
        <DashboardCard title="Total Commission" value={totalCommission.toFixed(0) + " DA"} color="bg-dark text-white" />
        <DashboardCard title="Chauffeurs" value={drivers.length} color="bg-info text-white" />
      </div>

      {/* TAUX */}
      <div className="card mb-4 p-4 shadow-sm">
        <h5 className="fw-bold mb-3">📊 Taux global</h5>
        <ProgressBar label="Annulation" percent={cancelRate} color="bg-danger" />
        <ProgressBar label="Confirmation" percent={confirmRate} color="bg-success" />
      </div>

      {/* BAR GRAPH */}
      <div className="card p-4 shadow-sm">
        <h5 className="fw-bold mb-3">📊 Comparaison des commissions</h5>
        <BarGraph label="Particulier" value={dispatchCommission} max={max} color="bg-primary" />
        <BarGraph label="B2B" value={assuranceCommission} max={max} color="bg-success" />
        <BarGraph label="Total" value={totalCommission} max={max} color="bg-dark" />
      </div>
    </div>
  );
}

// CARD COMPONENT
function DashboardCard({ title, value, color }) {
  return (
    <div className="col-md-3">
      <div className={`card ${color} shadow-sm`}>
        <div className="card-body text-center">
          <h6 className="fw-bold">{title}</h6>
          <h3 className="fw-bold">{value}</h3>
        </div>
      </div>
    </div>
  );
}

// PROGRESS BAR
function ProgressBar({ label, percent, color }) {
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between">
        <span>{label}</span>
        <span className="fw-bold">{percent}%</span>
      </div>
      <div className="progress" style={{ height: "20px" }}>
        <div className={`progress-bar ${color}`} role="progressbar" style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}

// BAR GRAPH
function BarGraph({ label, value, max, color }) {
  const percent = max ? (value / max) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between">
        <span>{label}</span>
        <b>{value.toFixed(0)} DA</b>
      </div>
      <div className="progress" style={{ height: "18px" }}>
        <div className={`progress-bar ${color}`} style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}
