import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const isCancelledStatus = (value) => String(value || "").toLowerCase().includes("annul");

export default function RequestTable({ onEdit }) {
  const [rows, setRows] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [motifFilter, setMotifFilter] = useState("");
  const [numberSearch, setNumberSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState("");

  const sendWhatsApp = (phone, name, depart, destination, amount) => {
    if (!phone) return alert("Numero manquant");

    const formattedPhone = phone.startsWith("0")
      ? `+213${phone.substring(1)}`
      : phone.startsWith("+213")
      ? phone
      : `+213${phone}`;

    const message = `Depalink Service depannage avec vous

Depart: ${depart || "-"}
Destination: ${destination || "-"}
Montant: ${amount || 0} DA

Si vous etes satisfait par notre service, nous vous invitons a partager votre experience sur nos reseaux sociaux :
Facebook : https://www.facebook.com/share/1DKaHHQwSk/

Aussi, nous evaluer sur Google :
https://www.google.com/search?q=depalink+service+d%C3%A9pannage

Merci pour votre confiance`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "requests"),
      (snapshot) => {
        const data = snapshot.docs.map((entry) => ({
          docId: entry.id,
          ...entry.data(),
        }));
        setRows(data);
      },
      (error) => console.error("Firestore error:", error)
    );

    return () => unsubscribe();
  }, []);

  const filteredRows = rows.filter((row) => {
    const dateObj = row.date?.toDate ? row.date.toDate() : row.date ? new Date(row.date) : null;
    const dateStr = dateObj ? dateObj.toISOString().slice(0, 10) : "";
    const query = numberSearch.trim().toLowerCase();
    const phone = String(row.phone || "").toLowerCase();
    const requestId = String(row.id || "").toLowerCase();
    const dossier = String(row.numeroDossier || "").toLowerCase();

    const matchDate = dateFilter ? dateStr === dateFilter : true;

    let matchDay = true;
    if (dayFilter && dateObj) {
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
      matchDay = dayName === dayFilter;
    }

    let matchMonthYear = true;
    if (monthFilter !== "" && yearFilter !== "" && dateObj) {
      matchMonthYear =
        dateObj.getMonth() === parseInt(monthFilter, 10) &&
        dateObj.getFullYear() === parseInt(yearFilter, 10);
    }

    const matchStatus = statusFilter
      ? statusFilter === "Confirmé"
        ? isConfirmedStatus(row.status)
        : statusFilter === "Annulé"
        ? isCancelledStatus(row.status)
        : row.status === statusFilter
      : true;

    const matchMotif = motifFilter ? row.motif === motifFilter : true;
    const matchNumber = query ? phone.includes(query) || requestId.includes(query) || dossier.includes(query) : true;

    return matchDate && matchDay && matchMonthYear && matchStatus && matchMotif && matchNumber;
  });

  const handleDelete = async (docId) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce trajet ?")) return;

    try {
      await deleteDoc(doc(db, "requests", docId));
      setRows((prev) => prev.filter((row) => row.docId !== docId));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erreur lors de la suppression");
    }
  };

  const formatCreatedAt = (row) => {
    const created = row.createdAt?.toDate
      ? row.createdAt.toDate()
      : row.createdAt
      ? new Date(row.createdAt)
      : row.timestamp?.toDate
      ? row.timestamp.toDate()
      : row.updatedAt?.toDate
      ? row.updatedAt.toDate()
      : null;

    return created ? created.toLocaleString("fr-FR") : "-";
  };

  return (
    <div className="container-fluid mt-4">
      <div className="row mb-4 g-3 align-items-end">
        <div className="col-md-3">
          <label>Recherche numero / ID :</label>
          <input
            type="text"
            className="form-control"
            placeholder="Telephone, ID, dossier..."
            value={numberSearch}
            onChange={(event) => setNumberSearch(event.target.value)}
          />
        </div>

        <div className="col-md-2">
          <label>Date :</label>
          <input type="date" className="form-control" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>

        <div className="col-md-2">
          <label>Jour :</label>
          <select className="form-select" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
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
          <select className="form-select" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="0">Janvier</option>
            <option value="1">Fevrier</option>
            <option value="2">Mars</option>
            <option value="3">Avril</option>
            <option value="4">Mai</option>
            <option value="5">Juin</option>
            <option value="6">Juillet</option>
            <option value="7">Aout</option>
            <option value="8">Septembre</option>
            <option value="9">Octobre</option>
            <option value="10">Novembre</option>
            <option value="11">Decembre</option>
          </select>
        </div>

        <div className="col-md-1">
          <label>Annee :</label>
          <input
            type="number"
            className="form-control"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            placeholder={new Date().getFullYear()}
          />
        </div>

        <div className="col-md-1">
          <label>Status :</label>
          <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="Annulé">Annule</option>
            <option value="Confirmé">Confirme</option>
            <option value="En cours">En cours</option>
          </select>
        </div>

        <div className="col-md-1">
          <label>Motif :</label>
          <select className="form-select" value={motifFilter} onChange={(e) => setMotifFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="course immediate">Course immediate</option>
            <option value="reservation">Reservation</option>
            <option value="demande d'information">Demande d'information</option>
          </select>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Source</th>
              <th>ID</th>
              <th>Motif</th>
              <th>Telephone</th>
              <th>Depart</th>
              <th>Destination</th>
              <th>Km</th>
              <th>Wilaya</th>
              <th>Type Client</th>
              <th>Vehicule</th>
              <th>Qte</th>
              <th>Status</th>
              <th>Dispatch</th>
              <th>Chauffeur</th>
              <th>Prix</th>
              <th>Panne</th>
              <th>Date</th>
              <th>Heure</th>
              <th>Ajoute le</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan="21" className="text-center text-muted py-3">
                  Aucun trajet trouve
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const dateObj = row.date?.toDate ? row.date.toDate() : row.date ? new Date(row.date) : null;
                return (
                  <tr key={row.docId}>
                    <td>{row.source}</td>
                    <td>{row.id}</td>
                    <td>{row.motif}</td>
                    <td>{row.phone || "-"}</td>
                    <td>{row.depart || "-"}</td>
                    <td>{row.destination || "-"}</td>
                    <td>{row.kilometrage || "-"}</td>
                    <td>{row.wilaya}</td>
                    <td>{row.typeClient || "-"}</td>
                    <td>{row.marqueVehicule || "-"}</td>
                    <td>{row.quantite}</td>
                    <td>
                      <span
                        className={`badge ${
                          isCancelledStatus(row.status)
                            ? "bg-danger"
                            : isConfirmedStatus(row.status)
                            ? "bg-success"
                            : "bg-warning text-dark"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.dispatch || "-"}</td>
                    <td>{row.driverName || "-"}</td>
                    <td>{row.prix ? `${row.prix} DA` : "-"}</td>
                    <td>{row.panneType || "-"}</td>
                    <td>{dateObj ? dateObj.toLocaleDateString() : "-"}</td>
                    <td>{row.heure || "-"}</td>
                    <td>{formatCreatedAt(row)}</td>
                    <td style={{ maxWidth: "150px", cursor: "pointer" }}>
                      {row.note ? (
                        <span
                          onClick={() => setSelectedNote(row.note)}
                          style={{
                            display: "inline-block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: "150px",
                          }}
                        >
                          {row.note}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-primary me-2" onClick={() => onEdit(row)}>
                        Modifier
                      </button>
                      <button className="btn btn-sm btn-danger me-2" onClick={() => handleDelete(row.docId)}>
                        Supprimer
                      </button>
                      {isConfirmedStatus(row.status) && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => sendWhatsApp(row.phone, row.id, row.depart, row.destination, row.prix)}
                        >
                          WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedNote && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1050,
          }}
          onClick={() => setSelectedNote("")}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "640px",
              background: "#fff",
              borderRadius: "20px",
              boxShadow: "0 24px 80px rgba(15, 23, 42, 0.22)",
              overflow: "hidden",
            }}
          >
            <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom">
              <h5 className="modal-title mb-0">Note</h5>
              <button className="btn-close" onClick={() => setSelectedNote("")}></button>
            </div>
            <div className="px-4 py-4">
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 0, lineHeight: 1.7 }}>{selectedNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
