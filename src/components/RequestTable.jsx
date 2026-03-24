import { useState, useEffect } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function RequestTable({ onEdit }) {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [motifFilter, setMotifFilter] = useState("");

  // 🔥 NEW: note popup
  const [selectedNote, setSelectedNote] = useState("");

  // 🔥 Realtime listener
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "requests"),
      snapshot => {
        const data = snapshot.docs.map(d => ({
          docId: d.id,
          ...d.data()
        }));
        setRows(data);
      },
      error => console.error("Firestore error:", error)
    );

    return () => unsubscribe();
  }, []);

  // 🔹 Filter logic
  const filteredRows = rows.filter(r => {
    const dateObj = r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null);
    const dateStr = dateObj ? dateObj.toISOString().slice(0, 10) : "";

    const matchDate = dateFilter ? dateStr === dateFilter : true;

    let matchDay = true;
    if (dayFilter && dateObj) {
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      matchDay = dayName === dayFilter;
    }

    let matchMonthYear = true;
    if (monthFilter !== "" && yearFilter !== "" && dateObj) {
      matchMonthYear =
        dateObj.getMonth() === parseInt(monthFilter) &&
        dateObj.getFullYear() === parseInt(yearFilter);
    }

    const matchStatus = statusFilter ? r.status === statusFilter : true;
    const matchMotif = motifFilter ? r.motif === motifFilter : true;

    return matchDate && matchDay && matchMonthYear && matchStatus && matchMotif;
  });

  // 🔹 Delete
  const handleDelete = async (docId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce trajet ?")) return;
    try {
      await deleteDoc(doc(db, "requests", docId));
      setRows(prev => prev.filter(r => r.docId !== docId));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erreur lors de la suppression");
    }
  };

  return (
    <div className="container-fluid mt-4">

      {/* ===================== FILTERS ===================== */}
      <div className="row mb-4 g-3 align-items-end">

        <div className="col-md-2">
          <label>Date :</label>
          <input type="date" className="form-control" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        </div>

        <div className="col-md-2">
          <label>Jour :</label>
          <select className="form-select" value={dayFilter} onChange={e => setDayFilter(e.target.value)}>
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

        <div className="col-md-2">
          <label>Mois :</label>
          <select className="form-select" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="0">Janvier</option>
            <option value="1">Février</option>
            <option value="2">Mars</option>
            <option value="3">Avril</option>
            <option value="4">Mai</option>
            <option value="5">Juin</option>
            <option value="6">Juillet</option>
            <option value="7">Août</option>
            <option value="8">Septembre</option>
            <option value="9">Octobre</option>
            <option value="10">Novembre</option>
            <option value="11">Décembre</option>
          </select>
        </div>

        <div className="col-md-2">
          <label>Année :</label>
          <input type="number" className="form-control" value={yearFilter} onChange={e => setYearFilter(e.target.value)} placeholder={new Date().getFullYear()} />
        </div>

        <div className="col-md-2">
          <label>Status :</label>
          <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="Annulé">Annulé</option>
            <option value="Confirmé">Confirmé</option>
            <option value="En cours">En cours</option>
          </select>
        </div>

        <div className="col-md-2">
          <label>Motif :</label>
          <select className="form-select" value={motifFilter} onChange={e => setMotifFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="course immediate">Course immédiate</option>
            <option value="reservation">Réservation</option>
            <option value="demande d'information">Demande d'information</option>
          </select>
        </div>

      </div>

      {/* ===================== TABLE ===================== */}
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID</th>
              <th>Motif</th>
              <th>Téléphone</th>
              <th>Départ</th>
              <th>Destination</th>
              <th>Km</th>
              <th>Wilaya</th>
              <th>Type Client</th>
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
                <td colSpan="20" className="text-center text-muted py-3">
                  Aucun trajet trouvé
                </td>
              </tr>
            ) : (
              filteredRows.map(r => {
                const dateObj = r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null);
                return (
                  <tr key={r.docId}>
                    <td>{r.source}</td>
                    <td>{r.id}</td>
                    <td>{r.motif}</td>
                    <td>{r.phone || "-"}</td>
                    <td>{r.depart || "-"}</td>
                    <td>{r.destination || "-"}</td>
                    <td>{r.kilometrage || "-"}</td>
                    <td>{r.wilaya}</td>
                    <td>{r.typeClient || "-"}</td>
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
                    <td>{r.dispatch || "-"}</td>
                    <td>{r.driverName || "-"}</td>
                    <td>{r.prix ? `${r.prix} DA` : "-"}</td>
                    <td>{r.panneType || "-"}</td>
                    <td>{dateObj ? dateObj.toLocaleDateString() : "-"}</td>
                    <td>{r.heure || "-"}</td>

                    {/* ✅ NOTE FIX */}
                    <td style={{ maxWidth: "150px", cursor: "pointer" }}>
                      {r.note ? (
                        <span
                          onClick={() => setSelectedNote(r.note)}
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "150px"
                          }}
                        >
                          {r.note}
                        </span>
                      ) : "-"}
                    </td>

                    <td>
                      <button className="btn btn-sm btn-primary me-2" onClick={() => onEdit(r)}>Modifier</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.docId)}>Supprimer</button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ MODAL */}
      {selectedNote && (
        <div
          className="modal fade show"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setSelectedNote("")}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h5 className="modal-title">Note</h5>
                <button className="btn-close" onClick={() => setSelectedNote("")}></button>
              </div>
              <div className="modal-body">
                <p style={{ whiteSpace: "pre-wrap" }}>{selectedNote}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
