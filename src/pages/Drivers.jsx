import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;
const PAYMENT_SOURCE = "requests";

const parseDate = (trip) => {
  if (trip?.date?.toDate) return trip.date.toDate();
  if (trip?.date instanceof Date) return trip.date;
  if (typeof trip?.date === "string") {
    const parsed = new Date(trip.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (trip?.timestamp?.toDate) return trip.timestamp.toDate();
  return null;
};

const formatField = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
  if (value?.toDate) return value.toDate().toLocaleDateString("fr-FR");
  if (Array.isArray(value)) return value.map((entry) => formatField(entry)).join(", ");
  if (typeof value === "object") return "-";
  return String(value);
};

const getMonthKey = (date) => {
  if (!date) return null;
  const value = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
};

const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DA`;
const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");

const emptyDriver = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  region: "",
  trucks: 1,
};

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    totalCommission: 0,
    monthlyCommission: {},
  });
  const [paymentByMonth, setPaymentByMonth] = useState({});
  const [newDriver, setNewDriver] = useState(emptyDriver);
  const [editingDriverId, setEditingDriverId] = useState("");
  const [editDriverForm, setEditDriverForm] = useState(emptyDriver);
  const [monthFilter, setMonthFilter] = useState("");

  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      const data = snapshot.docs.map((entry) => ({ driverId: entry.id, ...entry.data() }));
      setDrivers(data);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du chargement des conducteurs");
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleAddDriver = async () => {
    if (!newDriver.firstName.trim() || !newDriver.wilaya.trim()) {
      alert("Le prenom et la wilaya sont obligatoires");
      return;
    }

    try {
      const ref = await addDoc(collection(db, "drivers"), newDriver);
      setDrivers((prev) => [...prev, { driverId: ref.id, ...newDriver }]);
      setNewDriver(emptyDriver);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du conducteur");
    }
  };

  const startEditDriver = (driver) => {
    setEditingDriverId(driver.driverId);
    setEditDriverForm({
      firstName: driver.firstName || "",
      lastName: driver.lastName || "",
      phone: driver.phone || "",
      wilaya: driver.wilaya || "",
      region: driver.region || "",
      trucks: Number(driver.trucks) || 1,
    });
  };

  const saveDriverEdit = async () => {
    if (!editingDriverId) return;

    try {
      await updateDoc(doc(db, "drivers", editingDriverId), {
        ...editDriverForm,
        trucks: Number(editDriverForm.trucks) || 1,
      });

      setDrivers((prev) =>
        prev.map((driver) =>
          driver.driverId === editingDriverId
            ? { ...driver, ...editDriverForm, trucks: Number(editDriverForm.trucks) || 1 }
            : driver
        )
      );

      if (selectedDriver?.driverId === editingDriverId) {
        setSelectedDriver((prev) => ({ ...prev, ...editDriverForm, trucks: Number(editDriverForm.trucks) || 1 }));
      }

      setEditingDriverId("");
      setEditDriverForm(emptyDriver);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la modification du conducteur");
    }
  };

  const cancelDriverEdit = () => {
    setEditingDriverId("");
    setEditDriverForm(emptyDriver);
  };

  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur et ses demandes ?")) return;

    try {
      await deleteDoc(doc(db, "drivers", driverId));
      const requestsQuery = query(collection(db, "requests"), where("driverId", "==", driverId));
      const snap = await getDocs(requestsQuery);

      for (const trip of snap.docs) {
        await deleteDoc(doc(db, "requests", trip.id));
      }

      setDrivers((prev) => prev.filter((driver) => driver.driverId !== driverId));
      if (selectedDriver?.driverId === driverId) {
        setSelectedDriver(null);
        setAllTrips([]);
        setDriverTrips([]);
        setPaymentByMonth({});
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  const fetchPaidCommissions = async (driverId) => {
    const paymentsQuery = query(collection(db, "driverPayments"), where("driverId", "==", driverId));
    const snap = await getDocs(paymentsQuery);
    const paidMonthMap = {};

    snap.docs.forEach((entry) => {
      const payment = entry.data();
      const source = payment.source || "requests";
      if (!payment.regle || source !== PAYMENT_SOURCE) return;

      const key = `${payment.year}-${String(payment.month).padStart(2, "0")}`;
      paidMonthMap[key] = (paidMonthMap[key] || 0) + (Number(payment.amount) || 0);
    });

    setPaymentByMonth(paidMonthMap);
  };

  const filterTripsByMonth = (trips, month) => {
    const filtered = month ? trips.filter((trip) => getMonthKey(trip.date) === month) : trips;

    const stats = filtered.reduce(
      (acc, trip) => {
        if (!trip.date) return acc;
        acc.totalTrips += 1;
        acc.totalCommission += trip.commission;
        const monthKey = getMonthKey(trip.date);
        acc.monthlyCommission[monthKey] = (acc.monthlyCommission[monthKey] || 0) + trip.commission;
        return acc;
      },
      { totalTrips: 0, totalCommission: 0, monthlyCommission: {} }
    );

    setDriverTrips(filtered);
    setDriverStats(stats);
  };

  const fetchDriverTrips = async (driver) => {
    setSelectedDriver(driver);

    const requestsQuery = query(collection(db, "requests"), where("driverId", "==", driver.driverId));
    const snap = await getDocs(requestsQuery);

    const tripsData = snap.docs
      .map((entry) => {
        const trip = entry.data();
        const date = parseDate(trip);
        const price = Number(trip.prix) || 0;
        const commission = price * COMMISSION_RATE;
        const km = Number(trip.kilometrage) || 0;
        return {
          id: entry.id,
          ...trip,
          date,
          price,
          km,
          commission,
          status: trip.status || trip.dispatch || "En attente",
        };
      })
      .filter((trip) => isConfirmedStatus(trip.status));

    setAllTrips(tripsData);
    filterTripsByMonth(tripsData, monthFilter);
    await fetchPaidCommissions(driver.driverId);
  };

  const payMonthCommission = async (month, amount) => {
    if (!selectedDriver) return;
    const amountToPay = Number(amount) || 0;
    if (amountToPay <= 0) return;

    const [yearStr, monthStr] = month.split("-");
    if (!window.confirm(`Regler ${formatMoney(amountToPay)} pour ${month} ?`)) return;

    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      source: PAYMENT_SOURCE,
      month: monthStr,
      year: Number(yearStr),
      amount: amountToPay,
      regle: true,
      paidAt: serverTimestamp(),
    });

    await fetchPaidCommissions(selectedDriver.driverId);
  };

  const undoMonthPayment = async (month) => {
    if (!selectedDriver) return;
    if (!window.confirm(`Annuler le paiement pour ${month} ?`)) return;

    const [yearStr, monthStr] = month.split("-");
    const paymentsQuery = query(
      collection(db, "driverPayments"),
      where("driverId", "==", selectedDriver.driverId),
      where("year", "==", Number(yearStr)),
      where("month", "==", monthStr),
      where("regle", "==", true)
    );

    const snap = await getDocs(paymentsQuery);
    for (const entry of snap.docs) {
      const payment = entry.data();
      const source = payment.source || "requests";
      if (source === PAYMENT_SOURCE) {
        await deleteDoc(doc(db, "driverPayments", entry.id));
      }
    }

    await fetchPaidCommissions(selectedDriver.driverId);
  };

  useEffect(() => {
    if (selectedDriver) {
      filterTripsByMonth(allTrips, monthFilter);
    }
  }, [monthFilter, allTrips, selectedDriver]);

  const monthlyRows = useMemo(
    () =>
      Object.entries(driverStats.monthlyCommission)
        .sort(([first], [second]) => second.localeCompare(first))
        .map(([month, total]) => {
          const paidAmount = paymentByMonth[month] || 0;
          return {
            month,
            total,
            paidAmount,
            remaining: Math.max(total - paidAmount, 0),
            isPaid: paidAmount >= total && total > 0,
          };
        }),
    [driverStats.monthlyCommission, paymentByMonth]
  );

  const paidTotal = monthlyRows.reduce((sum, row) => sum + row.paidAmount, 0);
  const remainingTotal = Math.max(driverStats.totalCommission - paidTotal, 0);

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Conducteurs</h2>
          <p className="page-subtitle">Suivi des commissions, paiements, soldes et edition des fiches chauffeur.</p>
        </div>
      </div>

      <div className="panel-card mb-4">
        <div className="row g-2">
          {["firstName", "lastName", "phone", "wilaya", "region"].map((field) => (
            <div key={field} className="col-md-2">
              <input
                className="form-control"
                placeholder={field}
                value={newDriver[field]}
                onChange={(e) => setNewDriver({ ...newDriver, [field]: e.target.value })}
              />
            </div>
          ))}
          <div className="col-md-1">
            <input
              type="number"
              className="form-control"
              value={newDriver.trucks}
              onChange={(e) => setNewDriver({ ...newDriver, trucks: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="col-md-1">
            <button className="btn btn-success w-100" onClick={handleAddDriver}>
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {drivers.map((driver) => (
          <div key={driver.driverId} className="col-md-4">
            <div className="panel-card h-100">
              {editingDriverId === driver.driverId ? (
                <>
                  <div className="row g-2 mb-3">
                    {["firstName", "lastName", "phone", "wilaya", "region"].map((field) => (
                      <div key={field} className="col-6">
                        <input
                          className="form-control"
                          value={editDriverForm[field]}
                          onChange={(e) => setEditDriverForm({ ...editDriverForm, [field]: e.target.value })}
                        />
                      </div>
                    ))}
                    <div className="col-6">
                      <input
                        type="number"
                        className="form-control"
                        value={editDriverForm.trucks}
                        onChange={(e) =>
                          setEditDriverForm({ ...editDriverForm, trucks: Number(e.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-success btn-sm" onClick={saveDriverEdit}>
                      Enregistrer
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={cancelDriverEdit}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h5 className="mb-3">
                    {formatField(driver.firstName)} {formatField(driver.lastName)}
                  </h5>
                  <p className="mb-2">Telephone: {formatField(driver.phone)}</p>
                  <p className="mb-2">
                    Wilaya: {formatField(driver.wilaya)} | Region: {formatField(driver.region)}
                  </p>
                  <p className="mb-3">Camions: {formatField(driver.trucks)}</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-info btn-sm" onClick={() => fetchDriverTrips(driver)}>
                      Details
                    </button>
                    <button className="btn btn-warning btn-sm" onClick={() => startEditDriver(driver)}>
                      Modifier
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDriver(driver.driverId)}>
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedDriver && (
        <div className="mt-4">
          <div className="page-header">
            <div>
              <h3 className="page-title">
                Solde de {formatField(selectedDriver.firstName)} {formatField(selectedDriver.lastName)}
              </h3>
              <p className="page-subtitle">Le reste a payer est calcule uniquement sur la periode affichee.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setSelectedDriver(null)}>
              Retour
            </button>
          </div>

          <div className="panel-card mb-4">
            <div className="row">
              <div className="col-md-3">
                <label className="form-label">Filtrer par mois</label>
                <input
                  type="month"
                  className="form-control"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Trajets confirmes</span>
                <strong className="metric-value">{driverStats.totalTrips}</strong>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Commission totale</span>
                <strong className="metric-value">{formatMoney(driverStats.totalCommission)}</strong>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card metric-card--success">
                <span className="metric-label">Commission payee</span>
                <strong className="metric-value">{formatMoney(paidTotal)}</strong>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card metric-card--danger">
                <span className="metric-label">Solde restant</span>
                <strong className="metric-value">{formatMoney(remainingTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="panel-card mb-4">
            <h5 className="section-title">Commission mensuelle</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Montant</th>
                    <th>Deja paye</th>
                    <th>Solde</th>
                    <th>Etat</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>{formatMoney(row.total)}</td>
                      <td>{formatMoney(row.paidAmount)}</td>
                      <td>{formatMoney(row.remaining)}</td>
                      <td>
                        {row.isPaid ? (
                          <span className="badge bg-success">REGLE</span>
                        ) : (
                          <span className="badge bg-warning text-dark">A PAYER</span>
                        )}
                      </td>
                      <td className="d-flex gap-1">
                        {!row.isPaid && (
                          <button className="btn btn-success btn-sm" onClick={() => payMonthCommission(row.month, row.remaining)}>
                            Regler
                          </button>
                        )}
                        {row.paidAmount > 0 && (
                          <button className="btn btn-danger btn-sm" onClick={() => undoMonthPayment(row.month)}>
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card">
            <h5 className="section-title">Liste des trajets</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Depart</th>
                    <th>Destination</th>
                    <th>Km</th>
                    <th>Prix</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {driverTrips.map((trip) => (
                    <tr key={trip.id}>
                      <td>{formatField(trip.date)}</td>
                      <td>{formatField(trip.depart)}</td>
                      <td>{formatField(trip.destination)}</td>
                      <td>{trip.km}</td>
                      <td>{formatMoney(trip.price)}</td>
                      <td>{formatMoney(trip.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
