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

// ✅ Parse date FIX
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

// ✅ Format
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

// ✅ Month key
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
    const snapshot = await getDocs(collection(db, "drivers"));
    const data = snapshot.docs.map(d => ({
      driverId: d.id,
      ...d.data()
    }));
    setDrivers(data);
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
  };

  // 🔹 delete driver
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur et ses demandes ?")) return;

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

  // 🔥 fetch trips
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

        return {
          id: d.id,
          ...t,
          price,
          commission,
          date,
          status: t.status
        };
      })
      .filter(t => t.status === "Confirmé");

    let filtered = tripsData;

    if (monthFilter) {
      filtered = tripsData.filter(
        t => getMonthKey(t.date) === monthFilter
      );
    }

    const stats = filtered.reduce(
      (acc, t) => {
        if (!t.date) return acc;

        acc.totalTrips += 1;
        acc.totalCommission += t.commission;

        const m = getMonthKey(t.date);
        acc.monthlyCommission[m] =
          (acc.monthlyCommission[m] || 0) + t.commission;

        return acc;
      },
      { totalTrips: 0, totalCommission: 0, monthlyCommission: {} }
    );

    setDriverTrips(filtered);
    setDriverStats(stats);

    await fetchPaidCommissions(driver.driverId);
  };

  // ✅ NOW USED → no ESLint error
  const payMonthCommission = async (month, amount) => {
    const [yearStr, monthStr] = month.split("-");

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

      {/* Liste */}
      <div className="row">
        {drivers.map(d => (
          <div key={d.driverId} className="col-md-4 mb-3">
            <div className="card">
              <div className="card-body">
                <h5>{formatField(d.firstName)} {formatField(d.lastName)}</h5>

                <div className="d-flex gap-2">
                  <button className="btn btn-info" onClick={() => fetchDriverTrips(d)}>
                    Détails
                  </button>

                  <button className="btn btn-danger" onClick={() => handleDeleteDriver(d.driverId)}>
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DETAILS */}
      {selectedDriver && (
        <>
          <h4 className="mt-4">📆 Commission mensuelle</h4>

          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Montant</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {Object.entries(driverStats.monthlyCommission).map(([m, val]) => {
                const paid = paidByMonth[m] || 0;

                return (
                  <tr key={m}>
                    <td>{m}</td>
                    <td>{val} DA</td>

                    <td>
                      {paid >= val ? (
                        <span className="badge bg-success">Payé</span>
                      ) : (
                        <span className="badge bg-warning">À payer</span>
                      )}
                    </td>

                    <td>
                      {paid < val && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => payMonthCommission(m, val)}
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

          {/* Trips */}
          <table className="table table-bordered mt-3">
            <thead>
              <tr>
                <th>Date</th>
                <th>Départ</th>
                <th>Destination</th>
                <th>Prix</th>
                <th>Commission</th>
              </tr>
            </thead>

            <tbody>
              {driverTrips.map(t => (
                <tr key={t.id}>
                  <td>{formatField(t.date)}</td>
                  <td>{t.depart}</td>
                  <td>{t.destination}</td>
                  <td>{t.price} DA</td>
                  <td>{t.commission} DA</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
