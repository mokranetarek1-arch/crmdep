import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const isCancelledStatus = (value) => String(value || "").toLowerCase().includes("annul");

const parseDate = (value) => {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function Statistics() {
  const [requests, setRequests] = useState([]);
  const [b2bTrips, setB2bTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const reqSnap = await getDocs(collection(db, "requests"));
      const b2bSnap = await getDocs(collection(db, "assuranceTrips"));
      const drvSnap = await getDocs(collection(db, "drivers"));

      setRequests(
        reqSnap.docs.map((entry) => ({
          ...entry.data(),
          date: parseDate(entry.data().date),
        }))
      );

      setB2bTrips(
        b2bSnap.docs.map((entry) => ({
          ...entry.data(),
          date: parseDate(entry.data().date),
        }))
      );

      setDrivers(drvSnap.docs.map((entry) => entry.data()));
    };

    fetchData();
  }, []);

  const filterFn = (row) => {
    if (!row.date) return false;
    const monthMatch = filterMonth === "all" || row.date.getMonth() + 1 === Number(filterMonth);
    const yearMatch = filterYear === "all" || row.date.getFullYear() === Number(filterYear);
    return monthMatch && yearMatch;
  };

  const filteredReq = requests.filter(filterFn);
  const filteredB2b = b2bTrips.filter(filterFn);
  const filteredAssurance = filteredB2b.filter((row) => row.typePayment === "assurance");
  const filteredSociete = filteredB2b.filter((row) => row.typePayment === "societe");

  const confirmedDispatch = filteredReq.filter((row) => isConfirmedStatus(row.status));
  const cancelledDispatch = filteredReq.filter((row) => isCancelledStatus(row.status));
  const pendingDispatch = filteredReq.filter(
    (row) => !isConfirmedStatus(row.status) && !isCancelledStatus(row.status)
  );

  const totalTrips = filteredReq.length + filteredB2b.length;
  const confirmed = confirmedDispatch.length + filteredB2b.length;
  const cancelled = cancelledDispatch.length;
  const pending = pendingDispatch.length;

  const dispatchCommission = confirmedDispatch.reduce((sum, row) => sum + (Number(row.prix) * 0.1 || 0), 0);
  const assuranceCommission = filteredAssurance.reduce((sum, row) => sum + (Number(row.commission) || 0), 0);
  const societeCommission = filteredSociete.reduce((sum, row) => sum + (Number(row.commission) || 0), 0);
  const totalCommission = dispatchCommission + assuranceCommission + societeCommission;

  const confirmRate = totalTrips ? ((confirmed / totalTrips) * 100).toFixed(1) : 0;
  const cancelRate = totalTrips ? ((cancelled / totalTrips) * 100).toFixed(1) : 0;

  const motifStats = filteredReq.reduce((acc, row) => {
    const key = row.motif || "non defini";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topMotifs = Object.entries(motifStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const monthlyCommissions = useMemo(() => {
    const grouped = {};

    confirmedDispatch.forEach((row) => {
      if (!row.date) return;
      const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
      grouped[key] = grouped[key] || { dispatch: 0, assurance: 0, societe: 0 };
      grouped[key].dispatch += Number(row.prix) * 0.1 || 0;
    });

    filteredAssurance.forEach((row) => {
      if (!row.date) return;
      const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
      grouped[key] = grouped[key] || { dispatch: 0, assurance: 0, societe: 0 };
      grouped[key].assurance += Number(row.commission) || 0;
    });

    filteredSociete.forEach((row) => {
      if (!row.date) return;
      const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
      grouped[key] = grouped[key] || { dispatch: 0, assurance: 0, societe: 0 };
      grouped[key].societe += Number(row.commission) || 0;
    });

    return Object.entries(grouped)
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(-6)
      .map(([month, values]) => ({
        month,
        ...values,
        total: values.dispatch + values.assurance + values.societe,
      }));
  }, [confirmedDispatch, filteredAssurance, filteredSociete]);

  const maxCommission = Math.max(dispatchCommission, assuranceCommission, societeCommission, totalCommission, 1);
  const maxMonthlyTotal = Math.max(...monthlyCommissions.map((entry) => entry.total), 1);

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Statistiques</h2>
          <p className="page-subtitle">Vue sur les commissions, le volume de courses et la repartition de l'activite.</p>
        </div>
      </div>

      <div className="panel-card mb-4">
        <div className="row g-3">
          <div className="col-md-3">
            <select className="form-select" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="all">Tous les mois</option>
              {[...Array(12).keys()].map((month) => (
                <option key={month} value={month + 1}>
                  {new Date(0, month).toLocaleString("fr-FR", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <input
              type="number"
              className="form-control"
              placeholder="Annee"
              onChange={(e) => setFilterYear(e.target.value || "all")}
            />
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <MetricCard title="Total courses" value={totalTrips} />
        <MetricCard title="Confirmees" value={confirmed} variant="success" />
        <MetricCard title="Annulees" value={cancelled} variant="danger" />
        <MetricCard title="En cours" value={pending} variant="warning" />
        <MetricCard title="Commission particulier" value={`${dispatchCommission.toFixed(0)} DA`} />
        <MetricCard title="Commission assurance" value={`${assuranceCommission.toFixed(0)} DA`} variant="success" />
        <MetricCard title="Commission societe" value={`${societeCommission.toFixed(0)} DA`} variant="info" />
        <MetricCard title="Commission totale" value={`${totalCommission.toFixed(0)} DA`} variant="dark" />
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Taux de conversion</h5>
            <ProgressBar label="Confirmation" percent={confirmRate} color="bg-success" />
            <ProgressBar label="Annulation" percent={cancelRate} color="bg-danger" />
            <StatLine label="Chauffeurs actifs" value={drivers.length} />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Top motifs CRM</h5>
            {topMotifs.length === 0 ? (
              <p className="text-muted mb-0">Aucune donnee.</p>
            ) : (
              topMotifs.map(([label, value]) => <StatLine key={label} label={label} value={value} suffix=" demandes" />)
            )}
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Comparaison des commissions</h5>
            <BarGraph label="Particulier" value={dispatchCommission} max={maxCommission} color="bg-primary" />
            <BarGraph label="Assurance" value={assuranceCommission} max={maxCommission} color="bg-success" />
            <BarGraph label="Societe" value={societeCommission} max={maxCommission} color="bg-info" />
            <BarGraph label="Total" value={totalCommission} max={maxCommission} color="bg-dark" />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Graphe commissions par mois</h5>
            {monthlyCommissions.length === 0 ? (
              <p className="text-muted mb-0">Aucune donnee.</p>
            ) : (
              monthlyCommissions.map((entry) => (
                <MonthlyCommissionGraph key={entry.month} entry={entry} max={maxMonthlyTotal} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, variant = "primary" }) {
  const variantClass =
    variant === "success"
      ? "metric-card metric-card--success"
      : variant === "danger"
      ? "metric-card metric-card--danger"
      : "metric-card";

  return (
    <div className="col-md-3">
      <div className={variantClass}>
        <span className="metric-label">{title}</span>
        <strong className="metric-value">{value}</strong>
      </div>
    </div>
  );
}

function ProgressBar({ label, percent, color }) {
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between mb-2">
        <span>{label}</span>
        <strong>{percent}%</strong>
      </div>
      <div className="progress" style={{ height: "18px" }}>
        <div className={`progress-bar ${color}`} role="progressbar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function BarGraph({ label, value, max, color }) {
  const percent = max ? (value / max) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between mb-2">
        <span>{label}</span>
        <strong>{value.toFixed(0)} DA</strong>
      </div>
      <div className="progress" style={{ height: "18px" }}>
        <div className={`progress-bar ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function MonthlyCommissionGraph({ entry, max }) {
  const totalPercent = max ? (entry.total / max) * 100 : 0;
  const dispatchPercent = entry.total ? (entry.dispatch / entry.total) * 100 : 0;
  const assurancePercent = entry.total ? (entry.assurance / entry.total) * 100 : 0;
  const societePercent = entry.total ? (entry.societe / entry.total) * 100 : 0;

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between mb-2">
        <span>{entry.month}</span>
        <strong>{entry.total.toFixed(0)} DA</strong>
      </div>
      <div className="progress mb-2" style={{ height: "16px" }}>
        <div className="progress-bar bg-primary" style={{ width: `${(totalPercent * dispatchPercent) / 100}%` }} />
        <div className="progress-bar bg-success" style={{ width: `${(totalPercent * assurancePercent) / 100}%` }} />
        <div className="progress-bar bg-info" style={{ width: `${(totalPercent * societePercent) / 100}%` }} />
      </div>
      <div className="d-flex justify-content-between small text-muted">
        <span>Particulier: {entry.dispatch.toFixed(0)} DA</span>
        <span>Assurance: {entry.assurance.toFixed(0)} DA</span>
        <span>Societe: {entry.societe.toFixed(0)} DA</span>
      </div>
    </div>
  );
}

function StatLine({ label, value, suffix = "" }) {
  return (
    <div className="d-flex justify-content-between py-2 border-bottom">
      <span>{label}</span>
      <strong>
        {value}
        {suffix}
      </strong>
    </div>
  );
}
