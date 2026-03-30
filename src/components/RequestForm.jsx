import { useEffect, useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { logAuditAction } from "../utils/audit";

const defaultForm = {
  source: "Appel",
  id: "client",
  motif: "course immediate",
  phone: "",
  depart: "",
  destination: "",
  kilometrage: "",
  wilaya: "Alger",
  marqueVehicule: "",
  quantite: 1,
  status: "En cours",
  chauffeur: "",
  driverName: "",
  prix: "",
  commissionRate: 10,
  commissionAmount: "",
  panneType: "Panne",
  date: "",
  heure: "",
  note: "",
};

const confirmedStatuses = ["Confirme", "Confirmé"];
const getCommissionAmount = (price, rate) => {
  const safePrice = Number(price) || 0;
  const safeRate = Number(rate);
  const commissionRate = Number.isFinite(safeRate) ? safeRate : 10;
  return Number(((safePrice * commissionRate) / 100).toFixed(2));
};

export default function RequestForm({ drivers = [], editData = null, onSave, currentUser, adminProfile }) {
  const [form, setForm] = useState(defaultForm);
  const [isInfoMotif, setIsInfoMotif] = useState(false);

  useEffect(() => {
    if (!editData) {
      setForm(defaultForm);
      return;
    }

    setForm({
      ...defaultForm,
      ...editData,
      chauffeur: editData.driverId || "",
      driverName: editData.driverName || "",
      phone: editData.phone || "",
      status: editData.status || "En cours",
      commissionRate: Number(editData.commissionRate ?? 10),
      commissionAmount: Number(editData.commissionAmount ?? getCommissionAmount(editData.prix, editData.commissionRate || 10)),
    });
  }, [editData]);

  useEffect(() => {
    const infoRequest = form.motif === "demande d'information";
    setIsInfoMotif(infoRequest);

    if (!infoRequest) return;

    setForm((current) => {
      if (current.status === "En cours" && !current.chauffeur && !current.driverName) {
        return current;
      }

      return {
        ...current,
        status: "En cours",
        chauffeur: "",
        driverName: "",
      };
    });
  }, [form.motif]);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm);
  };

  const submit = async (event) => {
    event.preventDefault();

    const isConfirmed = confirmedStatuses.includes(form.status);
    if (!isInfoMotif && isConfirmed && !form.chauffeur) {
      alert("Veuillez selectionner un chauffeur.");
      return;
    }

    const payload = {
      ...form,
      status: isInfoMotif ? "En cours" : form.status,
      driverId: isInfoMotif ? "" : form.chauffeur,
      driverName: isInfoMotif ? "" : form.driverName,
      commissionRate: Number(form.commissionRate) || 10,
      commissionAmount: getCommissionAmount(form.prix, form.commissionRate),
    };

    try {
      if (editData?.docId) {
        await updateDoc(doc(db, "requests", editData.docId), {
          ...payload,
          updatedByUid: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
          updatedByName: adminProfile?.displayName || currentUser?.displayName || "",
          updatedAt: serverTimestamp(),
        });
        await logAuditAction({
          currentUser,
          adminProfile,
          action: "update",
          entityType: "request",
          entityId: editData.docId,
          description: `Modification de la course CRM ${payload.id || editData.docId}`,
          metadata: { motif: payload.motif, status: payload.status, driverId: payload.driverId || "" },
        });
        alert("Demande mise a jour avec succes.");
      } else {
        const docRef = await addDoc(collection(db, "requests"), {
          ...payload,
          createdByUid: currentUser?.uid || "",
          createdByEmail: currentUser?.email || "",
          createdByName: adminProfile?.displayName || currentUser?.displayName || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAuditAction({
          currentUser,
          adminProfile,
          action: "create",
          entityType: "request",
          entityId: docRef.id,
          description: `Ajout d'une course CRM ${payload.id || docRef.id}`,
          metadata: { motif: payload.motif, status: payload.status, driverId: payload.driverId || "" },
        });
        alert("Demande enregistree avec succes.");
      }

      resetForm();
      onSave && onSave();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur, reessayez.");
    }
  };

  const cancelEdit = () => {
    resetForm();
    onSave && onSave();
  };

  return (
    <div className="container mt-3">
      <div className="card shadow-sm">
        <div className="card-header fw-bold">{editData ? "Modifier demande" : "Nouvelle demande"}</div>
        <div className="card-body">
          <form onSubmit={submit} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Source</label>
              <select className="form-select" value={form.source} onChange={(event) => updateField("source", event.target.value)}>
                <option>Appel</option>
                <option>Plateforme</option>
                <option>Reseaux sociaux</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">ID</label>
              <select className="form-select" value={form.id} onChange={(event) => updateField("id", event.target.value)}>
                <option value="client">Client</option>
                <option value="partenaire">Partenaire</option>
                <option value="societe">Societe</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Motif d'appel</label>
              <select className="form-select" value={form.motif} onChange={(event) => updateField("motif", event.target.value)}>
                <option value="course immediate">Course immediate</option>
                <option value="reservation">Reservation</option>
                <option value="demande d'information">Demande d'information</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Numero de telephone</label>
              <input
                type="text"
                className="form-control"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Ex: 0551120023"
              />
            </div>

            {!isInfoMotif ? (
              <>
                <div className="col-md-6">
                  <label className="form-label">Depart</label>
                  <input className="form-control" value={form.depart} onChange={(event) => updateField("depart", event.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Destination</label>
                  <input
                    className="form-control"
                    value={form.destination}
                    onChange={(event) => updateField("destination", event.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Quantite</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.quantite}
                    onChange={(event) => updateField("quantite", event.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                    <option>En cours</option>
                    <option>Confirme</option>
                    <option>Annule</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Kilometrage</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.kilometrage}
                    onChange={(event) => updateField("kilometrage", event.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Prix (DA)</label>
                  <input type="number" className="form-control" value={form.prix} onChange={(event) => updateField("prix", event.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Commission %</label>
                  <div className="input-group">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => updateField("commissionRate", 10)}>
                      10%
                    </button>
                    <input
                      type="number"
                      className="form-control"
                      value={form.commissionRate}
                      onChange={(event) => updateField("commissionRate", event.target.value)}
                    />
                  </div>
                  <div className="form-text">
                    Commission calculee: {getCommissionAmount(form.prix, form.commissionRate).toLocaleString("fr-FR")} DA
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Chauffeur</label>
                  <select
                    className="form-select"
                    value={form.chauffeur}
                    onChange={(event) => {
                      const selected = drivers.find((driver) => driver.driverId === event.target.value);
                      setForm((current) => ({
                        ...current,
                        chauffeur: selected?.driverId || "",
                        driverName: selected ? `${selected.firstName} ${selected.lastName}` : "",
                      }));
                    }}
                  >
                    <option value="">-- Choisir un chauffeur --</option>
                    {drivers.map((driver) => (
                      <option key={driver.driverId} value={driver.driverId}>
                        {driver.firstName} {driver.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Type de panne</label>
                  <select className="form-select" value={form.panneType} onChange={(event) => updateField("panneType", event.target.value)}>
                    <option>Panne generale</option>
                    <option>Deplacement</option>
                    <option>Crevaison roue</option>
                    <option>Boite de vitesse</option>
                    <option>Accident</option>
                    <option>Batterie</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Marque vehicule</label>
                  <input
                    className="form-control"
                    value={form.marqueVehicule}
                    onChange={(event) => updateField("marqueVehicule", event.target.value)}
                  />
                </div>
              </>
            ) : null}

            <div className="col-md-4">
              <label className="form-label">Wilaya</label>
              <input className="form-control" value={form.wilaya} onChange={(event) => updateField("wilaya", event.target.value)} />
            </div>

            <div className="col-md-4">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={form.date} onChange={(event) => updateField("date", event.target.value)} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Heure</label>
              <input type="time" className="form-control" value={form.heure} onChange={(event) => updateField("heure", event.target.value)} />
            </div>

            <div className="col-12">
              <label className="form-label">Note</label>
              <input className="form-control" value={form.note} onChange={(event) => updateField("note", event.target.value)} />
            </div>

            <div className="col-12 text-end">
              <button type="submit" className="btn btn-primary me-2">
                {editData ? "Mettre a jour" : "Enregistrer"}
              </button>
              {editData ? (
                <button type="button" className="btn btn-secondary me-2" onClick={cancelEdit}>
                  Annuler
                </button>
              ) : null}
              <button type="button" className="btn btn-success" onClick={resetForm}>
                Nouvelle demande
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
