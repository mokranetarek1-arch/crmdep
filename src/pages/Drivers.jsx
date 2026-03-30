import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { logAuditAction } from "../utils/audit";

const emptyDriver = {
  firstName: "",
  lastName: "",
  phone: "",
  wilaya: "",
  region: "",
  trucks: 1,
};

const isConfirmedStatus = (value) => String(value || "").toLowerCase().includes("confirm");
const formatMoney = (value) => `${Number(value || 0).toLocaleString("fr-FR")} DA`;

const parseDate = (value, fallback) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (fallback?.toDate) return fallback.toDate();
  if (fallback instanceof Date) return fallback;
  if (typeof fallback === "string") {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const getMonthKey = (date) => {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatField = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const getRequestCommissionAmount = (row) => {
  const explicitAmount = Number(row?.commissionAmount);
  if (Number.isFinite(explicitAmount) && explicitAmount >= 0) return explicitAmount;
  const rate = Number(row?.commissionRate);
  const safeRate = Number.isFinite(rate) ? rate : 10;
  return ((Number(row?.prix) || 0) * safeRate) / 100;
};

export default function Drivers({
  currentUser,
  adminProfile,
  profileMode = false,
  driverProfileId = "",
  onOpenProfile,
  onBackToList,
}) {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverTrips, setDriverTrips] = useState([]);
  const [allTrips, setAllTrips] = useState([]);
  const [driverStats, setDriverStats] = useState({
    totalTrips: 0,
    totalBenefit: 0,
    totalPayable: 0,
    monthly: {},
  });
  const [paymentByMonth, setPaymentByMonth] = useState({});
  const [paymentByTrip, setPaymentByTrip] = useState({});
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [newDriver, setNewDriver] = useState(emptyDriver);
  const [editingDriverId, setEditingDriverId] = useState("");
  const [editDriverForm, setEditDriverForm] = useState(emptyDriver);
  const [monthFilter, setMonthFilter] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [tripTypeFilter, setTripTypeFilter] = useState("");
  const [manualTripPaymentMode, setManualTripPaymentMode] = useState(false);

  const fetchDrivers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "drivers"));
      setDrivers(snapshot.docs.map((entry) => ({ driverId: entry.id, ...entry.data() })));
    } catch (error) {
      console.error(error);
      alert("Erreur lors du chargement des conducteurs");
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleAddDriver = async () => {
    if (!newDriver.firstName.trim() || !newDriver.wilaya.trim()) {
      alert("Le prenom et la wilaya sont obligatoires");
      return;
    }

    try {
      const ref = await addDoc(collection(db, "drivers"), newDriver);
      setDrivers((current) => [...current, { driverId: ref.id, ...newDriver }]);
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "create",
        entityType: "driver",
        entityId: ref.id,
        description: `Ajout du chauffeur ${newDriver.firstName} ${newDriver.lastName}`.trim(),
        metadata: { wilaya: newDriver.wilaya, phone: newDriver.phone || "" },
      });
      setNewDriver(emptyDriver);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'ajout du conducteur");
    }
  };

  const startEditDriver = (driver) => {
    setEditingDriverId(driver.driverId);
    setEditDriverForm({
      firstName: driver.firstName || "",
      lastName: driver.lastName || "",
      phone: driver.phone || "",
      wilaya: driver.wilaya || "",
      region: driver.region || "",
      trucks: Number(driver.trucks) || 1,
    });
  };

  const saveDriverEdit = async () => {
    if (!editingDriverId) return;

    try {
      const payload = { ...editDriverForm, trucks: Number(editDriverForm.trucks) || 1 };
      await updateDoc(doc(db, "drivers", editingDriverId), payload);
      await logAuditAction({
        currentUser,
        adminProfile,
        action: "update",
        entityType: "driver",
        entityId: editingDriverId,
        description: `Modification du chauffeur ${payload.firstName} ${payload.lastName}`.trim(),
        metadata: { wilaya: payload.wilaya, phone: payload.phone || "" },
      });

      setDrivers((current) =>
        current.map((driver) => (driver.driverId === editingDriverId ? { ...driver, ...payload } : driver))
      );
      if (selectedDriver?.driverId === editingDriverId) {
        setSelectedDriver((current) => ({ ...current, ...payload }));
      }

      setEditingDriverId("");
      setEditDriverForm(emptyDriver);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la modification du conducteur");
    }
  };

  const cancelDriverEdit = () => {
    setEditingDriverId("");
    setEditDriverForm(emptyDriver);
  };

  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm("Supprimer ce conducteur et ses demandes ?")) return;

    try {
      const deletedDriver = drivers.find((driver) => driver.driverId === driverId);
      await deleteDoc(doc(db, "drivers", driverId));
      const [requestsSnap, assuranceSnap] = await Promise.all([
        getDocs(query(collection(db, "requests"), where("driverId", "==", driverId))),
        getDocs(query(collection(db, "assuranceTrips"), where("driverId", "==", driverId))),
      ]);

      for (const trip of requestsSnap.docs) {
        await deleteDoc(doc(db, "requests", trip.id));
      }

      await logAuditAction({
        currentUser,
        adminProfile,
        action: "delete",
        entityType: "driver",
        entityId: driverId,
        description: `Suppression du chauffeur ${deletedDriver?.firstName || ""} ${deletedDriver?.lastName || ""}`.trim(),
        metadata: {},
      });
      for (const trip of assuranceSnap.docs) {
        await deleteDoc(doc(db, "assuranceTrips", trip.id));
      }

      setDrivers((current) => current.filter((driver) => driver.driverId !== driverId));
      if (selectedDriver?.driverId === driverId) {
        setSelectedDriver(null);
        setAllTrips([]);
        setDriverTrips([]);
        setPaymentByMonth({});
      }
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la suppression");
    }
  };

  const buildPaymentByMonth = (paymentDocs) => {
    const grouped = {};
    const groupedTrips = {};
    const records = paymentDocs.map((entry) => ({ id: entry.id, ...entry.data() }));
    paymentDocs.forEach((entry) => {
      const payment = entry.data();
      if (!payment.regle) return;
      const key = `${payment.year}-${String(payment.month).padStart(2, "0")}`;
      grouped[key] = grouped[key] || {
        total: 0,
        particulier: 0,
        assurance: 0,
        societe: 0,
        cashOut: 0,
        balanceOffsetParticulier: 0,
        balanceSettlements: 0,
      };

      if (payment.tripId) {
        groupedTrips[payment.tripId] = groupedTrips[payment.tripId] || {
          paidAmount: 0,
          cashOut: 0,
          offsetParticulier: 0,
          records: [],
        };
      }

      if (payment.actionType === "balance_payout") {
        const cashAmount = Number(payment.cashAmount ?? payment.amount) || 0;
        const offsetParticulier = Number(payment.offsetParticulier) || 0;
        const assuranceCovered = Number(payment.assuranceCovered) || 0;
        const societeCovered = Number(payment.societeCovered) || 0;

        grouped[key].cashOut += cashAmount;
        grouped[key].balanceOffsetParticulier += offsetParticulier;
        grouped[key].balanceSettlements += 1;
        grouped[key].particulier += offsetParticulier;
        grouped[key].assurance += assuranceCovered;
        grouped[key].societe += societeCovered;
        grouped[key].total += cashAmount + offsetParticulier;
        return;
      }

      if (payment.actionType === "trip_balance_payout") {
        const cashAmount = Number(payment.cashAmount ?? payment.amount) || 0;
        const offsetParticulier = Number(payment.offsetParticulier) || 0;
        const coveredAmount = Number(payment.coveredAmount ?? payment.amount) || 0;

        grouped[key].cashOut += cashAmount;
        grouped[key].balanceOffsetParticulier += offsetParticulier;
        grouped[key].balanceSettlements += 1;
        grouped[key].particulier += offsetParticulier;
        if (payment.sourceType && grouped[key][payment.sourceType] !== undefined) {
          grouped[key][payment.sourceType] += coveredAmount;
        }
        grouped[key].total += cashAmount + offsetParticulier;
        if (payment.tripId) {
          groupedTrips[payment.tripId].paidAmount += coveredAmount;
          groupedTrips[payment.tripId].cashOut += cashAmount;
          groupedTrips[payment.tripId].offsetParticulier += offsetParticulier;
          groupedTrips[payment.tripId].records.push({ id: entry.id, ...payment });
        }
        return;
      }

      const tripType =
        payment.tripType ||
        (payment.source === "requests" ? "particulier" : payment.source === "assuranceTrips" ? "assurance" : "");
      const amount = Number(payment.amount) || 0;
      grouped[key].total += amount;
      if (tripType && grouped[key][tripType] !== undefined) {
        grouped[key][tripType] += amount;
      }
      if (payment.actionType === "payout") {
        grouped[key].cashOut += amount;
      }
      if (payment.tripId) {
        groupedTrips[payment.tripId].paidAmount += amount;
        groupedTrips[payment.tripId].cashOut += payment.actionType === "payout" ? amount : 0;
        groupedTrips[payment.tripId].records.push({ id: entry.id, ...payment });
      }
    });
    setPaymentRecords(records);
    setPaymentByMonth(grouped);
    setPaymentByTrip(groupedTrips);
  };

  const isInPeriodRange = useCallback((date) => {
    if (!date) return false;
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (periodStart) {
      const start = new Date(periodStart);
      if (current < start) return false;
    }
    if (periodEnd) {
      const end = new Date(periodEnd);
      end.setHours(23, 59, 59, 999);
      if (current > end) return false;
    }
    return true;
  }, [periodStart, periodEnd]);

  const filterTripsByMonth = useCallback((trips, month, tripType = "") => {
    const filtered = trips.filter((trip) => {
      const matchMonth = month ? getMonthKey(trip.date) === month : true;
      const matchType = tripType ? trip.tripType === tripType : true;
      const matchPeriod = isInPeriodRange(trip.date);
      return matchMonth && matchType && matchPeriod;
    });

    const stats = filtered.reduce(
      (acc, trip) => {
        if (!trip.date) return acc;
        const monthKey = getMonthKey(trip.date);
        acc.totalTrips += 1;
        acc.totalBenefit += trip.commission;
        acc.totalPayable += trip.payableAmount;
        acc.monthly[monthKey] = acc.monthly[monthKey] || {
          benefit: 0,
          payable: 0,
          particulier: 0,
          assurance: 0,
          societe: 0,
          revenueParticulier: 0,
          revenueAssurance: 0,
          revenueSociete: 0,
          payableParticulier: 0,
          payableAssurance: 0,
          payableSociete: 0,
        };
        acc.monthly[monthKey].benefit += trip.commission;
        acc.monthly[monthKey].payable += trip.payableAmount;
        acc.monthly[monthKey][trip.tripType] += trip.commission;
        if (trip.tripType === "particulier") {
          acc.monthly[monthKey].payableParticulier += trip.payableAmount;
          acc.monthly[monthKey].revenueParticulier += trip.price;
        }
        if (trip.tripType === "assurance") {
          acc.monthly[monthKey].payableAssurance += trip.payableAmount;
          acc.monthly[monthKey].revenueAssurance += trip.price;
        }
        if (trip.tripType === "societe") {
          acc.monthly[monthKey].payableSociete += trip.payableAmount;
          acc.monthly[monthKey].revenueSociete += trip.price;
        }
        return acc;
      },
      { totalTrips: 0, totalBenefit: 0, totalPayable: 0, monthly: {} }
    );

    setDriverTrips(filtered);
    setDriverStats(stats);
  }, [isInPeriodRange]);

  const fetchDriverTrips = useCallback(async (driver) => {
    setSelectedDriver(driver);

    const [requestsSnap, assuranceSnap, paymentsSnap] = await Promise.all([
      getDocs(query(collection(db, "requests"), where("driverId", "==", driver.driverId))),
      getDocs(query(collection(db, "assuranceTrips"), where("driverId", "==", driver.driverId))),
      getDocs(query(collection(db, "driverPayments"), where("driverId", "==", driver.driverId))),
    ]);

    const requestTrips = requestsSnap.docs
      .map((entry) => {
        const trip = entry.data();
        const date = parseDate(trip.date, trip.createdAt || trip.timestamp);
        const price = Number(trip.prix) || 0;
        const commission = getRequestCommissionAmount(trip);
        return {
          id: entry.id,
          tripType: "particulier",
          paymentSource: "requests",
          date,
          depart: trip.depart || "-",
          destination: trip.destination || "-",
          km: Number(trip.kilometrage) || 0,
          price,
          commission,
          payableAmount: commission,
          status: trip.status || "En cours",
          companyName: "",
          numeroDossier: "",
        };
      })
      .filter((trip) => isConfirmedStatus(trip.status));

    const assuranceTrips = assuranceSnap.docs
      .map((entry) => {
        const trip = entry.data();
        const date = parseDate(trip.date, trip.timestamp || trip.createdAt);
        const price = Number(trip.prix) || 0;
        const tripType = trip.typePayment === "societe" ? "societe" : "assurance";
        return {
          id: entry.id,
          tripType,
          paymentSource: "assuranceTrips",
          date,
          depart: trip.depart || "-",
          destination: trip.destination || "-",
          km: Number(trip.kilometrage) || 0,
          price,
          commission: Number(trip.commission) || 0,
          payableAmount: Number(trip.driverSalary) || 0,
          status: trip.status || "En cours",
          companyName: trip.companyName || "",
          numeroDossier: trip.numeroDossier || "",
        };
      })
      .filter((trip) => isConfirmedStatus(trip.status));

    const mergedTrips = [...requestTrips, ...assuranceTrips].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    setAllTrips(mergedTrips);
    filterTripsByMonth(mergedTrips, monthFilter, tripTypeFilter);
    buildPaymentByMonth(paymentsSnap.docs);
  }, [filterTripsByMonth, monthFilter, tripTypeFilter]);

  useEffect(() => {
    if (!profileMode || !driverProfileId || drivers.length === 0) return;
    const targetDriver = drivers.find((driver) => driver.driverId === driverProfileId);
    if (targetDriver) {
      fetchDriverTrips(targetDriver);
    }
  }, [profileMode, driverProfileId, drivers, fetchDriverTrips]);

  useEffect(() => {
    if (selectedDriver) {
      filterTripsByMonth(allTrips, monthFilter, tripTypeFilter);
    }
  }, [monthFilter, tripTypeFilter, periodStart, periodEnd, allTrips, selectedDriver, filterTripsByMonth]);

  const monthlyRows = useMemo(
    () =>
      Object.entries(driverStats.monthly)
        .sort(([first], [second]) => second.localeCompare(first))
        .map(([month, values]) => {
          const paidAmount = paymentByMonth[month] || {};
          const remainingParticulier = Math.max(values.payableParticulier - (paidAmount.particulier || 0), 0);
          const remainingAssurance = Math.max(values.payableAssurance - (paidAmount.assurance || 0), 0);
          const remainingSociete = Math.max(values.payableSociete - (paidAmount.societe || 0), 0);
          const netBalance = remainingParticulier - (remainingAssurance + remainingSociete);
          const amountWeOweDriver = remainingAssurance + remainingSociete;
          const amountDriverOwesUs = remainingParticulier;
          const netPaymentToDriver = Math.max(amountWeOweDriver - amountDriverOwesUs, 0);
          const offsetUsed = Math.min(amountDriverOwesUs, amountWeOweDriver);
          const hasMonthlyPayments = paymentRecords.some(
            (payment) =>
              payment.regle === true &&
              `${payment.year}-${String(payment.month).padStart(2, "0")}` === month
          );
          return {
            month,
            ...values,
            paidAmount: paidAmount.total || 0,
            paidParticulier: paidAmount.particulier || 0,
            paidAssurance: paidAmount.assurance || 0,
            paidSociete: paidAmount.societe || 0,
            cashOut: paidAmount.cashOut || 0,
            balanceOffsetParticulier: paidAmount.balanceOffsetParticulier || 0,
            hasBalanceSettlement: (paidAmount.balanceSettlements || 0) > 0,
            remainingParticulier,
            remainingAssurance,
            remainingSociete,
            remaining: Math.max(values.payable - (paidAmount.total || 0), 0),
            isPaid: (paidAmount.total || 0) >= values.payable && values.payable > 0,
            netBalance,
            amountWeOweDriver,
            amountDriverOwesUs,
            netPaymentToDriver,
            offsetUsed,
            hasMonthlyPayments,
          };
        }),
    [driverStats.monthly, paymentByMonth, paymentRecords]
  );

  const paidTotal = monthlyRows.reduce((sum, row) => sum + row.cashOut, 0);
  const netBalanceTotal = monthlyRows.reduce((sum, row) => sum + row.netBalance, 0);
  const monthlyRowsMap = useMemo(() => Object.fromEntries(monthlyRows.map((row) => [row.month, row])), [monthlyRows]);
  const typeTotals = useMemo(
    () =>
      driverTrips.reduce(
        (acc, trip) => {
          acc[trip.tripType] += trip.commission;
          return acc;
        },
        { particulier: 0, assurance: 0, societe: 0 }
      ),
    [driverTrips]
  );
  const driverRevenueTotals = useMemo(
    () =>
      driverTrips.reduce(
        (acc, trip) => {
          acc[trip.tripType] += trip.price;
          acc.total += trip.price;
          return acc;
        },
        { particulier: 0, assurance: 0, societe: 0, total: 0 }
      ),
    [driverTrips]
  );

  const refreshPayments = async (driverId) => {
    const paymentsSnap = await getDocs(query(collection(db, "driverPayments"), where("driverId", "==", driverId)));
    buildPaymentByMonth(paymentsSnap.docs);
  };

  const getRemainingParticulierDebt = () => {
    const totalParticulierDue = allTrips
      .filter((trip) => trip.tripType === "particulier")
      .reduce((sum, trip) => sum + trip.payableAmount, 0);
    const totalParticulierCovered = paymentRecords.reduce((sum, payment) => {
      if (!payment.regle) return sum;
      if (payment.tripType === "particulier") return sum + (Number(payment.amount) || 0);
      if (payment.actionType === "trip_balance_payout" || payment.actionType === "balance_payout") {
        return sum + (Number(payment.offsetParticulier) || 0);
      }
      return sum;
    }, 0);
    return Math.max(totalParticulierDue - totalParticulierCovered, 0);
  };

  const handleMonthlyParticulierSettlement = async (row) => {
    if (!selectedDriver) return;
    if (row.remainingParticulier <= 0) return;
    if (!window.confirm(`Marquer ${formatMoney(row.remainingParticulier)} comme regle pour le particulier sur ${row.month} ?`)) {
      return;
    }

    const [yearStr, monthStr] = row.month.split("-");
    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      source: "requests",
      tripType: "particulier",
      actionType: "collect",
      month: monthStr,
      year: Number(yearStr),
      amount: row.remainingParticulier,
      regle: true,
      paidAt: serverTimestamp(),
    });
    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${row.month}-particulier`,
      description: `Reglement particulier pour ${row.month}`,
      metadata: { driverId: selectedDriver.driverId, month: row.month, tripType: "particulier", amount: row.remainingParticulier },
    });

    await refreshPayments(selectedDriver.driverId);
  };

  const handleTripPayment = async (trip) => {
    if (!selectedDriver) return;
    if (!["assurance", "societe"].includes(trip.tripType)) return;
    const tripPaid = paymentByTrip[trip.id]?.paidAmount || 0;
    const remainingTripAmount = Math.max(trip.payableAmount - tripPaid, 0);
    if (remainingTripAmount <= 0) return;
    const availableParticulierDebt = getRemainingParticulierDebt();
    const offsetParticulier = Math.min(availableParticulierDebt, remainingTripAmount);
    const cashAmount = Math.max(remainingTripAmount - offsetParticulier, 0);
    const shouldConfirm = window.confirm(
      `Regler cette course ${trip.tripType} ?\n\nMontant course: ${formatMoney(remainingTripAmount)}\nCompensation particulier: ${formatMoney(
        offsetParticulier
      )}\nPaiement reel: ${formatMoney(cashAmount)}`
    );
    if (!shouldConfirm) return;

    const month = getMonthKey(trip.date);
    const [yearStr, monthStr] = month.split("-");
    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      source: "assuranceTrips",
      sourceType: trip.tripType,
      tripType: trip.tripType,
      actionType: "trip_balance_payout",
      tripId: trip.id,
      month: monthStr,
      year: Number(yearStr),
      amount: remainingTripAmount,
      coveredAmount: remainingTripAmount,
      cashAmount,
      offsetParticulier,
      regle: true,
      paidAt: serverTimestamp(),
    });
    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${trip.id}-trip-payment`,
      description: `Paiement ${trip.tripType} pour la course ${trip.id}`,
      metadata: {
        driverId: selectedDriver.driverId,
        tripId: trip.id,
        month,
        tripType: trip.tripType,
        actionType: "trip_balance_payout",
        cashAmount,
        offsetParticulier,
        coveredAmount: remainingTripAmount,
      },
    });

    await refreshPayments(selectedDriver.driverId);
  };

  const handleMonthlyBalancePayment = async (row) => {
    if (!selectedDriver) return;
    if (row.amountWeOweDriver <= 0) return;

    const shouldConfirm = window.confirm(
      `Regler le solde du mois ${row.month} ?\n\nNous devons: ${formatMoney(row.amountWeOweDriver)}\nLe chauffeur doit: ${formatMoney(
        row.amountDriverOwesUs
      )}\nPaiement reel: ${formatMoney(row.netPaymentToDriver)}`
    );
    if (!shouldConfirm) return;

    const [yearStr, monthStr] = row.month.split("-");
    await addDoc(collection(db, "driverPayments"), {
      driverId: selectedDriver.driverId,
      source: "balance",
      tripType: "balance",
      actionType: "balance_payout",
      month: monthStr,
      year: Number(yearStr),
      amount: row.netPaymentToDriver,
      cashAmount: row.netPaymentToDriver,
      offsetParticulier: row.offsetUsed,
      assuranceCovered: row.remainingAssurance,
      societeCovered: row.remainingSociete,
      regle: true,
      paidAt: serverTimestamp(),
    });
    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${row.month}-balance`,
      description: `Reglement du solde mensuel pour ${row.month}`,
      metadata: {
        driverId: selectedDriver.driverId,
        month: row.month,
        actionType: "balance_payout",
        cashAmount: row.netPaymentToDriver,
        offsetParticulier: row.offsetUsed,
        assuranceCovered: row.remainingAssurance,
        societeCovered: row.remainingSociete,
      },
    });

    await refreshPayments(selectedDriver.driverId);
  };

  const undoTripPayment = async (trip) => {
    if (!selectedDriver) return;
    if (!window.confirm(`Annuler le paiement de cette course ${trip.tripType} ?`)) return;

    const targetPayments = paymentRecords.filter((payment) => payment.tripId === trip.id && payment.regle === true);
    for (const payment of targetPayments) {
      await deleteDoc(doc(db, "driverPayments", payment.id));
    }

    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment_cancel",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${trip.id}-trip-payment`,
      description: `Annulation paiement course ${trip.id}`,
      metadata: { driverId: selectedDriver.driverId, tripId: trip.id, tripType: trip.tripType },
    });

    await refreshPayments(selectedDriver.driverId);
  };

  const undoMonthPayments = async (month) => {
    if (!selectedDriver) return;
    if (!window.confirm(`Annuler toutes les actions de paiement du mois ${month} ?`)) return;

    const targetPayments = paymentRecords.filter(
      (payment) =>
        payment.regle === true &&
        `${payment.year}-${String(payment.month).padStart(2, "0")}` === month
    );

    if (targetPayments.length === 0) return;

    for (const payment of targetPayments) {
      await deleteDoc(doc(db, "driverPayments", payment.id));
    }

    await logAuditAction({
      currentUser,
      adminProfile,
      action: "payment_cancel",
      entityType: "driverPayment",
      entityId: `${selectedDriver.driverId}-${month}-all`,
      description: `Annulation de toutes les actions de paiement pour ${month}`,
      metadata: { driverId: selectedDriver.driverId, month, count: targetPayments.length },
    });

    await refreshPayments(selectedDriver.driverId);
  };

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2 className="page-title">Conducteurs</h2>
          <p className="page-subtitle">Une vue chauffeur unique pour particulier, assurance et societe.</p>
        </div>
      </div>

      {!profileMode ? (
      <div className="panel-card mb-4">
        <div className="row g-2">
          {["firstName", "lastName", "phone", "wilaya", "region"].map((field) => (
            <div key={field} className="col-md-2">
              <input
                className="form-control"
                placeholder={field}
                value={newDriver[field]}
                onChange={(event) => setNewDriver({ ...newDriver, [field]: event.target.value })}
              />
            </div>
          ))}
          <div className="col-md-1">
            <input
              type="number"
              className="form-control"
              value={newDriver.trucks}
              onChange={(event) => setNewDriver({ ...newDriver, trucks: Number(event.target.value) || 1 })}
            />
          </div>
          <div className="col-md-1">
            <button className="btn btn-success w-100" onClick={handleAddDriver}>
              Ajouter
            </button>
          </div>
        </div>
      </div>
      ) : null}

      {!profileMode ? (
      <div className="row g-3">
        {drivers.map((driver) => (
          <div key={driver.driverId} className="col-md-4">
            <div className="panel-card h-100">
              {editingDriverId === driver.driverId ? (
                <>
                  <div className="row g-2 mb-3">
                    {["firstName", "lastName", "phone", "wilaya", "region"].map((field) => (
                      <div key={field} className="col-6">
                        <input
                          className="form-control"
                          value={editDriverForm[field]}
                          onChange={(event) => setEditDriverForm({ ...editDriverForm, [field]: event.target.value })}
                        />
                      </div>
                    ))}
                    <div className="col-6">
                      <input
                        type="number"
                        className="form-control"
                        value={editDriverForm.trucks}
                        onChange={(event) =>
                          setEditDriverForm({ ...editDriverForm, trucks: Number(event.target.value) || 1 })
                        }
                      />
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-success btn-sm" onClick={saveDriverEdit}>
                      Enregistrer
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={cancelDriverEdit}>
                      Annuler
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h5 className="mb-3">
                    {formatField(driver.firstName)} {formatField(driver.lastName)}
                  </h5>
                  <p className="mb-2">Telephone: {formatField(driver.phone)}</p>
                  <p className="mb-2">
                    Wilaya: {formatField(driver.wilaya)} | Region: {formatField(driver.region)}
                  </p>
                  <p className="mb-3">Camions: {formatField(driver.trucks)}</p>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-info btn-sm"
                      onClick={() => (onOpenProfile ? onOpenProfile(driver.driverId) : fetchDriverTrips(driver))}
                    >
                      Details
                    </button>
                    <button className="btn btn-warning btn-sm" onClick={() => startEditDriver(driver)}>
                      Modifier
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDriver(driver.driverId)}>
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      ) : null}

      {selectedDriver ? (
        <div className="mt-4">
          <div className="page-header">
            <div>
              <h3 className="page-title">
                Compte chauffeur {formatField(selectedDriver.firstName)} {formatField(selectedDriver.lastName)}
              </h3>
              <p className="page-subtitle">Les courses particulier, assurance et societe sont fusionnees dans ce compte.</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedDriver(null);
                if (profileMode && onBackToList) {
                  onBackToList();
                }
              }}
            >
              {profileMode ? "Retour aux conducteurs" : "Retour"}
            </button>
          </div>

          <div className="panel-card mb-4">
            <div className="row">
              <div className="col-md-3">
                <label className="form-label">Filtrer par mois</label>
                <input type="month" className="form-control" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Periode du</label>
                <input type="date" className="form-control" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">au</label>
                <input type="date" className="form-control" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Type de course</label>
                <select className="form-select" value={tripTypeFilter} onChange={(event) => setTripTypeFilter(event.target.value)}>
                  <option value="">Tous</option>
                  <option value="particulier">Particulier</option>
                  <option value="assurance">Assurance</option>
                  <option value="societe">Societe</option>
                </select>
              </div>
            </div>
            <div className="form-check form-switch mt-3">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="manualTripPaymentMode"
                checked={manualTripPaymentMode}
                onChange={(event) => setManualTripPaymentMode(event.target.checked)}
              />
              <label className="form-check-label" htmlFor="manualTripPaymentMode">
                Paiement manuel par course pour assurance et societe
              </label>
            </div>
          </div>

          <div className="panel-card mb-4">
            <h5 className="section-title">Revenu chauffeur</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Particulier</span>
                  <strong className="metric-value">{formatMoney(driverRevenueTotals.particulier)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Assurance</span>
                  <strong className="metric-value">{formatMoney(driverRevenueTotals.assurance)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Societe</span>
                  <strong className="metric-value">{formatMoney(driverRevenueTotals.societe)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card metric-card--success">
                  <span className="metric-label">Revenu total</span>
                  <strong className="metric-value">{formatMoney(driverRevenueTotals.total)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="panel-card mb-4">
            <h5 className="section-title">Commission / benefice</h5>
            <div className="row g-3">
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Particulier</span>
                  <strong className="metric-value">{formatMoney(typeTotals.particulier)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Assurance</span>
                  <strong className="metric-value">{formatMoney(typeTotals.assurance)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card">
                  <span className="metric-label">Societe</span>
                  <strong className="metric-value">{formatMoney(typeTotals.societe)}</strong>
                </div>
              </div>
              <div className="col-md-3">
                <div className="metric-card metric-card--success">
                  <span className="metric-label">Total</span>
                  <strong className="metric-value">{formatMoney(driverStats.totalBenefit)}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Courses confirmees</span>
                <strong className="metric-value">{driverStats.totalTrips}</strong>
              </div>
            </div>
            <div className="col-md-3">
              <div className="metric-card">
                <span className="metric-label">Paiement reel effectue</span>
                <strong className="metric-value">{formatMoney(paidTotal)}</strong>
              </div>
            </div>
            <div className="col-md-6">
              <div className={`metric-card ${netBalanceTotal >= 0 ? "metric-card--success" : "metric-card--danger"}`}>
                <span className="metric-label">Solde net</span>
                <strong className="metric-value">{formatMoney(Math.abs(netBalanceTotal))}</strong>
                <div className="small text-muted mt-2">
                  {netBalanceTotal > 0
                    ? "Le chauffeur doit encore ce montant"
                    : netBalanceTotal < 0
                    ? "Nous devons encore ce montant au chauffeur"
                    : "Solde equilibre"}
                </div>
              </div>
            </div>
          </div>

          <div className="panel-card mb-4">
            <h5 className="section-title">Paiements par mois</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th>Revenu chauffeur</th>
                    <th>Particulier</th>
                    <th>Assurance</th>
                    <th>Societe</th>
                    <th>Particulier regle</th>
                    <th>Assurance reglee</th>
                    <th>Societe reglee</th>
                    <th>Paiement reel</th>
                    <th>Solde net</th>
                    <th>Particulier</th>
                    <th>Reglage</th>
                    <th>Annulation</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 ? (
                    <tr>
                      <td colSpan="13" className="text-center text-muted py-4">
                        Aucun mois a afficher.
                      </td>
                    </tr>
                  ) : (
                    monthlyRows.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>
                          <div className="small">
                            <div>Part: {formatMoney(row.revenueParticulier)}</div>
                            <div>Ass: {formatMoney(row.revenueAssurance)}</div>
                            <div>Soc: {formatMoney(row.revenueSociete)}</div>
                          </div>
                        </td>
                        <td>{formatMoney(row.particulier)}</td>
                        <td>{formatMoney(row.assurance)}</td>
                        <td>{formatMoney(row.societe)}</td>
                        <td>{formatMoney(row.paidParticulier)}</td>
                        <td>{formatMoney(row.paidAssurance)}</td>
                        <td>{formatMoney(row.paidSociete)}</td>
                        <td>{formatMoney(row.cashOut)}</td>
                        <td>
                          <span className={`badge ${row.netBalance > 0 ? "bg-success" : row.netBalance < 0 ? "bg-danger" : "bg-secondary"}`}>
                            {row.netBalance > 0
                              ? `Chauffeur doit ${formatMoney(row.netBalance)}`
                              : row.netBalance < 0
                              ? `Nous devons ${formatMoney(Math.abs(row.netBalance))}`
                              : "Equilibre"}
                          </span>
                        </td>
                        <td>
                          {row.payableParticulier > 0 ? (
                            row.remainingParticulier > 0 ? (
                              <button className="btn btn-outline-primary btn-sm" onClick={() => handleMonthlyParticulierSettlement(row)}>
                                Marquer paye
                              </button>
                            ) : (
                              <span className="badge bg-success">Paye</span>
                            )
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {row.amountWeOweDriver > 0 ? (
                            <button className="btn btn-outline-success btn-sm" onClick={() => handleMonthlyBalancePayment(row)}>
                              Regler le solde
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {row.hasMonthlyPayments ? (
                            <button className="btn btn-outline-danger btn-sm" onClick={() => undoMonthPayments(row.month)}>
                              Annuler mois
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card">
            <h5 className="section-title">Liste des trajets</h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Depart</th>
                    <th>Destination</th>
                    <th>Km</th>
                    <th>Revenu</th>
                    <th>Commission</th>
                    {manualTripPaymentMode ? <th>Solde course</th> : null}
                    {manualTripPaymentMode ? <th>Action paiement</th> : null}
                    <th>Dossier / Societe</th>
                  </tr>
                </thead>
                <tbody>
                  {driverTrips.map((trip) => {
                    const tripPayment = paymentByTrip[trip.id];
                    const monthRow = monthlyRowsMap[getMonthKey(trip.date)] || null;
                    const coveredAmount = tripPayment?.paidAmount || 0;
                    const remainingAmount = Math.max(trip.payableAmount - coveredAmount, 0);
                    const isPaidByMonth =
                      trip.tripType === "particulier"
                        ? Boolean(monthRow && monthRow.payableParticulier > 0 && monthRow.remainingParticulier <= 0)
                        : Boolean(
                            monthRow &&
                              ((trip.tripType === "assurance" && monthRow.payableAssurance > 0 && monthRow.remainingAssurance <= 0) ||
                                (trip.tripType === "societe" && monthRow.payableSociete > 0 && monthRow.remainingSociete <= 0))
                          );
                    const isPaid = isPaidByMonth || (remainingAmount <= 0 && coveredAmount > 0);
                    const cashOut = tripPayment?.cashOut || 0;
                    const offsetParticulier = tripPayment?.offsetParticulier || 0;

                    return (
                      <tr key={`${trip.tripType}-${trip.id}`}>
                        <td>{trip.date ? trip.date.toLocaleDateString("fr-FR") : "-"}</td>
                        <td>
                          <span
                            className={`badge ${
                              trip.tripType === "particulier"
                                ? "bg-primary"
                                : trip.tripType === "assurance"
                                ? "bg-success"
                                : "bg-dark"
                            }`}
                          >
                            {trip.tripType}
                          </span>
                        </td>
                        <td>{trip.depart}</td>
                        <td>{trip.destination}</td>
                        <td>{trip.km}</td>
                        <td>{formatMoney(trip.price)}</td>
                        <td>{formatMoney(trip.commission)}</td>
                        {manualTripPaymentMode ? (
                          <td>
                            {trip.tripType === "particulier" ? (
                              <span className={`badge ${isPaid ? "bg-success" : "bg-warning text-dark"}`}>
                                {isPaid ? "Commission reglee" : `Reste ${formatMoney(remainingAmount)}`}
                              </span>
                            ) : (
                              <div className="small">
                                <div>Montant: {formatMoney(trip.payableAmount)}</div>
                                <div>Cash: {formatMoney(cashOut)}</div>
                                <div>Compense: {formatMoney(offsetParticulier)}</div>
                              </div>
                            )}
                          </td>
                        ) : null}
                        {manualTripPaymentMode ? (
                          <td>
                            {trip.tripType === "particulier" ? (
                              <span className={`badge ${isPaid ? "bg-success" : "bg-warning text-dark"}`}>
                                {isPaid ? "Commission reglee" : `Reste ${formatMoney(remainingAmount)}`}
                              </span>
                            ) : isPaid ? (
                              <button className="btn btn-outline-danger btn-sm" onClick={() => undoTripPayment(trip)}>
                                Annuler
                              </button>
                            ) : (
                              <button className="btn btn-outline-success btn-sm" onClick={() => handleTripPayment(trip)}>
                                Payer {formatMoney(trip.payableAmount)}
                              </button>
                            )}
                          </td>
                        ) : null}
                        <td>{trip.companyName || trip.numeroDossier || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
