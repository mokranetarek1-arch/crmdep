import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const COMMISSION_RATE = 0.1; // 10%

export default function DriverDetails() {
  const { driverId } = useParams();

  const [months, setMonths] = useState([]);
  const [trips, setTrips] = useState([]);
  const [stats, setStats] = useState({ totalTrips: 0, totalCommission: 0 });
  const [filterYear, setFilterYear] = useState(""); // للسنة
  const [filterMonth, setFilterMonth] = useState(""); // للشهر

  // جلب البيانات
  const fetchData = async () => {
    try {
      // 1️⃣ جلب الرحلات المؤكدة
      const rq = query(
        collection(db, "requests"),
        where("driverId", "==", driverId),
        where("status", "==", "Confirmé")
      );
      const rsnap = await getDocs(rq);

      const tripsData = rsnap.docs.map(d => {
        const t = d.data();
        const price = Number(t.prix) || 0;
        const date = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return { id: d.id, date, price, commission: price * COMMISSION_RATE, ...t };
      }).sort((a, b) => b.date - a.date); // ترتيب من الأحدث

      setTrips(tripsData);

      // 2️⃣ جلب المدفوعات
      const pq = query(
        collection(db, "driverPayments"),
        where("driverId", "==", driverId)
      );
      const psnap = await getDocs(pq);
      const paidMonths = psnap.docs.map(d => d.data());

      // 3️⃣ تجميع شهري
      const map = {};
      tripsData.forEach(t => {
        const year = t.date.getFullYear();
        const month = t.date.getMonth() + 1;
        const key = `${year}-${month}`;
        if (!map[key]) map[key] = { year, month, totalCommission: 0, totalTrips: 0, regle: false };
        map[key].totalCommission += t.commission;
        map[key].totalTrips += 1;
      });

      // 4️⃣ ربط حالة الدفع
      Object.values(map).forEach(m => {
        const paid = paidMonths.find(p => p.year === m.year && p.month === m.month && p.regle);
        if (paid) m.regle = true;
      });

      const result = Object.values(map).sort((a, b) => b.year - a.year || b.month - a.month);
      setMonths(result);

      // إحصائيات إجمالية
      setStats({
        totalTrips: tripsData.length,
        totalCommission: tripsData.reduce((s, t) => s + t.commission, 0)
      });
    } catch (err) {
      console.error(err);
      alert("Erreur chargement données");
    }
  };

  // تسديد العمولة لشهر محدد
  const markAsPaid = async (m) => {
    await addDoc(collection(db, "driverPayments"), {
      driverId,
      year: m.year,
      month: m.month,
      regle: true,
      paidAt: serverTimestamp()
    });
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [driverId]);

  // فلترة الرحلات حسب السنة والشهر
  const filteredTrips = trips.filter(t => {
    const year = t.date.getFullYear();
    const month = t.date.getMonth() + 1;
    return (filterYear ? year === Number(filterYear) : true) &&
           (filterMonth ? month === Number(filterMonth) : true);
  });

  // توليد قائمة السنوات المتاحة للفلتر
  const years = [...new Set(trips.map(t => t.date.getFullYear()))].sort((a, b) => b - a);

  return (
    <div className="container mt-3">
      <h2>📄 Détails du conducteur</h2>

      {/* Stats */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card p-3 text-center">
            <h6>Trajets Confirmés</h6>
            <h4>{stats.totalTrips}</h4>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card p-3 text-center">
            <h6>Commission Totale</h6>
            <h4>{stats.totalCommission} DA</h4>
          </div>
        </div>
      </div>

      {/* Tableau mensuel */}
      <h5>📆 Commission Mensuelle</h5>
      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>Mois</th>
            <th>Trajets</th>
            <th>Commission</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={i}>
              <td>{m.month}/{m.year}</td>
              <td>{m.totalTrips}</td>
              <td>{m.totalCommission} DA</td>
              <td>
                {m.regle ? (
                  <span className="badge bg-success">RÉGLÉ</span>
                ) : (
                  <span className="badge bg-warning text-dark">À PAYER</span>
                )}
              </td>
              <td>
                {!m.regle && (
                  <button className="btn btn-sm btn-success" onClick={() => markAsPaid(m)}>✔ Régler</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* فلتر الرحلات */}
      <div className="mb-3 d-flex gap-2">
        <select className="form-select w-auto" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">Toutes les années</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-select w-auto" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
          <option value="">Tous les mois</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={() => { setFilterYear(""); setFilterMonth(""); }}>Réinitialiser</button>
      </div>

      {/* Tableau الرحلات */}
      <h5>🚗 Liste des Trajets</h5>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Date</th>
            <th>Départ</th>
            <th>Destination</th>
            <th>Prix</th>
            <th>Commission (10%)</th>
          </tr>
        </thead>
        <tbody>
          {filteredTrips.map(t => (
            <tr key={t.id}>
              <td>{t.date.toLocaleDateString()}</td>
              <td>{t.depart || "-"}</td>
              <td>{t.destination || "-"}</td>
              <td>{t.price} DA</td>
              <td>{t.commission} DA</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

