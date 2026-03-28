import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function logAuditAction({
  currentUser,
  adminProfile,
  action,
  entityType,
  entityId,
  description,
  metadata = {},
}) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      entityType,
      entityId,
      description,
      metadata,
      actorUid: currentUser?.uid || "",
      actorEmail: currentUser?.email || "",
      actorName: adminProfile?.displayName || currentUser?.displayName || currentUser?.email || "System",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
