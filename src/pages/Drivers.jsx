import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

// 🔹 Formatter sûr pour JSX
const formatField = (value) => {
  if (value === null || value === undefined) return "-";
  if (value?.toDate) return value.toDate().toLocaleDateString("fr-FR");
  if (Array.isArray(value)) return value.map(v => formatField(v)).join(", ");
  if (typeof value === "object") return "-";
  return String(value);
};

// 🔹 Helper pour clé mois (YYYY-MM)
const getMonthKey = (date) => {
  const d = date?.toDate ? date.toDate() : new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

export default function Drivers() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    totalCommission: 0,
    monthlyCommission: {}
  });

  const [newDriver, setNewDriver] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    wilaya: "",
    region: "",
    trucks: 1
  });

  const [paidByMonth, setPaidByMonth] = useState({});
  const [paidTotal, setPaidTotal] = useState(0);

  const [monthFilter, setMonthFilter] = useState(""); // YYYY-MM

  // 🔹 Récupérer les conducteurs
  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      const data = snapshot.docs.map(d => ({ driverId: d.id, ...d.data() }));
      setDrivers(data);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du chargement des conducteurs");
    }
  };

  useEffect(() => { fetchDrivers(); }, []);

  // 🔹 Ajouter conducteur
  const handleAddDriver = async () => {
    if (!newDriver.firstName.trim() || !newDriver.wilaya.trim()) {
      alert("Le prénom et la wilaya sont obligatoires");
      return;
    }
    try {
      const ref = await addDoc(collection(db, "drivers"), newDriver);
      setDrivers(prev => [...prev, { driverId: ref.id, ...newDriver }]);
      setNewDriver({ firstName: "", lastName: "", phone: "", wilaya: "", region: "", trucks: 1 });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du conducteur");
    }
  };

  // 🔹 Supprimer conducteur
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur et ses demandes ?")) return;
    try {
      await deleteDoc(doc(db, "drivers", driverId));
      const q = query(collection(db, "requests"), where("driverId", "==", driverId));
      const snap = await getDocs(q);
      for (const t of snap.docs) await deleteDoc(doc(db, "requests", t.id));
      setDrivers(prev => prev.filter(d => d.driverId !== driverId));
      if (selectedDriver?.driverId === driverId) setSelectedDriver(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  // 🔹 Récupérer الدفوعات المدفوعة
  const fetchPaidCommissions = async (driverId) => {
    const q = query(collection(db, "driverPayments"), where("driverId", "==", driverId));
    const snap = await getDocs(q);
    const payments = snap.docs.map(d => d.data());

    let totalPaid = 0;
    const paidMonthMap = {};

    payments.forEach(p => {
      if (p.regle) {
        const key = `${p.year}-${p.month}`;
        paidMonthMap[key] = (paidMonthMap[key] || 0) + (p.amount || 0);
        totalPaid += p.amount || 0;
      }
    });

    setPaidByMonth(paidMonthMap);
    setPaidTotal(totalPaid);
  };

  // 🔹 Récupérer les trajets confirmés d’un conducteur
  const fetchDriverTrips = async (driver) => {
    setSelectedDriver(driver);

    const q = query(
      collection(db, "requests"),
      where("driverId", "==", driver.driverId),
      where("status", "==", "Confirmé")
    );

    const snap = await getDocs(q);
    const tripsData = snap.docs.map(d => {
      const t = d.data();
      const price = Number(t.prix) || 0;
      const commission = price * COMMISSION_RATE;
      const km = Number(t.kilometrage) || 0;
      const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return { id: d.id, ...t, price, km, commission, date };
    });

    // 🔹 Appliquer filtre mois si défini
    let filteredTrips = tripsData;
    if (monthFilter) {
      filteredTrips = tripsData.filter(t => getMonthKey(t.date) === monthFilter);
    }

    // 🔹 Calcul stats après filtre
    const stats = filteredTrips.reduce(
      (acc, t) => {
        acc.totalTrips += 1;
        acc.totalCommission += t.commission;

        const month = getMonthKey(t.date);
        acc.monthlyCommission[month] = (acc.monthlyCommission[month] || 0) + t.commission;

        return acc;
      },
      { totalTrips: 0, totalCommission: 0, monthlyCommission: {} }
    );

    setDriverTrips(filteredTrips);
    setDriverStats(stats);

    await fetchPaidCommissions(driver.driverId);
  };

  // 🔹 Payer commission شهر
  const payMonthCommission = async (month, amount) => {
    const [yearStr, monthStr] = month.split("-");
    if (!window.confirm(`Régler ${amount} DA pour ${month} ?`)) return;

    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      month: monthStr,
      year: Number(yearStr),
      amount,
      regle: true,
      paidAt: serverTimestamp()
    });

    fetchDriverTrips(selectedDriver);
  };

  return (
    <div className="container mt-3">
      <h2>Liste des conducteurs</h2>

      {/* ➕ Ajouter conducteur */}
      <div className="mb-4 row g-2">
        {["firstName", "lastName", "phone", "wilaya", "region"].map((f, i) => (
          <div key={i} className="col-md-2">
            <input
              className="form-control"
              placeholder={f}
              value={newDriver[f]}
              onChange={e => setNewDriver({ ...newDriver, [f]: e.target.value })}
            />
          </div>
        ))}
        <div className="col-md-1">
          <input
            type="number"
            className="form-control"
            value={newDriver.trucks}
            onChange={e => setNewDriver({ ...newDriver, trucks: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="col-md-1">
          <button className="btn btn-success w-100" onClick={handleAddDriver}>Ajouter</button>
        </div>
      </div>

      {/* 👥 Liste des conducteurs */}
      <div className="row">
        {drivers.map(d => {
          const driverTripsCount = driverTrips.filter(t => t.driverId === d.driverId).length;
          return (
            <div key={d.driverId} className="col-md-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h5>{formatField(d.firstName)} {formatField(d.lastName)}</h5>
                  <p>Téléphone: {formatField(d.phone)}</p>
                  <p>Wilaya: {formatField(d.wilaya)} | Région: {formatField(d.region)}</p>
                  <p>Camions: {formatField(d.trucks)} | Trajets: {driverTripsCount}</p>
                  <div className="d-flex gap-2">
                    <button className="btn btn-info" onClick={() => fetchDriverTrips(d)}>Détails</button>
                    <button className="btn btn-danger" onClick={() => handleDeleteDriver(d.driverId)}>Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 📊 Détails conducteur */}
      {selectedDriver && (
        <div className="mt-4">
          <h3>Détails de {formatField(selectedDriver.firstName)} {formatField(selectedDriver.lastName)}</h3>
          <button className="btn btn-secondary mb-2" onClick={() => setSelectedDriver(null)}>Retour</button>

          {/* Filtrer par mois */}
          <div className="mb-3 row">
            <div className="col-md-3">
              <label className="form-label">Filtrer par mois</label>
              <input
                type="month"
                className="form-control"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Résumé commission */}
          <div className="row mb-3">
            <div className="col-md-4">
              <div className="card p-3 text-center">
                <h6>Commission Totale</h6>
                <h4>{driverStats.totalCommission} DA</h4>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-3 text-center bg-success text-white">
                <h6>Commission Payée</h6>
                <h4>{paidTotal} DA</h4>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card p-3 text-center bg-danger text-white">
                <h6>Commission Restante</h6>
                <h4>{driverStats.totalCommission - paidTotal} DA</h4>
              </div>
            </div>
          </div>

          {/* Commission Mensuelle */}
          <h5>📆 Commission Mensuelle</h5>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Montant</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(driverStats.monthlyCommission).map(([month, val]) => {
                const paidAmount = paidByMonth[month] || 0;
                const isPaid = paidAmount >= val;

                return (
                  <tr key={month}>
                    <td>{month}</td>
                    <td><b>{val} DA</b></td>
                    <td>
                      {isPaid
                        ? <span className="badge bg-success">RÉGLÉ</span>
                        : <span className="badge bg-warning text-dark">À PAYER</span>}
                    </td>
                    <td>
                      {!isPaid && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => payMonthCommission(month, val)}
                        >
                          Régler
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Tableau des trajets */}
          <table className="table table-bordered mt-2">
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
              {driverTrips.map(t => (
                <tr key={t.id}>
                  <td>{formatField(t.date)}</td>
                  <td>{formatField(t.depart)}</td>
                  <td>{formatField(t.destination)}</td>
                  <td>{t.km}</td>
                  <td>{t.price} DA</td>
                  <td>{t.commission} DA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
