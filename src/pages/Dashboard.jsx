import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import RequestForm from "../components/RequestForm";
import RequestTable from "../components/RequestTable";

export default function Dashboard() {
  const [rows, setRows] = useState([]); // بيانات الطلبات
  const [drivers, setDrivers] = useState([]); // قائمة السائقين
  const [editData, setEditData] = useState(null); // بيانات السطر المختار للتعديل

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

  // إضافة طلب جديد
  const addRow = (row) => {
    setRows([row, ...rows]);
  };

  // تحديث طلب بعد التعديل
  const updateRow = (updatedRow) => {
    setRows(rows.map(r => (r.docId === updatedRow.docId ? updatedRow : r)));
    setEditData(null); // إعادة الفورم للوضعية الجديدة
  };

  return (
    <>
      {/* الفورم + تمرير البيانات للتعديل */}
      <RequestForm
        drivers={drivers}
        onAdd={addRow}
        editData={editData}
        onUpdate={updateRow}
        onCancelEdit={() => setEditData(null)}
      />

      {/* جدول الطلبات + تمرير onEdit */}
      <RequestTable
        rows={rows}
        onEdit={(row) => setEditData(row)}
      />
    </>
  );
}
