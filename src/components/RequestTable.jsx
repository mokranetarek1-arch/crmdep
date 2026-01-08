import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export default function RequestTable() {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "requests"));
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRows(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des demandes:", error);
      }
    };

    fetchData();
  }, []);

  // vérifier si la date est dans le mois actuel
  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const filteredRows = rows.filter((r) => {
    const matchDate = dateFilter ? r.date === dateFilter : true;

    let matchDay = true;
    if (dayFilter && r.date) {
      const dayName = new Date(r.date).toLocaleDateString("en-US", { weekday: "long" });
      matchDay = dayName === dayFilter;
    }

    const matchMonth = monthFilter ? isCurrentMonth(r.date) : true;

    return matchDate && matchDay && matchMonth;
  });

  // 🔹 حذف سجل
  const handleDelete = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce trajet ?")) return;
    try {
      await deleteDoc(doc(db, "requests", id));
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <div className="container-fluid mt-4">
      {/* ===== FILTRES ===== */}
      <div className="row mb-4 g-3 align-items-end">
        <div className="col-md-3">
          <label>Date :</label>
          <input
            type="date"
            className="form-control shadow-sm rounded"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <label>Jour :</label>
          <select
            className="form-select shadow-sm rounded"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
          >
            <option value="">Tous</option>
            <option value="Monday">Lundi</option>
            <option value="Tuesday">Mardi</option>
            <option value="Wednesday">Mercredi</option>
            <option value="Thursday">Jeudi</option>
            <option value="Friday">Vendredi</option>
            <option value="Saturday">Samedi</option>
            <option value="Sunday">Dimanche</option>
          </select>
        </div>

        <div className="col-md-3">
          <label>Mois actuel :</label>
          <div className="form-check mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              checked={monthFilter}
              onChange={() => setMonthFilter(!monthFilter)}
              id="monthFilter"
            />
            <label className="form-check-label" htmlFor="monthFilter">
              Afficher uniquement les trajets du mois courant
            </label>
          </div>
        </div>
      </div>

      {/* ===== TABLE ===== */}
      <div className="table-responsive shadow-sm rounded border">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID Document</th>
              <th>Motif</th>
              <th>Départ</th>
              <th>Destination</th>
              <th>Kilométrage</th>
              <th>Wilaya</th>
              <th>Type client</th>
              <th>Marque véhicule</th>
              <th>Quantité</th>
              <th>Status</th>
              <th>Dispatch</th>
              <th>Chauffeur</th>
              <th>Prix</th>
              <th>Type de panne</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="19" className="text-center text-muted py-3">
                  Aucun trajet trouvé
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.source}</td>
                  <td>{r.id}</td> {/* معرف المستند */}
                  <td>{r.motif}</td>
                  <td>{r.depart}</td>
                  <td>{r.destination}</td>
                  <td>{r.kilometrage || "-"}</td>
                  <td>{r.wilaya}</td>
                  <td>{r.typeClient}</td>
                  <td>{r.marqueVehicule || "-"}</td>
                  <td>{r.quantite}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === "Annulé"
                          ? "bg-danger"
                          : r.status === "Confirmé"
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>{r.dispatch}</td>
                  <td>{r.driverName || "-"}</td> {/* هنا اسم السائق */}
                  <td>{r.prix ? `${r.prix} DA` : "-"}</td>
                  <td>{r.panneType}</td>
                  <td>{r.date || "-"}</td>
                  <td>{r.heure || "-"}</td>
                  <td>{r.note || "-"}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(r.id)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
