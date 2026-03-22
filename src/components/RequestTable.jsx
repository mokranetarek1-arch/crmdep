import { useState, useEffect } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function RequestTable({ onEdit }) {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState(false);

  // 🔥 REALTIME LISTENER
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          docId: d.id,     // ✅ ID الحقيقي
          ...d.data()
        }));
        setRows(data);
      },
      (error) => {
        console.error("🔥 Firestore error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ✅ فلترة
  const filteredRows = rows.filter(r => {
    const dateObj = r.date?.toDate
      ? r.date.toDate()
      : (r.date ? new Date(r.date) : null);

    const dateStr = dateObj
      ? dateObj.toISOString().slice(0, 10)
      : "";

    const matchDate = dateFilter
      ? dateStr === dateFilter
      : true;

    let matchDay = true;
    if (dayFilter && dateObj) {
      const dayName = dateObj.toLocaleDateString("en-US", {
        weekday: "long"
      });
      matchDay = dayName === dayFilter;
    }

    const matchMonth = monthFilter
      ? dateObj &&
        dateObj.getMonth() === new Date().getMonth() &&
        dateObj.getFullYear() === new Date().getFullYear()
      : true;

    return matchDate && matchDay && matchMonth;
  });

  // 🔥 DELETE
  const handleDelete = async (docId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce trajet ?")) return;

    try {
      console.log("Deleting:", docId);

      await deleteDoc(doc(db, "requests", docId));

      console.log("✅ Deleted");

      // تحديث مباشر
      setRows(prev => prev.filter(r => r.docId !== docId));

    } catch (err) {
      console.error("❌ Delete error:", err);
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <div className="container-fluid mt-4">

      {/* FILTERS */}
      <div className="row mb-4 g-3 align-items-end">
        <div className="col-md-3">
          <label>Date :</label>
          <input
            type="date"
            className="form-control"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <label>Jour :</label>
          <select
            className="form-select"
            value={dayFilter}
            onChange={e => setDayFilter(e.target.value)}
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
            />
            <label className="form-check-label">
              Mois courant
            </label>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID</th>
              <th>Motif</th>
              <th>Départ</th>
              <th>Destination</th>
              <th>Km</th>
              <th>Wilaya</th>
              <th>Type</th>
              <th>Véhicule</th>
              <th>Qté</th>
              <th>Status</th>
              <th>Dispatch</th>
              <th>Chauffeur</th>
              <th>Prix</th>
              <th>Panne</th>
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
              filteredRows.map(r => {
                const dateObj = r.date?.toDate
                  ? r.date.toDate()
                  : (r.date ? new Date(r.date) : null);

                return (
                  <tr key={r.docId}>
                    <td>{r.source}</td>
                    <td>{r.id}</td> {/* هذا id تاع client */}
                    <td>{r.motif}</td>
                    <td>{r.depart}</td>
                    <td>{r.destination}</td>
                    <td>{r.kilometrage || "-"}</td>
                    <td>{r.wilaya}</td>
                    <td>{r.typeClient}</td>
                    <td>{r.marqueVehicule || "-"}</td>
                    <td>{r.quantite}</td>

                    <td>
                      <span className={`badge ${
                        r.status === "Annulé"
                          ? "bg-danger"
                          : r.status === "Confirmé"
                          ? "bg-success"
                          : "bg-warning text-dark"
                      }`}>
                        {r.status}
                      </span>
                    </td>

                    <td>{r.dispatch}</td>
                    <td>{r.driverName || "-"}</td>
                    <td>{r.prix ? `${r.prix} DA` : "-"}</td>
                    <td>{r.panneType}</td>

                    <td>
                      {dateObj
                        ? dateObj.toLocaleDateString()
                        : "-"}
                    </td>

                    <td>{r.heure || "-"}</td>
                    <td>{r.note || "-"}</td>

                    <td>
                      <button
                        className="btn btn-sm btn-primary me-2"
                        onClick={() => onEdit(r)}
                      >
                        Modifier
                      </button>

                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(r.docId)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
