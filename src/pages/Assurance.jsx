import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;
const PAYMENT_SOURCE = "assuranceTrips";

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} DA`;
}

export default function Assurance() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [editTripId, setEditTripId] = useState(null);
  const [payments, setPayments] = useState([]);

  const [form, setForm] = useState({
    driverId: "",
    depart: "",
    destination: "",
    date: "",
    kilometrage: "",
    prix: "",
    typePayment: "assurance",
    numeroDossier: "",
    companyName: "",
    driverSalary: "",
    commission: "",
  });

  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [numeroDossierFilter, setNumeroDossierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const calculateCommission = (prix, typePayment, driverSalaryInput, commissionInput) => {
    const total = parseFloat(prix) || 0;
    if (typePayment === "assurance") {
      const commission = total * COMMISSION_RATE;
      const driverSalary = total - commission;
      return { commission, driverSalary };
    }

    if (typePayment === "societe") {
      const driverSalary = parseFloat(driverSalaryInput || 0);
      const commission = parseFloat(commissionInput || 0);
      return { commission, driverSalary };
    }

    return { commission: 0, driverSalary: 0 };
  };

  const fetchDrivers = async () => {
    const snap = await getDocs(collection(db, "drivers"));
    const data = snap.docs.map((entry) => ({ driverId: entry.id, ...entry.data() }));
    setDrivers(data);
  };

  const fetchTrips = async () => {
    const snap = await getDocs(collection(db, "assuranceTrips"));
    const data = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setTrips(data);
  };

  const fetchPayments = async () => {
    const snap = await getDocs(collection(db, "driverPayments"));
    const data = snap.docs
      .map((entry) => entry.data())
      .filter((payment) => payment.regle && (payment.source || "requests") === PAYMENT_SOURCE);
    setPayments(data);
  };

  useEffect(() => {
    fetchDrivers();
    fetchTrips();
    fetchPayments();
  }, []);

  const handleAddOrUpdateTrip = async (event) => {
    event.preventDefault();

    if (!form.driverId || !form.depart || !form.destination || !form.date || !form.prix || !form.numeroDossier) {
      alert("Remplir tous les champs !");
      return;
    }

    const driver = drivers.find((item) => item.driverId === form.driverId);
    const driverName = driver ? `${driver.firstName} ${driver.lastName}` : "-";
    const { commission, driverSalary } = calculateCommission(
      form.prix,
      form.typePayment || "assurance",
      form.driverSalary,
      form.commission
    );

    const tripData = {
      driverId: form.driverId,
      driverName,
      depart: form.depart,
      destination: form.destination,
      date: form.date,
      kilometrage: form.kilometrage || "",
      prix: parseFloat(form.prix) || 0,
      typePayment: form.typePayment,
      numeroDossier: form.numeroDossier,
      companyName: form.companyName || "",
      driverSalary,
      commission,
      timestamp: serverTimestamp(),
    };

    if (editTripId) {
      await updateDoc(doc(db, "assuranceTrips", editTripId), tripData);
      setEditTripId(null);
    } else {
      await addDoc(collection(db, "assuranceTrips"), tripData);
    }

    setForm({
      driverId: "",
      depart: "",
      destination: "",
      date: "",
      kilometrage: "",
      prix: "",
      typePayment: "assurance",
      numeroDossier: "",
      companyName: "",
      driverSalary: "",
      commission: "",
    });

    await fetchTrips();
  };

  const handleEditTrip = (trip) => {
    setEditTripId(trip.id);
    setForm({
      driverId: trip.driverId,
      depart: trip.depart,
      destination: trip.destination,
      date: trip.date,
      kilometrage: trip.kilometrage || "",
      prix: trip.prix,
      typePayment: trip.typePayment,
      numeroDossier: trip.numeroDossier,
      companyName: trip.companyName || "",
      driverSalary: trip.driverSalary,
      commission: trip.commission,
    });
  };

  const handleDeleteTrip = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette course ?")) return;
    await deleteDoc(doc(db, "assuranceTrips", id));
    await fetchTrips();
  };

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const matchDriver = !selectedDriverFilter || trip.driverId === selectedDriverFilter;
        const matchMonth = !monthFilter || getMonthKey(trip.date) === monthFilter;
        const matchDossier =
          !numeroDossierFilter ||
          String(trip.numeroDossier || "").toLowerCase().includes(numeroDossierFilter.toLowerCase());
        const matchType = !typeFilter || trip.typePayment === typeFilter;
        return matchDriver && matchMonth && matchDossier && matchType;
      }),
    [trips, selectedDriverFilter, monthFilter, numeroDossierFilter, typeFilter]
  );

  const monthlyDriverSalary = useMemo(() => {
    const grouped = {};
    const visibleDriverIds = new Set();

    filteredTrips.forEach((trip) => {
      const key = getMonthKey(trip.date);
      grouped[key] = (grouped[key] || 0) + (Number(trip.driverSalary) || 0);
      if (trip.driverId) {
        visibleDriverIds.add(trip.driverId);
      }
    });

    const paidByMonth = {};
    payments.forEach((payment) => {
      if (!visibleDriverIds.has(payment.driverId)) return;
      const month = `${payment.year}-${String(payment.month).padStart(2, "0")}`;
      if (!grouped[month]) return;
      paidByMonth[month] = (paidByMonth[month] || 0) + (Number(payment.amount) || 0);
    });

    return Object.entries(grouped)
      .sort(([first], [second]) => second.localeCompare(first))
      .map(([month, total]) => {
        const paid = paidByMonth[month] || 0;
        return {
          month,
          total,
          paid,
          remaining: Math.max(total - paid, 0),
          isPaid: paid >= total && total > 0,
        };
      });
  }, [filteredTrips, payments]);

  const totalCommission = filteredTrips.reduce((sum, trip) => sum + (Number(trip.commission) || 0), 0);
  const totalDriverSalary = filteredTrips.reduce((sum, trip) => sum + (Number(trip.driverSalary) || 0), 0);
  const paidTotal = monthlyDriverSalary.reduce((sum, entry) => sum + entry.paid, 0);
  const remainingTotal = Math.max(totalDriverSalary - paidTotal, 0);

  const payDriverMonth = async (month, amount) => {
    if (!selectedDriverFilter) {
      alert("Choisir un conducteur d'abord.");
      return;
    }

    const amountToPay = Number(amount) || 0;
    if (amountToPay <= 0) return;

    const [year, monthNumber] = month.split("-");
    if (!window.confirm(`Payer ${formatMoney(amountToPay)} pour ${month} ?`)) return;

    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriverFilter,
      source: PAYMENT_SOURCE,
      month: monthNumber,
      year: Number(year),
      amount: amountToPay,
      regle: true,
      paidAt: serverTimestamp(),
    });

    await fetchPayments();
  };

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Assurance / Societe</h2>
          <p className="page-subtitle">Gestion des courses B2B, paiements chauffeur et suivi des dossiers.</p>
        </div>
      </div>

      <div className="panel-card mb-4">
        <form className="row g-3" onSubmit={handleAddOrUpdateTrip}>
          <div className="col-md-3">
            <select
              className="form-select"
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            >
              <option value="">Choisir conducteur</option>
              {drivers.map((driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Depart"
              value={form.depart}
              onChange={(e) => setForm({ ...form, depart: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              className="form-control"
              placeholder="Destination"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              type="date"
              className="form-control"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div className="col-md-1">
            <input
              type="number"
              className="form-control"
              placeholder="Km"
              value={form.kilometrage}
              onChange={(e) => setForm({ ...form, kilometrage: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              type="number"
              className="form-control"
              placeholder="Prix"
              value={form.prix}
              onChange={(e) => setForm({ ...form, prix: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              type="text"
              className="form-control"
              placeholder="Numero Dossier"
              value={form.numeroDossier}
              onChange={(e) => setForm({ ...form, numeroDossier: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <input
              type="text"
              className="form-control"
              placeholder="Nom Societe"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
          <div className="col-md-2">
            <select
              className="form-select"
              value={form.typePayment}
              onChange={(e) => setForm({ ...form, typePayment: e.target.value })}
            >
              <option value="assurance">Assurance</option>
              <option value="societe">Societe</option>
            </select>
          </div>
          {form.typePayment === "societe" && (
            <>
              <div className="col-md-2">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Salaire Chauffeur"
                  value={form.driverSalary}
                  onChange={(e) => setForm({ ...form, driverSalary: e.target.value })}
                />
              </div>
              <div className="col-md-2">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Votre Gain"
                  value={form.commission}
                  onChange={(e) => setForm({ ...form, commission: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="col-12">
            <button className="btn btn-primary">{editTripId ? "Enregistrer" : "Ajouter"}</button>
          </div>
        </form>
      </div>

      <div className="panel-card mb-4">
        <div className="row g-3">
          <div className="col-md-3">
            <select
              className="form-select"
              value={selectedDriverFilter}
              onChange={(e) => setSelectedDriverFilter(e.target.value)}
            >
              <option value="">Tous les conducteurs</option>
              {drivers.map((driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <input
              type="month"
              className="form-control"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Filtrer par numero de dossier"
              value={numeroDossierFilter}
              onChange={(e) => setNumeroDossierFilter(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Tous les types</option>
              <option value="assurance">Assurance</option>
              <option value="societe">Societe</option>
            </select>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="metric-card">
            <span className="metric-label">Courses filtrees</span>
            <strong className="metric-value">{filteredTrips.length}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card">
            <span className="metric-label">Benefice</span>
            <strong className="metric-value">{formatMoney(totalCommission)}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card metric-card--success">
            <span className="metric-label">Paye chauffeur</span>
            <strong className="metric-value">{formatMoney(paidTotal)}</strong>
          </div>
        </div>
        <div className="col-md-3">
          <div className="metric-card metric-card--danger">
            <span className="metric-label">Reste a payer</span>
            <strong className="metric-value">{formatMoney(remainingTotal)}</strong>
          </div>
        </div>
      </div>

      <div className="panel-card mb-4">
        <h5 className="section-title">Paiement chauffeur par mois</h5>
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Salaire du chauffeur</th>
                <th>Deja paye</th>
                <th>Reste</th>
                <th>Etat</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {monthlyDriverSalary.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">
                    Aucun mois a afficher.
                  </td>
                </tr>
              ) : (
                monthlyDriverSalary.map((entry) => (
                  <tr key={entry.month}>
                    <td>{entry.month}</td>
                    <td>{formatMoney(entry.total)}</td>
                    <td>{formatMoney(entry.paid)}</td>
                    <td>{formatMoney(entry.remaining)}</td>
                    <td>
                      <span className={`badge ${entry.isPaid ? "bg-success" : "bg-warning text-dark"}`}>
                        {entry.isPaid ? "Paye" : "Non paye"}
                      </span>
                    </td>
                    <td>
                      {!entry.isPaid && selectedDriverFilter ? (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => payDriverMonth(entry.month, entry.remaining)}
                        >
                          Payer le reste
                        </button>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel-card">
        <h5 className="section-title">Courses B2B</h5>
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Conducteur</th>
                <th>Date</th>
                <th>Depart</th>
                <th>Destination</th>
                <th>Prix</th>
                <th>Type</th>
                <th>Numero Dossier</th>
                <th>Nom Societe</th>
                <th>Commission</th>
                <th>Salaire Chauffeur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => (
                <tr key={trip.id}>
                  <td>{trip.driverName}</td>
                  <td>{new Date(trip.date).toLocaleDateString("fr-FR")}</td>
                  <td>{trip.depart}</td>
                  <td>{trip.destination}</td>
                  <td>{formatMoney(trip.prix)}</td>
                  <td>{trip.typePayment}</td>
                  <td>{trip.numeroDossier}</td>
                  <td>{trip.companyName || "-"}</td>
                  <td>{formatMoney(trip.commission)}</td>
                  <td>{formatMoney(trip.driverSalary)}</td>
                  <td>
                    <button className="btn btn-warning btn-sm me-2" onClick={() => handleEditTrip(trip)}>
                      Modifier
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTrip(trip.id)}>
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
