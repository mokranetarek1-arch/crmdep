import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./StoreAdmin.css";
import { logAuditAction } from "../utils/audit";

const reservationStatuses = ["Pending", "Confirmed", "In Progress", "Completed", "Cancelled"];
const orderStatuses = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
const cloudinaryCloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || "";
const cloudinaryUploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || "";

const initialProductForm = {
  name: "",
  price: "",
  category: "",
  stock: "",
  imageURL: "",
  imageURLs: "",
  description: "",
};

function readDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => {
    const first = readDate(a.createdAt)?.getTime() || 0;
    const second = readDate(b.createdAt)?.getTime() || 0;
    return second - first;
  });
}

function formatDate(value) {
  const date = readDate(value);
  return date ? date.toLocaleString("fr-FR") : "-";
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("fr-FR")} DZD` : "0 DZD";
}

export default function StoreAdmin({ currentUser, adminProfile }) {
  const [bookings, setBookings] = useState([]);
  const [productOrders, setProductOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [editingProductId, setEditingProductId] = useState("");

  useEffect(() => {
    const unsubscribeBookings = onSnapshot(collection(db, "orders"), (snapshot) => {
      setBookings(sortByCreatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
    });

    const unsubscribeProductOrders = onSnapshot(collection(db, "product_orders"), (snapshot) => {
      setProductOrders(sortByCreatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
    });

    const unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(sortByCreatedAt(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))));
    });

    return () => {
      unsubscribeBookings();
      unsubscribeProductOrders();
      unsubscribeProducts();
    };
  }, []);

  const stats = useMemo(() => {
    const pendingBookings = bookings.filter((item) => item.status === "Pending").length;
    const pendingOrders = productOrders.filter((item) => item.status === "pending").length;

    return {
      bookings: bookings.length,
      pendingBookings,
      productOrders: productOrders.length,
      pendingOrders,
      products: products.length,
    };
  }, [bookings, productOrders, products]);

  const updateBookingStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, "orders", id), { status });
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "update",
        entityType: "booking",
        entityId: id,
        description: `Changement de statut reservation vers ${status}`,
        metadata: { status },
      });
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise a jour de la reservation.");
    }
  };

  const updateProductOrderStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, "product_orders", id), { status });
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "update",
        entityType: "productOrder",
        entityId: id,
        description: `Changement de statut commande produit vers ${status}`,
        metadata: { status },
      });
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise a jour de la commande.");
    }
  };

  const removeDocument = async (collectionName, id, label) => {
    if (!window.confirm(`Supprimer ${label} ?`)) return;

    try {
      await deleteDoc(doc(db, collectionName, id));
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "delete",
        entityType: collectionName,
        entityId: id,
        description: `Suppression ${label}`,
        metadata: {},
      });
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression.");
    }
  };

  const handleProductChange = ({ target: { name, value } }) => {
    setProductForm((current) => ({ ...current, [name]: value }));
  };

  const uploadToCloudinary = async (file) => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      throw new Error("Configuration Cloudinary manquante");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryUploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const payload = await response.json();

    if (!response.ok || !payload.secure_url) {
      throw new Error(payload?.error?.message || "Echec de l'upload Cloudinary");
    }

    return payload.secure_url;
  };

  const handleMainImageUpload = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) return;

    setUploadingMainImage(true);

    try {
      const imageURL = await uploadToCloudinary(file);
      setProductForm((current) => ({ ...current, imageURL }));
    } catch (error) {
      console.error(error);
      alert(
        "Upload impossible. Verifie REACT_APP_CLOUDINARY_CLOUD_NAME et REACT_APP_CLOUDINARY_UPLOAD_PRESET."
      );
    } finally {
      setUploadingMainImage(false);
      target.value = "";
    }
  };

  const handleGalleryUpload = async ({ target }) => {
    const files = Array.from(target.files || []);
    if (files.length === 0) return;

    setUploadingGallery(true);

    try {
      const uploadedUrls = await Promise.all(files.map(uploadToCloudinary));
      setProductForm((current) => {
        const existing = current.imageURLs
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        return {
          ...current,
          imageURLs: [...existing, ...uploadedUrls].join(", "),
        };
      });
    } catch (error) {
      console.error(error);
      alert(
        "Upload galerie impossible. Verifie REACT_APP_CLOUDINARY_CLOUD_NAME et REACT_APP_CLOUDINARY_UPLOAD_PRESET."
      );
    } finally {
      setUploadingGallery(false);
      target.value = "";
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    setSavingProduct(true);

    try {
      const gallery = productForm.imageURLs
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        name: productForm.name.trim(),
        price: Number(productForm.price) || 0,
        category: productForm.category.trim(),
        stock: Number(productForm.stock) || 0,
        imageURL: productForm.imageURL.trim(),
        imageURLs: gallery,
        description: productForm.description.trim(),
        updatedByUid: currentUser?.uid || "",
        updatedByEmail: currentUser?.email || "",
        updatedByName: adminProfile?.displayName || currentUser?.displayName || "",
        updatedAt: serverTimestamp(),
      };

      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), payload);
        await logAuditAction({
          currentUser,
          adminProfile,
          action: "update",
          entityType: "product",
          entityId: editingProductId,
          description: `Modification du produit ${payload.name}`,
          metadata: { price: payload.price, stock: payload.stock },
        });
      } else {
        const docRef = await addDoc(collection(db, "products"), {
          ...payload,
          createdByUid: currentUser?.uid || "",
          createdByEmail: currentUser?.email || "",
          createdByName: adminProfile?.displayName || currentUser?.displayName || "",
          createdAt: serverTimestamp(),
        });
        await logAuditAction({
          currentUser,
          adminProfile,
          action: "create",
          entityType: "product",
          entityId: docRef.id,
          description: `Ajout du produit ${payload.name}`,
          metadata: { price: payload.price, stock: payload.stock },
        });
      }

      setEditingProductId("");
      setProductForm(initialProductForm);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'enregistrement du produit.");
    } finally {
      setSavingProduct(false);
    }
  };

  const startEditProduct = (product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name || "",
      price: String(product.price ?? ""),
      category: product.category || "",
      stock: String(product.stock ?? ""),
      imageURL: product.imageURL || "",
      imageURLs: Array.isArray(product.imageURLs) ? product.imageURLs.join(", ") : "",
      description: product.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditProduct = () => {
    setEditingProductId("");
    setProductForm(initialProductForm);
  };

  return (
    <div className="store-admin-page">
      <div className="row g-3 mb-4">
        <StatCard title="Reservations" value={stats.bookings} note={`${stats.pendingBookings} en attente`} />
        <StatCard title="Commandes" value={stats.productOrders} note={`${stats.pendingOrders} en attente`} />
        <StatCard title="Produits" value={stats.products} note="Catalogue store" />
      </div>

      <div className="row g-4">
        <div className="col-12">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h2 className="h4 mb-1">Reservations site</h2>
              <p className="text-muted mb-3">Demandes envoyees depuis le formulaire de reservation.</p>

              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Telephone</th>
                      <th>Vehicule</th>
                      <th>Trajet</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          Aucune reservation.
                        </td>
                      </tr>
                    ) : (
                      bookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>
                            <strong>{`${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "-"}</strong>
                            <div className="small text-muted">{booking.imatriculation || "-"}</div>
                          </td>
                          <td>{booking.phone || "-"}</td>
                          <td>{booking.carName || "-"}</td>
                          <td>
                            <div>{booking.start || "-"}</div>
                            <div className="small text-muted">{booking.end || "-"}</div>
                          </td>
                          <td>{booking.date || formatDate(booking.createdAt)}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={booking.status || "Pending"}
                              onChange={(event) => updateBookingStatus(booking.id, event.target.value)}
                            >
                              {reservationStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeDocument("orders", booking.id, "cette reservation")}
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
          </div>
        </div>

        <div className="col-12">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h2 className="h4 mb-1">Commandes produits</h2>
              <p className="text-muted mb-3">Suivi des commandes envoyees depuis le store.</p>

              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Client</th>
                      <th>Livraison</th>
                      <th>Total</th>
                      <th>Date</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productOrders.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">
                          Aucune commande produit.
                        </td>
                      </tr>
                    ) : (
                      productOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <strong>{order.productName || "-"}</strong>
                            <div className="small text-muted">Qte: {order.quantity || 0}</div>
                          </td>
                          <td>
                            <div>{order.clientName || "-"}</div>
                            <div className="small text-muted">{order.phoneNumber || "-"}</div>
                          </td>
                          <td>
                            <div>{order.wilaya || "-"}</div>
                            <div className="small text-muted">{order.adresse || "-"}</div>
                          </td>
                          <td>{formatAmount(order.totalPrice)}</td>
                          <td>{formatDate(order.createdAt)}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={order.status || "pending"}
                              onChange={(event) => updateProductOrderStatus(order.id, event.target.value)}
                            >
                              {orderStatuses.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeDocument("product_orders", order.id, "cette commande")}
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
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h2 className="h4 mb-1">{editingProductId ? "Modifier un produit" : "Ajouter un produit"}</h2>
              <p className="text-muted mb-3">
                {editingProductId ? "Change photo, prix, stock et details du produit." : "Ajout rapide dans la collection products."}
              </p>

              <form onSubmit={submitProduct}>
                <div className="mb-3">
                  <label className="form-label">Nom</label>
                  <input
                    className="form-control"
                    name="name"
                    value={productForm.name}
                    onChange={handleProductChange}
                    required
                  />
                </div>

                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label">Prix (DZD)</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      name="price"
                      value={productForm.price}
                      onChange={handleProductChange}
                      required
                    />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Stock</label>
                    <input
                      className="form-control"
                      type="number"
                      min="0"
                      name="stock"
                      value={productForm.stock}
                      onChange={handleProductChange}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label">Categorie</label>
                  <input
                    className="form-control"
                    name="category"
                    value={productForm.category}
                    onChange={handleProductChange}
                  />
                </div>

                <div className="mt-3">
                  <label className="form-label">Image principale (URL)</label>
                  <input
                    className="form-control"
                    name="imageURL"
                    value={productForm.imageURL}
                    onChange={handleProductChange}
                  />
                  <input
                    className="form-control mt-2"
                    type="file"
                    accept="image/*"
                    onChange={handleMainImageUpload}
                    disabled={uploadingMainImage || !cloudinaryCloudName || !cloudinaryUploadPreset}
                  />
                  <div className="form-text">
                    {uploadingMainImage ? "Upload en cours..." : "Tu peux coller une URL ou envoyer un fichier."}
                  </div>
                  {productForm.imageURL ? (
                    <img
                      src={productForm.imageURL}
                      alt="Apercu principal"
                      className="store-admin-preview mt-2"
                    />
                  ) : null}
                </div>

                <div className="mt-3">
                  <label className="form-label">Galerie (URLs separees par virgule)</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    name="imageURLs"
                    value={productForm.imageURLs}
                    onChange={handleProductChange}
                  />
                  <input
                    className="form-control mt-2"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryUpload}
                    disabled={uploadingGallery || !cloudinaryCloudName || !cloudinaryUploadPreset}
                  />
                  <div className="form-text">
                    {uploadingGallery ? "Upload galerie en cours..." : "Selection multiple autorisee."}
                  </div>
                  {productForm.imageURLs ? (
                    <div className="store-admin-gallery mt-2">
                      {productForm.imageURLs
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((url) => (
                          <img key={url} src={url} alt="Apercu galerie" className="store-admin-thumb" />
                        ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    name="description"
                    value={productForm.description}
                    onChange={handleProductChange}
                  />
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button type="submit" className="btn btn-danger w-100" disabled={savingProduct}>
                    {savingProduct ? "Enregistrement..." : editingProductId ? "Mettre a jour" : "Ajouter au store"}
                  </button>
                  {editingProductId ? (
                    <button type="button" className="btn btn-outline-secondary w-100" onClick={cancelEditProduct}>
                      Annuler
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card shadow-sm border-0">
            <div className="card-body">
              <h2 className="h4 mb-1">Catalogue actuel</h2>
              <p className="text-muted mb-3">Produits disponibles dans la boutique.</p>

              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Prix</th>
                      <th>Stock</th>
                      <th>Categorie</th>
                      <th>Image</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          Aucun produit enregistre.
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <strong>{product.name || "-"}</strong>
                            <div className="small text-muted text-truncate store-admin-description">
                              {product.description || "Sans description"}
                            </div>
                          </td>
                          <td>{formatAmount(product.price)}</td>
                          <td>{product.stock ?? "-"}</td>
                          <td>{product.category || "-"}</td>
                          <td>
                            {product.imageURL ? (
                              <a href={product.imageURL} target="_blank" rel="noreferrer">
                                Voir
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => startEditProduct(product)}
                            >
                              Modifier
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => removeDocument("products", product.id, "ce produit")}
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
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, note }) {
  return (
    <div className="col-md-4">
      <div className="card border-0 shadow-sm h-100 store-admin-stat">
        <div className="card-body">
          <div className="text-muted mb-2">{title}</div>
          <div className="store-admin-stat-value">{value}</div>
          <div className="small text-muted">{note}</div>
        </div>
      </div>
    </div>
  );
}
