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
import { logAuditAction } from "../utils/audit";

const COMMISSION_RATE = 0.1;
const emptyDriver = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  region: "",
  trucks: 1,
};

const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DA`;

const parseDate = (value, fallback) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (fallback?.toDate) return fallback.toDate();
  if (fallback instanceof Date) return fallback;
  if (typeof fallback === "string") {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const getMonthKey = (date) => {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatField = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export default function Drivers({ currentUser, adminProfile }) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    totalBenefit: 0,
    totalPayable: 0,
    monthly: {},
  });
  const [paymentByMonth, setPaymentByMonth] = useState({});
  const [newDriver, setNewDriver] = useState(emptyDriver);
  const [editingDriverId, setEditingDriverId] = useState("");
  const [editDriverForm, setEditDriverForm] = useState(emptyDriver);
  const [monthFilter, setMonthFilter] = useState("");
  const [tripTypeFilter, setTripTypeFilter] = useState("");

  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      setDrivers(snapshot.docs.map((entry) => ({ driverId: entry.id, ...entry.data() })));
    } catch (error) {
      console.error(error);
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
      setDrivers((current) => [...current, { driverId: ref.id, ...newDriver }]);
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "create",
        entityType: "driver",
        entityId: ref.id,
        description: `Ajout du chauffeur ${newDriver.firstName} ${newDriver.lastName}`.trim(),
        metadata: { wilaya: newDriver.wilaya, phone: newDriver.phone || "" },
      });
      setNewDriver(emptyDriver);
    } catch (error) {
      console.error(error);
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
      const payload = { ...editDriverForm, trucks: Number(editDriverForm.trucks) || 1 };
      await updateDoc(doc(db, "drivers", editingDriverId), payload);
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "update",
        entityType: "driver",
        entityId: editingDriverId,
        description: `Modification du chauffeur ${payload.firstName} ${payload.lastName}`.trim(),
        metadata: { wilaya: payload.wilaya, phone: payload.phone || "" },
      });

      setDrivers((current) =>
        current.map((driver) => (driver.driverId === editingDriverId ? { ...driver, ...payload } : driver))
      );
      if (selectedDriver?.driverId === editingDriverId) {
        setSelectedDriver((current) => ({ ...current, ...payload }));
      }

      setEditingDriverId("");
      setEditDriverForm(emptyDriver);
    } catch (error) {
      console.error(error);
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
      const deletedDriver = drivers.find((driver) => driver.driverId === driverId);
      await deleteDoc(doc(db, "drivers", driverId));
      const [requestsSnap, assuranceSnap] = await Promise.all([
        getDocs(query(collection(db, "requests"), where("driverId", "==", driverId))),
        getDocs(query(collection(db, "assuranceTrips"), where("driverId", "==", driverId))),
      ]);

      for (const trip of requestsSnap.docs) {
        await deleteDoc(doc(db, "requests", trip.id));
      }

      await logAuditAction({
        currentUser,
        adminProfile,
        action: "delete",
        entityType: "driver",
        entityId: driverId,
        description: `Suppression du chauffeur ${deletedDriver?.firstName || ""} ${deletedDriver?.lastName || ""}`.trim(),
        metadata: {},
      });
      for (const trip of assuranceSnap.docs) {
        await deleteDoc(doc(db, "assuranceTrips", trip.id));
      }

      setDrivers((current) => current.filter((driver) => driver.driverId !== driverId));
      if (selectedDriver?.driverId === driverId) {
        setSelectedDriver(null);
        setAllTrips([]);
        setDriverTrips([]);
        setPaymentByMonth({});
      }
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression");
    }
  };

  const buildPaymentByMonth = (paymentDocs) => {
    const grouped = {};
    paymentDocs.forEach((entry) => {
      const payment = entry.data();
      if (!payment.regle) return;
      const key = `${payment.year}-${String(payment.month).padStart(2, "0")}`;
      grouped[key] = grouped[key] || {
        total: 0,
        particulier: 0,
        assurance: 0,
        societe: 0,
      };
      const tripType =
        payment.tripType ||
        (payment.source === "requests" ? "particulier" : payment.source === "assuranceTrips" ? "assurance" : "");
      grouped[key].total += Number(payment.amount) || 0;
      if (tripType && grouped[key][tripType] !== undefined) {
        grouped[key][tripType] += Number(payment.amount) || 0;
      }
    });
    setPaymentByMonth(grouped);
  };

  const filterTripsByMonth = (trips, month, tripType = "") => {
    const filtered = trips.filter((trip) => {
      const matchMonth = month ? getMonthKey(trip.date) === month : true;
      const matchType = tripType ? trip.tripType === tripType : true;
      return matchMonth && matchType;
    });

    const stats = filtered.reduce(
      (acc, trip) => {
        if (!trip.date) return acc;
        const monthKey = getMonthKey(trip.date);
        acc.totalTrips += 1;
        acc.totalBenefit += trip.commission;
        acc.totalPayable += trip.payableAmount;
        acc.monthly[monthKey] = acc.monthly[monthKey] || {
          benefit: 0,
          payable: 0,
          particulier: 0,
          assurance: 0,
          societe: 0,
          payableParticulier: 0,
          payableAssurance: 0,
          payableSociete: 0,
        };
        acc.monthly[monthKey].benefit += trip.commission;
        acc.monthly[monthKey].payable += trip.payableAmount;
        acc.monthly[monthKey][trip.tripType] += trip.commission;
        if (trip.tripType === "particulier") acc.monthly[monthKey].payableParticulier += trip.payableAmount;
        if (trip.tripType === "assurance") acc.monthly[monthKey].payableAssurance += trip.payableAmount;
        if (trip.tripType === "societe") acc.monthly[monthKey].payableSociete += trip.payableAmount;
        return acc;
      },
      { totalTrips: 0, totalBenefit: 0, totalPayable: 0, monthly: {} }
    );

    setDriverTrips(filtered);
    setDriverStats(stats);
  };

  const fetchDriverTrips = async (driver) => {
    setSelectedDriver(driver);

    const [requestsSnap, assuranceSnap, paymentsSnap] = await Promise.all([
      getDocs(query(collection(db, "requests"), where("driverId", "==", driver.driverId))),
      getDocs(query(collection(db, "assuranceTrips"), where("driverId", "==", driver.driverId))),
      getDocs(query(collection(db, "driverPayments"), where("driverId", "==", driver.driverId))),
    ]);

    const requestTrips = requestsSnap.docs
      .map((entry) => {
        const trip = entry.data();
        const date = parseDate(trip.date, trip.createdAt || trip.timestamp);
        const price = Number(trip.prix) || 0;
        const commission = price * COMMISSION_RATE;
        return {
          id: entry.id,
          tripType: "particulier",
          paymentSource: "requests",
          date,
          depart: trip.depart || "-",
          destination: trip.destination || "-",
          km: Number(trip.kilometrage) || 0,
          price,
          commission,
          payableAmount: commission,
          status: trip.status || "En cours",
          companyName: "",
          numeroDossier: "",
        };
      })
      .filter((trip) => isConfirmedStatus(trip.status));

    const assuranceTrips = assuranceSnap.docs
      .map((entry) => {
        const trip = entry.data();
        const date = parseDate(trip.date, trip.timestamp || trip.createdAt);
        const price = Number(trip.prix) || 0;
        const tripType = trip.typePayment === "societe" ? "societe" : "assurance";
        return {
          id: entry.id,
          tripType,
          paymentSource: "assuranceTrips",
          date,
          depart: trip.depart || "-",
          destination: trip.destination || "-",
          km: Number(trip.kilometrage) || 0,
          price,
          commission: Number(trip.commission) || 0,
          payableAmount: Number(trip.driverSalary) || 0,
          status: trip.status || "En cours",
          companyName: trip.companyName || "",
          numeroDossier: trip.numeroDossier || "",
        };
      })
      .filter((trip) => isConfirmedStatus(trip.status));

    const mergedTrips = [...requestTrips, ...assuranceTrips].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    setAllTrips(mergedTrips);
    filterTripsByMonth(mergedTrips, monthFilter, tripTypeFilter);
    buildPaymentByMonth(paymentsSnap.docs);
  };

  useEffect(() => {
    if (selectedDriver) {
      filterTripsByMonth(allTrips, monthFilter, tripTypeFilter);
    }
  }, [monthFilter, tripTypeFilter, allTrips, selectedDriver]);

  const monthlyRows = useMemo(
    () =>
      Object.entries(driverStats.monthly)
        .sort(([first], [second]) => second.localeCompare(first))
        .map(([month, values]) => {
          const paidAmount = paymentByMonth[month] || 0;
          return {
            month,
            ...values,
            paidAmount: paidAmount.total || 0,
            paidParticulier: paidAmount.particulier || 0,
            paidAssurance: paidAmount.assurance || 0,
            paidSociete: paidAmount.societe || 0,
            remainingParticulier: Math.max(values.payableParticulier - (paidAmount.particulier || 0), 0),
            remainingAssurance: Math.max(values.payableAssurance - (paidAmount.assurance || 0), 0),
            remainingSociete: Math.max(values.payableSociete - (paidAmount.societe || 0), 0),
            remaining: Math.max(values.payable - (paidAmount.total || 0), 0),
            isPaid: (paidAmount.total || 0) >= values.payable && values.payable > 0,
          };
        }),
    [driverStats.monthly, paymentByMonth]
  );

  const paidTotal = monthlyRows.reduce((sum, row) => sum + row.paidAmount, 0);
  const remainingTotal = Math.max(driverStats.totalPayable - paidTotal, 0);
  const typeTotals = useMemo(
    () =>
      driverTrips.reduce(
        (acc, trip) => {
          acc[trip.tripType] += trip.commission;
          return acc;
        },
        { particulier: 0, assurance: 0, societe: 0 }
      ),
    [driverTrips]
  );

  const handleMonthPayment = async (month, tripType) => {
    if (!selectedDriver) return;

    const monthTrips = allTrips.filter((trip) => getMonthKey(trip.date) === month && trip.tripType === tripType);
    if (monthTrips.length === 0) return;

    const source = tripType === "particulier" ? "requests" : "assuranceTrips";
    const actionType = tripType === "particulier" ? "collect" : "payout";
    const amountDue = monthTrips.reduce((sum, trip) => sum + trip.payableAmount, 0);
    const paidForType = paymentByMonth[month]?.[tripType] || 0;
    const remaining = Math.max(amountDue - paidForType, 0);
    if (remaining <= 0) return;
    if (
      !window.confirm(
        `${tripType === "particulier" ? "Encaisser" : "Payer"} ${formatMoney(remaining)} pour ${tripType} sur ${month} ?`
      )
    ) {
      return;
    }

    const [yearStr, monthStr] = month.split("-");
    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      source,
      tripType,
      actionType,
      month: monthStr,
      year: Number(yearStr),
      amount: remaining,
      regle: true,
      paidAt: serverTimestamp(),
    });
    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${month}-${tripType}`,
      description: `${tripType === "particulier" ? "Encaissement" : "Paiement"} ${tripType} pour ${month}`,
      metadata: { driverId: selectedDriver.driverId, month, tripType, amount: remaining, actionType },
    });

    const paymentsSnap = await getDocs(query(collection(db, "driverPayments"), where("driverId", "==", selectedDriver.driverId)));
    buildPaymentByMonth(paymentsSnap.docs);
  };

  const undoMonthPayment = async (month, tripType) => {
    if (!selectedDriver) return;
    if (!window.confirm(`Annuler l'action ${tripType} pour ${month} ?`)) return;

    const [yearStr, monthStr] = month.split("-");
    const paymentsSnap = await getDocs(
      query(
        collection(db, "driverPayments"),
        where("driverId", "==", selectedDriver.driverId),
        where("year", "==", Number(yearStr)),
        where("month", "==", monthStr),
        where("tripType", "==", tripType),
        where("regle", "==", true)
      )
    );

    for (const entry of paymentsSnap.docs) {
      await deleteDoc(doc(db, "driverPayments", entry.id));
    }
    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment_cancel",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${month}-${tripType}`,
      description: `Annulation action ${tripType} pour ${month}`,
      metadata: { driverId: selectedDriver.driverId, month, tripType },
    });

    const refreshedPayments = await getDocs(query(collection(db, "driverPayments"), where("driverId", "==", selectedDriver.driverId)));
    buildPaymentByMonth(refreshedPayments.docs);
  };

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Conducteurs</h2>
          <p className="page-subtitle">Une vue chauffeur unique pour particulier, assurance et societe.</p>
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
                onChange={(event) => setNewDriver({ ...newDriver, [field]: event.target.value })}
              />
            </div>
          ))}
          <div className="col-md-1">
            <input
              type="number"
              className="form-control"
              value={newDriver.trucks}
              onChange={(event) => setNewDriver({ ...newDriver, trucks: Number(event.target.value) || 1 })}
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
                          onChange={(event) => setEditDriverForm({ ...editDriverForm, [field]: event.target.value })}
                        />
                      </div>
                    ))}
                    <div className="col-6">
                      <input
                        type="number"
                        className="form-control"
                        value={editDriverForm.trucks}
                        onChange={(event) =>
                          setEditDriverForm({ ...editDriverForm, trucks: Number(event.target.value) || 1 })
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

      {selectedDriver ? (
        <div className="mt-4">
          <div className="page-header">
            <div>
              <h3 className="page-title">
                Compte chauffeur {formatField(selectedDriver.firstName)} {formatField(selectedDriver.lastName)}
              </h3>
              <p className="page-subtitle">Les courses particulier, assurance et societe sont fusionnees dans ce compte.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => setSelectedDriver(null)}>
              Retour
            </button>
          </div>

          <div className="panel-card mb-4">
            <div className="row">
              <div className="col-md-3">
                <label className="form-label">Filtrer par mois</label>
                <input type="month" className="form-control" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Type de course</label>
                <select className="form-select" value={tripTypeFilter} onChange={(event) => setTripTypeFilter(event.target.value)}>
                  <option value="">Tous</option>
                  <option value="particulier">Particulier</option>
                  <option value="assurance">Assurance</option>
                  <option value="societe">Societe</option>
                </select>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Courses confirmees</span>
                <strong className="metric-value">{driverStats.totalTrips}</strong>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Benefice total</span>
                <strong className="metric-value">{formatMoney(driverStats.totalBenefit)}</strong>
              </div>
            </div>
            <div className="col-md-2">
              <div className="metric-card">
                <span className="metric-label">Particulier</span>
                <strong className="metric-value">{formatMoney(typeTotals.particulier)}</strong>
              </div>
            </div>
            <div className="col-md-2">
              <div className="metric-card">
                <span className="metric-label">Assurance</span>
                <strong className="metric-value">{formatMoney(typeTotals.assurance)}</strong>
              </div>
            </div>
            <div className="col-md-2">
              <div className="metric-card">
                <span className="metric-label">Societe</span>
                <strong className="metric-value">{formatMoney(typeTotals.societe)}</strong>
              </div>
            </div>
            <div className="col-md-2">
              <div className="metric-card metric-card--success">
                <span className="metric-label">Traite</span>
                <strong className="metric-value">{formatMoney(paidTotal)}</strong>
              </div>
            </div>
            <div className="col-md-2">
              <div className="metric-card metric-card--danger">
                <span className="metric-label">Reste global</span>
                <strong className="metric-value">{formatMoney(remainingTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="panel-card mb-4">
            <h5 className="section-title">Paiements par mois</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Benefice</th>
                    <th>Particulier</th>
                    <th>Assurance</th>
                    <th>Societe</th>
                    <th>Commission payee</th>
                    <th>Paiement assurance</th>
                    <th>Paiement societe</th>
                    <th>Traite</th>
                    <th>Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center text-muted py-4">
                        Aucun mois a afficher.
                      </td>
                    </tr>
                  ) : (
                    monthlyRows.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{formatMoney(row.benefit)}</td>
                        <td>{formatMoney(row.particulier)}</td>
                        <td>{formatMoney(row.assurance)}</td>
                        <td>{formatMoney(row.societe)}</td>
                        <td>
                          {row.payableParticulier > 0 ? (
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={row.remainingParticulier <= 0 && row.paidParticulier > 0}
                                onChange={() =>
                                  row.remainingParticulier > 0
                                    ? handleMonthPayment(row.month, "particulier")
                                    : undoMonthPayment(row.month, "particulier")
                                }
                              />
                              <label className="form-check-label small">
                                {row.remainingParticulier > 0 ? "Non payee" : "Payee"}
                              </label>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-2">
                            <span className="small text-muted">
                              {formatMoney(row.paidAssurance)} / {formatMoney(row.payableAssurance)}
                            </span>
                            {row.remainingAssurance > 0 ? (
                              <button className="btn btn-outline-success btn-sm" onClick={() => handleMonthPayment(row.month, "assurance")}>
                                Payer
                              </button>
                            ) : row.paidAssurance > 0 ? (
                              <button className="btn btn-outline-danger btn-sm" onClick={() => undoMonthPayment(row.month, "assurance")}>
                                Annuler
                              </button>
                            ) : (
                              "-"
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-2">
                            <span className="small text-muted">
                              {formatMoney(row.paidSociete)} / {formatMoney(row.payableSociete)}
                            </span>
                            {row.remainingSociete > 0 ? (
                              <button className="btn btn-outline-dark btn-sm" onClick={() => handleMonthPayment(row.month, "societe")}>
                                Payer
                              </button>
                            ) : row.paidSociete > 0 ? (
                              <button className="btn btn-outline-danger btn-sm" onClick={() => undoMonthPayment(row.month, "societe")}>
                                Annuler
                              </button>
                            ) : (
                              "-"
                            )}
                          </div>
                        </td>
                        <td>{formatMoney(row.paidAmount)}</td>
                        <td>{formatMoney(row.remaining)}</td>
                      </tr>
                    ))
                  )}
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
                    <th>Type</th>
                    <th>Depart</th>
                    <th>Destination</th>
                    <th>Km</th>
                    <th>Prix</th>
                    <th>Benefice</th>
                    <th>Dossier / Societe</th>
                  </tr>
                </thead>
                <tbody>
                  {driverTrips.map((trip) => (
                    <tr key={`${trip.tripType}-${trip.id}`}>
                      <td>{trip.date ? trip.date.toLocaleDateString("fr-FR") : "-"}</td>
                      <td>
                        <span
                          className={`badge ${
                            trip.tripType === "particulier"
                              ? "bg-primary"
                              : trip.tripType === "assurance"
                              ? "bg-success"
                              : "bg-dark"
                          }`}
                        >
                          {trip.tripType}
                        </span>
                      </td>
                      <td>{trip.depart}</td>
                      <td>{trip.destination}</td>
                      <td>{trip.km}</td>
                      <td>{formatMoney(trip.price)}</td>
                      <td>{formatMoney(trip.commission)}</td>
                      <td>{trip.companyName || trip.numeroDossier || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
