import { useState, useEffect } from "react";
import { addDoc, collection, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function RequestForm({ drivers = [], editData = null, onSave, currentUser, adminProfile }) {
  const defaultForm = {
    source: "Appel",
    id: "client",
    motif: "course immediate",
    phone: "",
    depart: "",
    destination: "",
    kilometrage: "",
    wilaya: "Alger",
    typeClient: "Client",
    marqueVehicule: "",
    quantite: 1,
    status: "Confirmé",
    chauffeur: "",
    driverName: "",
    prix: "",
    panneType: "Panne",
    date: "",
    heure: "",
    note: ""
  };

  const [form, setForm] = useState(defaultForm);
  const [isInfoMotif, setIsInfoMotif] = useState(false);

  // ملء الفورم عند التعديل
  useEffect(() => {
    if (editData) {
      setForm({
        ...editData,
        chauffeur: editData.driverId || "",
        driverName: editData.driverName || "",
        phone: editData.phone || ""
      });
      setIsInfoMotif(editData.motif === "demande d'information");
    }
  }, [editData]);

  // مراقبة تغيّر Motif
  useEffect(() => {
    setIsInfoMotif(form.motif === "demande d'information");
  }, [form.motif]);

  const submit = async (e) => {
    e.preventDefault();

    // إذا كان Motif != demande d'information، نجعل اختيار السائق إلزامياً
    if (!isInfoMotif && form.status === "Confirmé" && !form.chauffeur) {
      alert("Veuillez sélectionner un chauffeur !");
      return;
    }

    try {
      if (editData && editData.docId) {
        const docRef = doc(db, "requests", editData.docId);
        await updateDoc(docRef, {
          ...form,
          driverId: form.chauffeur,
          driverName: form.driverName,
          updatedByUid: currentUser?.uid || "",
          updatedByEmail: currentUser?.email || "",
          updatedByName: adminProfile?.displayName || currentUser?.displayName || "",
          updatedAt: serverTimestamp()
        });
        alert("Demande mise à jour avec succès !");
      } else {
        await addDoc(collection(db, "requests"), {
          ...form,
          driverId: form.chauffeur,
          driverName: form.driverName,
          createdByUid: currentUser?.uid || "",
          createdByEmail: currentUser?.email || "",
          createdByName: adminProfile?.displayName || currentUser?.displayName || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        alert("Demande enregistrée avec succès !");
      }

      setForm(defaultForm);
      onSave && onSave();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur, réessayez !");
    }
  };

  const cancelEdit = () => {
    setForm(defaultForm);
    onSave && onSave();
  };

  return (
    <div className="container mt-3">
      <div className="card shadow-sm">
        <div className="card-header fw-bold">
          {editData ? "Modifier demande" : "Nouvelle demande"}
        </div>
        <div className="card-body">
          <form onSubmit={submit} className="row g-3">

            {/* Source */}
            <div className="col-md-4">
              <label className="form-label">Source</label>
              <select className="form-select"
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
              >
                <option>Appel</option>
                <option>Plateforme</option>
                <option>Reseaux sociaux</option>
              </select>
            </div>

            {/* ID */}
            <div className="col-md-4">
              <label className="form-label">ID</label>
              <select className="form-select"
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
              >
                <option value="client">Client</option>
                <option value="partenaire">Partenaire</option>
                <option value="société">Société</option>
              </select>
            </div>

            {/* Motif */}
            <div className="col-md-4">
              <label className="form-label">Motif d'appel</label>
              <select className="form-select"
                value={form.motif}
                onChange={e => setForm({ ...form, motif: e.target.value })}
              >
                <option value="course immediate">Course immédiate</option>
                <option value="reservation">Réservation</option>
                <option value="demande d'information">Demande d'information</option>
              </select>
            </div>

            {/* Phone */}
            <div className="col-md-4">
              <label className="form-label">Numéro de téléphone</label>
              <input type="text" className="form-control"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Ex: 0551120023"
              />
            </div>

            {/* الحقول الخاصة بالرحلة + Marque véhicule */}
            {!isInfoMotif && (
              <>
                <div className="col-md-6">
                  <label className="form-label">Départ</label>
                  <input className="form-control"
                    value={form.depart}
                    onChange={e => setForm({ ...form, depart: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Destination</label>
                  <input className="form-control"
                    value={form.destination}
                    onChange={e => setForm({ ...form, destination: e.target.value })}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label">Quantité</label>
                  <input type="number" className="form-control"
                    value={form.quantite}
                    onChange={e => setForm({ ...form, quantite: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option>En cours</option>
                    <option>Confirmé</option>
                    <option>Annulé</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Kilométrage</label>
                  <input type="number" className="form-control"
                    value={form.kilometrage}
                    onChange={e => setForm({ ...form, kilometrage: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Prix (DA)</label>
                  <input type="number" className="form-control"
                    value={form.prix}
                    onChange={e => setForm({ ...form, prix: e.target.value })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Chauffeur</label>
                  <select className="form-select"
                    value={form.chauffeur}
                    onChange={e => {
                      const selected = drivers.find(d => d.driverId === e.target.value);
                      setForm({
                        ...form,
                        chauffeur: selected?.driverId || "",
                        driverName: selected ? `${selected.firstName} ${selected.lastName}` : ""
                      });
                    }}
                  >
                    <option value="">-- Choisir un chauffeur --</option>
                    {drivers.map(d => (
                      <option key={d.driverId} value={d.driverId}>
                        {d.firstName} {d.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Type de panne</label>
                  <select className="form-select"
                    value={form.panneType}
                    onChange={e => setForm({ ...form, panneType: e.target.value })}
                  >
                    <option>Panne generale</option>
                    <option>Déplacement</option>
                    <option>Crevation roue</option>
                    <option>Boite de vitesse</option>
                    <option>Accident</option>
                    <option>Battrie</option>
                    
                  </select>
                </div>

                {/* Marque véhicule */}
                <div className="col-md-4">
                  <label className="form-label">Marque véhicule</label>
                  <input className="form-control"
                    value={form.marqueVehicule}
                    onChange={e => setForm({ ...form, marqueVehicule: e.target.value })}
                  />
                </div>
              </>
            )}

            {/* Wilaya */}
            <div className="col-md-4">
              <label className="form-label">Wilaya</label>
              <input className="form-control"
                value={form.wilaya}
                onChange={e => setForm({ ...form, wilaya: e.target.value })}
              />
            </div>

            {/* Type client */}
            <div className="col-md-4">
              <label className="form-label">Type client</label>
              <select className="form-select"
                value={form.typeClient}
                onChange={e => setForm({ ...form, typeClient: e.target.value })}
              >
                <option>B2C</option>
                <option>B2B</option>
              </select>
            </div>

            {/* Date & Heure */}
            <div className="col-md-2">
              <label className="form-label">Date</label>
              <input type="date" className="form-control"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label">Heure</label>
              <input type="time" className="form-control"
                value={form.heure}
                onChange={e => setForm({ ...form, heure: e.target.value })}
              />
            </div>

            {/* Note */}
            <div className="col-12">
              <label className="form-label">Note</label>
              <input className="form-control"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>

            {/* أزرار الإرسال / إلغاء / جديدة */}
            <div className="col-12 text-end">
              <button type="submit" className="btn btn-primary me-2">
                {editData ? "Mettre à jour" : "Enregistrer"}
              </button>
              {editData && (
                <button type="button" className="btn btn-secondary me-2" onClick={cancelEdit}>
                  Annuler
                </button>
              )}
              <button type="button" className="btn btn-success" onClick={() => setForm(defaultForm)}>
                Nouvelle demande
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}
