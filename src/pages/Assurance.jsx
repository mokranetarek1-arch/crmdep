// src/pages/Assurance.jsx
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

export default function Assurance() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);

  const [form, setForm] = useState({
    driverId: "",
    depart: "",
    destination: "",
    date: "",
    kilometrage: "",
    prix: ""
  });

  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [paidByMonth, setPaidByMonth] = useState({});
  const [paidTotal, setPaidTotal] = useState(0);

  // 🔹 Helpers
  const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const calculateCommission = (prix) => {
    const total = parseFloat(prix) || 0;
    const commission = total * COMMISSION_RATE;
    const driverSalary = total - commission;
    return { commission, driverSalary };
  };

  // 🔹 Fetch Drivers
  const fetchDrivers = async () => {
    const snap = await getDocs(collection(db, "drivers"));
    const data = snap.docs.map(d => ({ driverId: d.id, ...d.data() }));
    setDrivers(data);
  };

  // 🔹 Fetch Trips
  const fetchTrips = async () => {
    const snap = await getDocs(collection(db, "assuranceTrips"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setTrips(data);
  };

  // 🔹 Fetch Payments
  const fetchPayments = async (driverId) => {
    const snap = await getDocs(collection(db, "driverPayments"));

    let total = 0;
    const map = {};

    snap.docs.forEach(d => {
      const p = d.data();
      if (p.driverId === driverId && p.regle) {
        const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
        map[key] = (map[key] || 0) + p.amount;
        total += p.amount;
      }
    });

    setPaidByMonth(map);
    setPaidTotal(total);
  };

  useEffect(() => {
    fetchDrivers();
    fetchTrips();
  }, []);

  // 🔹 Add Trip
  const handleAddTrip = async (e) => {
    e.preventDefault();

    if (!form.driverId || !form.depart || !form.destination || !form.date || !form.prix) {
      alert("Remplir tous les champs !");
      return;
    }

    const driver = drivers.find(d => d.driverId === form.driverId);
    const driverName = driver ? `${driver.firstName} ${driver.lastName}` : "-";

    const { commission, driverSalary } = calculateCommission(form.prix);

    await addDoc(collection(db, "assuranceTrips"), {
      ...form,
      driverName,
      prix: parseFloat(form.prix),
      commission,
      driverSalary,
      timestamp: serverTimestamp()
    });

    setForm({ driverId: "", depart: "", destination: "", date: "", kilometrage: "", prix: "" });
    fetchTrips();
  };

  // 🔹 Filter Trips
  const filteredTrips = trips.filter(t => {
    const matchDriver = !selectedDriverFilter || t.driverId === selectedDriverFilter;
    const matchMonth = !monthFilter || getMonthKey(t.date) === monthFilter;
    return matchDriver && matchMonth;
  });

  // 🔹 Stats
  const totalCommission = filteredTrips.reduce((a, t) => a + (t.commission || 0), 0);
  const totalDriverSalary = filteredTrips.reduce((a, t) => a + (t.driverSalary || 0), 0);

  // 🔹 Monthly Salary
  const monthly = {};
  filteredTrips.forEach(t => {
    const m = getMonthKey(t.date);
    monthly[m] = (monthly[m] || 0) + t.driverSalary;
  });

  // 🔹 Pay
  const payDriverMonth = async (month, amount) => {
    const [year, m] = month.split("-");

    if (!window.confirm(`Payer ${amount} DA pour ${month} ?`)) return;

    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriverFilter,
      month: m,
      year: Number(year),
      amount,
      regle: true,
      paidAt: serverTimestamp()
    });

    fetchPayments(selectedDriverFilter);
  };

  return (
    <div className="container mt-3">
      <h2>🚗 Assurance - Gestion des courses</h2>

      {/* FORM */}
      <form className="row g-3 mb-4" onSubmit={handleAddTrip}>
        <div className="col-md-3">
          <select
            className="form-select"
            value={form.driverId}
            onChange={e => setForm({ ...form, driverId: e.target.value })}
          >
            <option value="">Choisir conducteur</option>
            {drivers.map(d => (
              <option key={d.driverId} value={d.driverId}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-2">
          <input className="form-control" placeholder="Départ"
            value={form.depart}
            onChange={e => setForm({ ...form, depart: e.target.value })}
          />
        </div>

        <div className="col-md-2">
          <input className="form-control" placeholder="Destination"
            value={form.destination}
            onChange={e => setForm({ ...form, destination: e.target.value })}
          />
        </div>

        <div className="col-md-2">
          <input type="date" className="form-control"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="col-md-1">
          <input type="number" className="form-control" placeholder="Km"
            value={form.kilometrage}
            onChange={e => setForm({ ...form, kilometrage: e.target.value })}
          />
        </div>

        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Prix"
            value={form.prix}
            onChange={e => setForm({ ...form, prix: e.target.value })}
          />
        </div>

        <div className="col-12">
          <button className="btn btn-primary">Ajouter</button>
        </div>
      </form>

      {/* FILTER */}
      <div className="row mb-3">
        <div className="col-md-4">
          <select className="form-select"
            value={selectedDriverFilter}
            onChange={e => {
              setSelectedDriverFilter(e.target.value);
              fetchPayments(e.target.value);
            }}>
            <option value="">Tous les conducteurs</option>
            {drivers.map(d => (
              <option key={d.driverId} value={d.driverId}>
                {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <input type="month" className="form-control"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
          />
        </div>
      </div>

      {/* STATS */}
      <div className="row mb-3">
        <div className="col-md-4">
          <div className="card p-3 text-center">
            <h6>💰 Votre bénéfice</h6>
            <h4>{totalCommission} DA</h4>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3 text-center bg-success text-white">
            <h6>Payé chauffeur</h6>
            <h4>{paidTotal} DA</h4>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card p-3 text-center bg-danger text-white">
            <h6>Reste à payer</h6>
            <h4>{totalDriverSalary - paidTotal} DA</h4>
          </div>
        </div>
      </div>

      {/* MONTH TABLE */}
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
          {Object.entries(monthly).map(([month, val]) => {
            const paid = paidByMonth[month] || 0;
            const isPaid = paid >= val;

            return (
              <tr key={month}>
                <td>{month}</td>
                <td>{val} DA</td>
                <td>{isPaid ? "Payé" : "Non payé"}</td>
                <td>
                  {!isPaid && selectedDriverFilter && (
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => payDriverMonth(month, val)}
                    >
                      Payer
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TRIPS */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Conducteur</th>
            <th>Date</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Prix</th>
            <th>Commission</th>
            <th>Salaire</th>
          </tr>
        </thead>
        <tbody>
          {filteredTrips.map(t => (
            <tr key={t.id}>
              <td>{t.driverName}</td>
              <td>{new Date(t.date).toLocaleDateString()}</td>
              <td>{t.depart}</td>
              <td>{t.destination}</td>
              <td>{t.prix}</td>
              <td>{t.commission}</td>
              <td>{t.driverSalary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
