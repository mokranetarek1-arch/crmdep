// Dashboard.jsx
import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import RequestForm from "../components/RequestForm";
import RequestTable from "../components/RequestTable";

export default function Dashboard({ currentUser, adminProfile }) {
  const [drivers, setDrivers] = useState([]);
  const [editData, setEditData] = useState(null); // الطلب المراد تعديله
  const [refreshKey, setRefreshKey] = useState(0);

  // جلب السائقين
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const data = snapshot.docs.map(doc => ({
          driverId: doc.id,
          ...doc.data()
        }));
        setDrivers(data);
      } catch (err) {
        console.error(err);
        alert("Erreur lors du chargement des chauffeurs");
      }
    };
    fetchDrivers();
  }, []);

  // بعد إضافة أو تعديل
  const handleSave = () => {
    setRefreshKey(prev => prev + 1); // إعادة تحميل الجدول
    setEditData(null);
  };

  return (
    <div className="container-fluid">
      <RequestForm
        drivers={drivers}
        editData={editData}
        onSave={handleSave}
        onCancelEdit={() => setEditData(null)}
        currentUser={currentUser}
        adminProfile={adminProfile}
      />
      <RequestTable
        key={refreshKey}
        onEdit={(row) => setEditData(row)}
        currentUser={currentUser}
        adminProfile={adminProfile}
      />
    </div>
  );
}
