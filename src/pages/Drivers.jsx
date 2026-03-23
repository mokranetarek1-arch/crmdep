import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

// ✅ Parse date
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
  if (!value) return "-";
  if (value instanceof Date) return value.toLocaleDateString("fr-FR");
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

  // 🔹 delete driver
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur ?")) return;

    await deleteDoc(doc(db, "drivers", driverId));

    setDrivers(prev => prev.filter(d => d.driverId !== driverId));

    if (selectedDriver?.driverId === driverId) {
      setSelectedDriver(null);
    }
  };

  // 🔹 fetch trips
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

    const stats = tripsData.reduce(
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

    setDriverTrips(tripsData);
    setDriverStats(stats);
  };

  return (
    <div className="container mt-3">
      <h2>Liste des conducteurs</h2>

      {/* LISTE */}
      <div className="row">
        {drivers.map(d => (
          <div key={d.driverId} className="col-md-4 mb-3">
            <div className="card">
              <div className="card-body">
                <h5>{formatField(d.firstName)} {formatField(d.lastName)}</h5>

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
              </tr>
            </thead>

            <tbody>
              {Object.entries(driverStats.monthlyCommission).map(([m, val]) => (
                <tr key={m}>
                  <td>{m}</td>
                  <td>{val} DA</td>
                </tr>
              ))}
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
