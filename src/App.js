import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Statistics from "./pages/Statistics";
import Price from "./pages/Price";
import TripsDashboard from "./pages/TripsDashboard";
import Drivers from "./pages/Drivers";
import Assurance from "./pages/Assurance"; // ✅ استيراد الصفحة الجديدة
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

function App() {
  const [page, setPage] = useState("dashboard");
  const [drivers, setDrivers] = useState([]);

  // جلب السائقين لمرة واحدة
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "drivers"));
        const data = snapshot.docs.map(doc => ({ driverId: doc.id, ...doc.data() }));
        setDrivers(data);
      } catch (err) {
        console.error("Erreur lors du chargement des conducteurs:", err);
      }
    };
    fetchDrivers();
  }, []);

  return (
    <div className="container mt-3">
      <h1 className="mb-4">Highdep Dashbord</h1>

      {/* أزرار التنقل */}
      <div className="mb-3">
        <button
          onClick={() => setPage("dashboard")}
          className={`btn me-2 ${page === "dashboard" ? "btn-primary" : "btn-outline-primary"}`}
        >
          CRM
        </button>
        <button
          onClick={() => setPage("statistics")}
          className={`btn me-2 ${page === "statistics" ? "btn-secondary" : "btn-outline-secondary"}`}
        >
          Statistics
        </button>
        <button
          onClick={() => setPage("price")}
          className={`btn me-2 ${page === "price" ? "btn-success" : "btn-outline-success"}`}
        >
          Price Simulator
        </button>
        <button
          onClick={() => setPage("trips")}
          className={`btn me-2 ${page === "trips" ? "btn-info" : "btn-outline-info"}`}
        >
          Trips
        </button>
        <button
          onClick={() => setPage("drivers")}
          className={`btn me-2 ${page === "drivers" ? "btn-warning" : "btn-outline-warning"}`}
        >
          Drivers
        </button>
        <button
          onClick={() => setPage("assurance")}
          className={`btn ${page === "assurance" ? "btn-dark" : "btn-outline-dark"}`} // ✅ زر صفحة Assurance
        >
          Assurance
        </button>
      </div>

      <hr />

      {/* عرض الصفحات */}
      {page === "dashboard" && <Dashboard drivers={drivers} />}
      {page === "statistics" && <Statistics />}
      {page === "price" && <Price />}
      {page === "trips" && <TripsDashboard />}
      {page === "drivers" && <Drivers />}
      {page === "assurance" && <Assurance />} {/* ✅ عرض صفحة Assurance */}
    </div>
  );
}

export default App;
