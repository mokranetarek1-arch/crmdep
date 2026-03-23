import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

// 🔥 FIX date parser
const parseDate = (t) => {
  if (t?.date?.toDate) return t.date.toDate();
  if (t?.date instanceof Date) return t.date;
  if (typeof t?.date === "string") {
    const d = new Date(t.date);
    if (!isNaN(d)) return d;
  }
  if (t?.timestamp?.toDate) return t.timestamp.toDate();
  return null;
};

// 🔹 Formatter
const formatField = (value) => {
  if (value === null || value === undefined) return "-";

  if (value instanceof Date) {
    return value.toLocaleDateString("fr-FR");
  }

  if (value?.toDate) return value.toDate().toLocaleDateString("fr-FR");

  if (Array.isArray(value)) return value.map(v => formatField(v)).join(", ");

  if (typeof value === "object") return "-";

  return String(value);
};

// 🔹 Month key FIX
const getMonthKey = (date) => {
  if (!date) return null;
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
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

  const [monthFilter, setMonthFilter] = useState("");

  // 🔹 fetch drivers
  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      const data = snapshot.docs.map(d => ({
        driverId: d.id,
        ...d.data()
      }));
      setDrivers(data);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du chargement des conducteurs");
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // 🔹 add driver
  const handleAddDriver = async () => {
    if (!newDriver.firstName.trim() || !newDriver.wilaya.trim()) {
      alert("Le prénom et la wilaya sont obligatoires");
      return;
    }
    try {
      const ref = await addDoc(collection(db, "drivers"), newDriver);
      setDrivers(prev => [...prev, { driverId: ref.id, ...newDriver }]);
      setNewDriver({
        firstName: "",
        lastName: "",
        phone: "",
        wilaya: "",
        region: "",
        trucks: 1
      });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du conducteur");
    }
  };

  // 🔹 delete driver
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur et ses demandes ?")) return;
    try {
      await deleteDoc(doc(db, "drivers", driverId));

      const q = query(
        collection(db, "requests"),
        where("driverId", "==", driverId)
      );

      const snap = await getDocs(q);
      for (const t of snap.docs) {
        await deleteDoc(doc(db, "requests", t.id));
      }

      setDrivers(prev => prev.filter(d => d.driverId !== driverId));

      if (selectedDriver?.driverId === driverId) {
        setSelectedDriver(null);
      }

    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  // 🔹 paid commissions
  const fetchPaidCommissions = async (driverId) => {
    const q = query(
      collection(db, "driverPayments"),
      where("driverId", "==", driverId)
    );

    const snap = await getDocs(q);

    let totalPaid = 0;
    const paidMonthMap = {};

    snap.docs.forEach(d => {
      const p = d.data();
      if (p.regle) {
        const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
        paidMonthMap[key] = (paidMonthMap[key] || 0) + (p.amount || 0);
        totalPaid += p.amount || 0;
      }
    });

    setPaidByMonth(paidMonthMap);
    setPaidTotal(totalPaid);
  };

  // 🔥 fetch trips FIXED
  const fetchDriverTrips = async (driver) => {
    setSelectedDriver(driver);

    const q = query(
      collection(db, "requests"),
      where("driverId", "==", driver.driverId)
    );

    const snap = await getDocs(q);

    const tripsData = snap.docs
      .map(d => {
        const t = d.data();

        const date = parseDate(t);

        const price = Number(t.prix) || 0;
        const commission = price * COMMISSION_RATE;
        const km = Number(t.kilometrage) || 0;

        return {
          id: d.id,
          ...t,
          price,
          km,
          commission,
          date,
          status: t.status || t.dispatch || "En attente"
        };
      })
      .filter(t => t.status === "Confirmé");

    let filteredTrips = tripsData;

    if (monthFilter) {
      filteredTrips = tripsData.filter(t => {
        const key = getMonthKey(t.date);
        return key === monthFilter;
      });
    }

    const stats = filteredTrips.reduce(
      (acc, t) => {
        if (!t.date) return acc;

        acc.totalTrips += 1;
        acc.totalCommission += t.commission;

        const month = getMonthKey(t.date);
        if (!acc.monthlyCommission[month]) acc.monthlyCommission[month] = 0;
        acc.monthlyCommission[month] += t.commission;

        return acc;
      },
      { totalTrips: 0, totalCommission: 0, monthlyCommission: {} }
    );

    setDriverTrips(filteredTrips);
    setDriverStats(stats);

    await fetchPaidCommissions(driver.driverId);
  };

  // 🔹 pay month
  const payMonthCommission = async (month, amount) => {
    const [yearStr, monthStr] = month.split("-");

    if (!window.confirm(`Régler ${amount} DA pour ${month} ?`)) return;

    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      month: Number(monthStr),
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

      {/* Ajouter */}
      <div className="mb-4 row g-2">
        {["firstName", "lastName", "phone", "wilaya", "region"].map((f, i) => (
          <div key={i} className="col-md-2">
            <input
              className="form-control"
              placeholder={f}
              value={newDriver[f]}
              onChange={e =>
                setNewDriver({ ...newDriver, [f]: e.target.value })
              }
            />
          </div>
        ))}

        <div className="col-md-1">
          <input
            type="number"
            className="form-control"
            value={newDriver.trucks}
            onChange={e =>
              setNewDriver({
                ...newDriver,
                trucks: Number(e.target.value) || 1
              })
            }
          />
        </div>

        <div className="col-md-1">
          <button className="btn btn-success w-100" onClick={handleAddDriver}>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="row">
        {drivers.map(d => {
          const driverTripsCount = driverTrips.filter(
            t => t.driverId === d.driverId
          ).length;

          return (
            <div key={d.driverId} className="col-md-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h5>
                    {formatField(d.firstName)} {formatField(d.lastName)}
                  </h5>
                  <p>Téléphone: {formatField(d.phone)}</p>
                  <p>
                    Wilaya: {formatField(d.wilaya)} | Région:{" "}
                    {formatField(d.region)}
                  </p>
                  <p>
                    Camions: {formatField(d.trucks)} | Trajets:{" "}
                    {driverTripsCount}
                  </p>

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-info"
                      onClick={() => fetchDriverTrips(d)}
                    >
                      Détails
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteDriver(d.driverId)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Détails */}
      {selectedDriver && (
        <div className="mt-4">
          <h3>
            Détails de {formatField(selectedDriver.firstName)}{" "}
            {formatField(selectedDriver.lastName)}
          </h3>

          <button
            className="btn btn-secondary mb-2"
            onClick={() => setSelectedDriver(null)}
          >
            Retour
          </button>

          {/* Filter */}
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

          {/* Stats */}
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

          {/* Tableau */}
          <table className="table table-bordered mt-2">
            <thead>
              <tr>
                <th>Date</th>
                <th>Départ</th>
                <th>Destination</th>
                <th>Km</th>
                <th>Prix</th>
                <th>Commission</th>
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
