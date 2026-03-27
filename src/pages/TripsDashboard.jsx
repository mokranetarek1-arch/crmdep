import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

const getDayKey = (date) => date.toISOString().split("T")[0];
const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DA`;

export default function ConfirmedTrips() {
  const [trips, setTrips] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [dailyPage, setDailyPage] = useState(1);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const statsPageSize = 10;

  const fetchTrips = async () => {
    try {
      const snap = await getDocs(collection(db, "requests"));
      const confirmed = snap.docs
        .map((entry) => {
          const data = entry.data();
          const date = data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date();
          const price = Number(data.prix) || 0;
          return {
            id: entry.id,
            requestId: data.id || entry.id,
            driverId: data.driverId || "",
            driverName: data.driverName || "-",
            phone: data.phone || "",
            date,
            depart: data.depart || "-",
            destination: data.destination || "-",
            price,
            commission: price * COMMISSION_RATE,
            status: data.status,
          };
        })
        .filter((trip) => isConfirmedStatus(trip.status))
        .sort((a, b) => b.date - a.date);

      setTrips(confirmed);
    } catch (err) {
      console.error("Erreur fetch requests:", err);
      alert("Erreur lors du chargement des demandes !");
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const drivers = useMemo(
    () =>
      Array.from(
        new Map(trips.map((trip) => [trip.driverId || trip.driverName, { id: trip.driverId, name: trip.driverName }])).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [trips]
  );

  const filteredTrips = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return trips.filter((trip) => {
      const dateStr = getDayKey(trip.date);
      const matchDate = dateFilter ? dateStr === dateFilter : true;
      const matchDay = dayFilter
        ? trip.date.toLocaleDateString("en-US", { weekday: "long" }) === dayFilter
        : true;
      const matchMonthYear =
        monthFilter && yearFilter
          ? trip.date.getMonth() === parseInt(monthFilter, 10) &&
            trip.date.getFullYear() === parseInt(yearFilter, 10)
          : true;
      const matchDriver = driverFilter ? trip.driverId === driverFilter : true;
      const matchSearch = query
        ? trip.driverName.toLowerCase().includes(query) ||
          String(trip.phone).toLowerCase().includes(query) ||
          String(trip.requestId).toLowerCase().includes(query)
        : true;
      return matchDate && matchDay && matchMonthYear && matchDriver && matchSearch;
    });
  }, [trips, dateFilter, dayFilter, monthFilter, yearFilter, driverFilter, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
    setDailyPage(1);
    setMonthlyPage(1);
  }, [dateFilter, dayFilter, monthFilter, yearFilter, driverFilter, searchTerm, pageSize]);

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));

  const dailyCommission = useMemo(() => {
    const grouped = {};
    filteredTrips.forEach((trip) => {
      const key = getDayKey(trip.date);
      grouped[key] = grouped[key] || { total: 0, trips: 0 };
      grouped[key].total += trip.commission;
      grouped[key].trips += 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([period, values]) => ({ period, ...values }));
  }, [filteredTrips]);

  const monthlyCommission = useMemo(() => {
    const grouped = {};
    filteredTrips.forEach((trip) => {
      const key = getMonthKey(trip.date);
      grouped[key] = grouped[key] || { total: 0, trips: 0 };
      grouped[key].total += trip.commission;
      grouped[key].trips += 1;
    });
    return Object.entries(grouped)
      .sort((a, b) => new Date(`${b[0]}-01`) - new Date(`${a[0]}-01`))
      .map(([period, values]) => ({ period, ...values }));
  }, [filteredTrips]);

  const paginatedDailyCommission = useMemo(() => {
    const start = (dailyPage - 1) * statsPageSize;
    return dailyCommission.slice(start, start + statsPageSize);
  }, [dailyCommission, dailyPage]);

  const paginatedMonthlyCommission = useMemo(() => {
    const start = (monthlyPage - 1) * statsPageSize;
    return monthlyCommission.slice(start, start + statsPageSize);
  }, [monthlyCommission, monthlyPage]);

  const dailyTotalPages = Math.max(1, Math.ceil(dailyCommission.length / statsPageSize));
  const monthlyTotalPages = Math.max(1, Math.ceil(monthlyCommission.length / statsPageSize));

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Trips confirmes</h2>
          <p className="page-subtitle">Recherche rapide par chauffeur, numero et affichage pagine.</p>
        </div>
      </div>

      <div className="panel-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label>Recherche :</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nom chauffeur, telephone, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label>Chauffeur :</label>
            <select className="form-select" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
              <option value="">Tous</option>
              {drivers.map((driver) => (
                <option key={driver.id || driver.name} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label>Date :</label>
            <input type="date" className="form-control" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label>Jour :</label>
            <select className="form-select" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
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
          <div className="col-md-1">
            <label>Mois :</label>
            <select className="form-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">Tous</option>
              {[...Array(12)].map((_, index) => (
                <option key={index} value={index}>
                  {index + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-1">
            <label>Annee :</label>
            <input
              type="number"
              className="form-control"
              value={yearFilter}
              placeholder={new Date().getFullYear()}
              onChange={(e) => setYearFilter(e.target.value)}
            />
          </div>
          <div className="col-md-1">
            <label>Liste :</label>
            <select className="form-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel-card mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="section-title mb-0">Liste des courses</h5>
          <span className="text-muted small">
            {filteredTrips.length} resultat(s) | page {currentPage}/{totalPages}
          </span>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Chauffeur</th>
                <th>Telephone</th>
                <th>Depart</th>
                <th>Destination</th>
                <th>Prix</th>
                <th>Commission</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrips.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted py-3">
                    Aucun trajet trouve
                  </td>
                </tr>
              ) : (
                paginatedTrips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{trip.date.toLocaleDateString("fr-FR")}</td>
                    <td>{trip.driverName}</td>
                    <td>{trip.phone || "-"}</td>
                    <td>{trip.depart}</td>
                    <td>{trip.destination}</td>
                    <td>{formatMoney(trip.price)}</td>
                    <td><strong>{formatMoney(trip.commission)}</strong></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-3">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
          >
            Precedent
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
          >
            Suivant
          </button>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Commissions journalieres</h5>
            <CompactStatsTable
              rows={paginatedDailyCommission}
              currentPage={dailyPage}
              totalPages={dailyTotalPages}
              onPrev={() => setDailyPage((page) => Math.max(page - 1, 1))}
              onNext={() => setDailyPage((page) => Math.min(page + 1, dailyTotalPages))}
            />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="panel-card h-100">
            <h5 className="section-title">Commissions mensuelles</h5>
            <CompactStatsTable
              rows={paginatedMonthlyCommission}
              currentPage={monthlyPage}
              totalPages={monthlyTotalPages}
              onPrev={() => setMonthlyPage((page) => Math.max(page - 1, 1))}
              onNext={() => setMonthlyPage((page) => Math.min(page + 1, monthlyTotalPages))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactStatsTable({ rows, currentPage, totalPages, onPrev, onNext }) {
  return (
    <>
      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Courses</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center text-muted py-3">
                  Aucune donnee
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.trips}</td>
                  <td><strong>{formatMoney(row.total)}</strong></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="d-flex justify-content-between align-items-center mt-2">
        <button className="btn btn-outline-secondary btn-sm" disabled={currentPage === 1} onClick={onPrev}>
          Precedent
        </button>
        <span className="text-muted small">
          page {currentPage}/{totalPages}
        </span>
        <button className="btn btn-outline-secondary btn-sm" disabled={currentPage === totalPages} onClick={onNext}>
          Suivant
        </button>
      </div>
    </>
  );
}
