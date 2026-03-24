// src/pages/Assurance.jsx
import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1;

export default function Assurance() {
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [editTripId, setEditTripId] = useState(null);

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
    commission: ""
  });

  const [selectedDriverFilter, setSelectedDriverFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [numeroDossierFilter, setNumeroDossierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // assurance / societe
  const [paidByMonth, setPaidByMonth] = useState({});
  const [paidTotal, setPaidTotal] = useState(0);

  const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const calculateCommission = (prix, typePayment, driverSalaryInput, commissionInput) => {
    const total = parseFloat(prix) || 0;
    if (typePayment === "assurance") {
      const commission = total * COMMISSION_RATE;
      const driverSalary = total - commission;
      return { commission, driverSalary };
    } else if (typePayment === "societe") {
      const driverSalary = parseFloat(driverSalaryInput || 0);
      const commission = parseFloat(commissionInput || 0);
      return { commission, driverSalary };
    }
    return { commission: 0, driverSalary: 0 };
  };

  const fetchDrivers = async () => {
    const snap = await getDocs(collection(db, "drivers"));
    const data = snap.docs.map(d => ({ driverId: d.id, ...d.data() }));
    setDrivers(data);
  };

  const fetchTrips = async () => {
    const snap = await getDocs(collection(db, "assuranceTrips"));
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setTrips(data);
  };

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

  const handleAddOrUpdateTrip = async (e) => {
    e.preventDefault();
    if (!form.driverId || !form.depart || !form.destination || !form.date || !form.prix || !form.numeroDossier) {
      alert("Remplir tous les champs !");
      return;
    }

    const driver = drivers.find(d => d.driverId === form.driverId);
    const driverName = driver ? `${driver.firstName} ${driver.lastName}` : "-";

    const { commission, driverSalary } = calculateCommission(
      form.prix,
      form.typePayment || "assurance",
      form.driverSalary,
      form.commission
    );

    const tripData = {
      driverId: form.driverId,
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
      driverName,
      timestamp: serverTimestamp()
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
      commission: ""
    });

    fetchTrips();
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
      commission: trip.commission
    });
  };

  const handleDeleteTrip = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette course ?")) return;
    await deleteDoc(doc(db, "assuranceTrips", id));
    fetchTrips();
  };

  // فلترة حسب السائق، الشهر، رقم الدوسيه، ونوع الدفع
  const filteredTrips = trips.filter(t => {
    const matchDriver = !selectedDriverFilter || t.driverId === selectedDriverFilter;
    const matchMonth = !monthFilter || getMonthKey(t.date) === monthFilter;
    const matchDossier = !numeroDossierFilter || t.numeroDossier.includes(numeroDossierFilter);
    const matchType = !typeFilter || t.typePayment === typeFilter;
    return matchDriver && matchMonth && matchDossier && matchType;
  });

  const totalCommission = filteredTrips.reduce((a, t) => a + (t.commission || 0), 0);
  const totalDriverSalary = filteredTrips.reduce((a, t) => a + (t.driverSalary || 0), 0);

  const monthly = {};
  filteredTrips.forEach(t => {
    const m = getMonthKey(t.date);
    monthly[m] = (monthly[m] || 0) + t.driverSalary;
  });

  // دفع الراتب وتحديث جدول السائقين
  const payDriverMonth = async (month, amount) => {
    const [year, m] = month.split("-");
    if (!window.confirm(`Payer ${amount} DA pour ${month} ?`)) return;

    // إضافة الدفع
    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriverFilter,
      month: m,
      year: Number(year),
      amount,
      regle: true,
      paidAt: serverTimestamp()
    });

    // تحديث حقل salaryPaid في جدول السائقين
    const driverRef = doc(db, "drivers", selectedDriverFilter);
    const driverData = drivers.find(d => d.driverId === selectedDriverFilter);
    await updateDoc(driverRef, {
      salaryPaid: (driverData?.salaryPaid || 0) + amount
    });

    fetchPayments(selectedDriverFilter);
    fetchDrivers();
  };

  return (
    <div className="container mt-3">
      <h2>🚗 Assurance / Société - Gestion des courses</h2>

      {/* FORM */}
      <form className="row g-3 mb-4" onSubmit={handleAddOrUpdateTrip}>
        <div className="col-md-3">
          <select className="form-select"
            value={form.driverId}
            onChange={e => setForm({ ...form, driverId: e.target.value })}>
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
            onChange={e => setForm({ ...form, depart: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input className="form-control" placeholder="Destination"
            value={form.destination}
            onChange={e => setForm({ ...form, destination: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input type="date" className="form-control"
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })} />
        </div>
        <div className="col-md-1">
          <input type="number" className="form-control" placeholder="Km"
            value={form.kilometrage}
            onChange={e => setForm({ ...form, kilometrage: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input type="number" className="form-control" placeholder="Prix"
            value={form.prix}
            onChange={e => setForm({ ...form, prix: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input type="text" className="form-control" placeholder="Numéro Dossier"
            value={form.numeroDossier}
            onChange={e => setForm({ ...form, numeroDossier: e.target.value })} />
        </div>
        <div className="col-md-2">
          <input type="text" className="form-control" placeholder="Nom Société"
            value={form.companyName}
            onChange={e => setForm({ ...form, companyName: e.target.value })} />
        </div>
        <div className="col-md-2">
          <select className="form-select"
            value={form.typePayment}
            onChange={e => setForm({ ...form, typePayment: e.target.value })}>
            <option value="assurance">Assurance</option>
            <option value="societe">Société</option>
          </select>
        </div>
        {form.typePayment === "societe" && (
          <>
            <div className="col-md-2">
              <input type="number" className="form-control" placeholder="Salaire Chauffeur"
                value={form.driverSalary}
                onChange={e => setForm({ ...form, driverSalary: e.target.value })} />
            </div>
            <div className="col-md-2">
              <input type="number" className="form-control" placeholder="Votre Gain"
                value={form.commission}
                onChange={e => setForm({ ...form, commission: e.target.value })} />
            </div>
          </>
        )}
        <div className="col-12">
          <button className="btn btn-primary">{editTripId ? "Enregistrer" : "Ajouter"}</button>
        </div>
      </form>

      {/* FILTER */}
      <div className="row mb-3">
        <div className="col-md-3">
          <select className="form-select"
            value={selectedDriverFilter}
            onChange={e => {
              setSelectedDriverFilter(e.target.value);
              fetchPayments(e.target.value);
            }}>
            <option value="">Tous les conducteurs</option>
            {drivers.map(d => (
              <option key={d.driverId} value={d.driverId}>{d.firstName} {d.lastName}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <input type="month" className="form-control"
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)} />
        </div>
        <div className="col-md-3">
          <input type="text" className="form-control" placeholder="Filtrer par numéro de dossier"
            value={numeroDossierFilter}
            onChange={e => setNumeroDossierFilter(e.target.value)} />
        </div>
        <div className="col-md-3">
          <select className="form-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="assurance">Assurance</option>
            <option value="societe">Société</option>
          </select>
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
                    <button className="btn btn-success btn-sm"
                      onClick={() => payDriverMonth(month, val)}>Payer</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TRIPS TABLE */}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Conducteur</th>
            <th>Date</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Prix</th>
            <th>Type</th>
            <th>Numéro Dossier</th>
            <th>Nom Société</th>
            <th>Commission / Gain</th>
            <th>Salaire Chauffeur</th>
            <th>Actions</th>
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
              <td>{t.typePayment}</td>
              <td>{t.numeroDossier}</td>
              <td>{t.companyName}</td>
              <td>{t.commission}</td>
              <td>{t.driverSalary}</td>
              <td>
                <button className="btn btn-warning btn-sm me-2" onClick={() => handleEditTrip(t)}>Modifier</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTrip(t.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
