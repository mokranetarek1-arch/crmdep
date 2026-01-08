import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import RequestForm from "../components/RequestForm";
import RequestTable from "../components/RequestTable";

export default function Dashboard() {
  const [rows, setRows] = useState([]); // بيانات الطلبات
  const [drivers, setDrivers] = useState([]); // قائمة السائقين

  // جلب السائقين من Firebase
  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      const data = snapshot.docs.map(doc => ({ driverId: doc.id, ...doc.data() }));
      setDrivers(data);
    } catch (err) {
      console.error("Erreur fetch drivers:", err);
      alert("Erreur lors du chargement des conducteurs!");
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const addRow = (row) => {
    setRows([row, ...rows]);
  };

  return (
    <>
      {/* ✅ مرر drivers للفورم */}
      <RequestForm onAdd={addRow} drivers={drivers} />
      
      {/* جدول الطلبات */}
      <RequestTable rows={rows} />
    </>
  );
}
