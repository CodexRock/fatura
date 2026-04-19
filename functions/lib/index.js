"use strict";
/**
 * Fatura — Firebase Cloud Functions
 *
 * All money values are in centimes (integer). 1 MAD = 100 centimes.
 * Region: europe-west1
 *
 * Functions:
 *   1. onInvoiceCreated — Firestore trigger: auto-generate PDF + log
 *   2. onInvoiceStatusChanged — Firestore trigger: handle status transitions
 *   3. sendInvoiceReminder — callable: WhatsApp deep-link builder
 *   4. generateTVAReport — callable: SIMPL-TVA quarter report
 *   5. validateICE — callable: ICE format validator
 *   6. scheduledOverdueCheck — scheduled daily 8am Africa/Casablanca
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledOverdueCheck = exports.validateICE = exports.generateTVAReport = exports.sendInvoiceReminder = exports.onInvoiceStatusChanged = exports.onInvoiceCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const pdfkit_1 = __importDefault(require("pdfkit"));
admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();
const REGION = "europe-west1";
const fn = functions.region(REGION);
// =============================================================================
// HELPERS
// =============================================================================
/** Convert centimes integer to MAD display string */
function centimesToMAD(centimes) {
    const val = centimes / 100;
    return val.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}
/** Format Firestore Timestamp or epoch to YYYY-MM-DD */
function formatDate(ts) {
    const d = ts instanceof admin.firestore.Timestamp
        ? ts.toDate()
        : new Date(ts._seconds * 1000);
    return d.toISOString().slice(0, 10);
}
/** Log an activity entry */
async function logActivity(businessId, userId, action, entityType, entityId, details = {}) {
    await db
        .collection("businesses").doc(businessId)
        .collection("activity").add({
        businessId,
        userId: userId || "system",
        action,
        entityType,
        entityId,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}
// =============================================================================
// 1. onInvoiceCreated — Generate PDF on invoice creation
// =============================================================================
exports.onInvoiceCreated = fn.firestore
    .document("businesses/{businessId}/invoices/{invoiceId}")
    .onCreate(async (snap, context) => {
    var _a;
    const { businessId, invoiceId } = context.params;
    const invoice = snap.data();
    if (!invoice)
        return;
    try {
        // Fetch business data for PDF header
        const businessDoc = await db.collection("businesses").doc(businessId).get();
        const business = businessDoc.data();
        if (!business) {
            functions.logger.error("Business not found", { businessId });
            return;
        }
        // Fetch client data
        const clientDoc = await db
            .collection("businesses").doc(businessId)
            .collection("clients").doc(invoice.clientId)
            .get();
        const client = clientDoc.data();
        // -----------------------------------------------------------------------
        // Generate PDF with PDFKit
        // -----------------------------------------------------------------------
        const pdfBuffer = await generateInvoicePDF(invoice, business, client, invoiceId);
        // Upload to Storage
        const filePath = `invoices/${businessId}/${invoiceId}.pdf`;
        const file = bucket.file(filePath);
        await file.save(pdfBuffer, {
            metadata: {
                contentType: "application/pdf",
                metadata: {
                    invoiceNumber: invoice.number || invoiceId,
                    businessId,
                },
            },
        });
        // Make file publicly accessible (or use signed URL)
        await file.makePublic();
        const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        // Update invoice with PDF URL
        await snap.ref.update({ pdfUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        // Log activity
        await logActivity(businessId, invoice.createdBy || business.ownerId || "system", "Facture créée", "invoice", invoiceId, { number: invoice.number, totalTTC: (_a = invoice.totals) === null || _a === void 0 ? void 0 : _a.totalTTC });
        functions.logger.info("Invoice PDF generated", { businessId, invoiceId, filePath });
    }
    catch (err) {
        functions.logger.error("onInvoiceCreated failed", { businessId, invoiceId, error: err });
    }
});
/**
 * Generate a professional invoice PDF using PDFKit.
 */
async function generateInvoicePDF(invoice, business, client, invoiceId) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: "A4", margin: 50, bufferPages: true });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        const brandColor = business.brandColor || "#1B4965";
        // --- Header bar ---
        doc.rect(0, 0, 595.28, 8).fill(brandColor);
        // --- Business Info (top-left) ---
        doc.fontSize(14).fillColor(brandColor).text(business.legalName || "Entreprise", 50, 30);
        doc.fontSize(8).fillColor("#666666");
        if (business.tradeName)
            doc.text(business.tradeName);
        if (business.address) {
            doc.text(`${business.address.street || ""}, ${business.address.postalCode || ""} ${business.address.city || ""}`);
        }
        if (business.phone)
            doc.text(`Tél: ${business.phone}`);
        if (business.email)
            doc.text(`Email: ${business.email}`);
        doc.moveDown(0.3);
        doc.fontSize(7).fillColor("#999999");
        if (business.ice)
            doc.text(`ICE: ${business.ice}`);
        if (business.identifiantFiscal)
            doc.text(`IF: ${business.identifiantFiscal}`);
        if (business.registreCommerce)
            doc.text(`RC: ${business.registreCommerce}`);
        // --- Invoice Title (top-right) ---
        const typeLabel = getInvoiceTypeLabel(invoice.type);
        doc.fontSize(20).fillColor(brandColor).text(typeLabel, 350, 30, { width: 200, align: "right" });
        doc.fontSize(10).fillColor("#333333").text(invoice.number || invoiceId, 350, 55, { width: 200, align: "right" });
        // --- Date block ---
        doc.fontSize(9).fillColor("#666666");
        doc.text(`Date d'émission: ${formatDate(invoice.issueDate)}`, 350, 75, { width: 200, align: "right" });
        if (invoice.dueDate) {
            doc.text(`Date d'échéance: ${formatDate(invoice.dueDate)}`, 350, 88, { width: 200, align: "right" });
        }
        // --- Client block ---
        const clientY = 140;
        doc.roundedRect(350, clientY, 200, 80, 4).fill("#f8fafc").stroke();
        doc.fontSize(7).fillColor("#999999").text("FACTURER À", 360, clientY + 8);
        doc.fontSize(10).fillColor("#333333").text((client === null || client === void 0 ? void 0 : client.name) || "Client", 360, clientY + 22, { width: 180 });
        doc.fontSize(8).fillColor("#666666");
        if (client === null || client === void 0 ? void 0 : client.address) {
            doc.text(`${client.address.street || ""}, ${client.address.postalCode || ""} ${client.address.city || ""}`, 360, clientY + 38, { width: 180 });
        }
        if (client === null || client === void 0 ? void 0 : client.ice)
            doc.text(`ICE: ${client.ice}`, 360, clientY + 55, { width: 180 });
        if (client === null || client === void 0 ? void 0 : client.phone)
            doc.text(`Tél: ${client.phone}`, 360, clientY + 65, { width: 180 });
        // --- Line items table ---
        const tableTop = 250;
        const cols = { desc: 50, qty: 310, unit: 360, tva: 420, total: 480 };
        // Table header
        doc.rect(50, tableTop, 495.28, 22).fill(brandColor);
        doc.fontSize(8).fillColor("#ffffff");
        doc.text("Description", cols.desc + 8, tableTop + 7);
        doc.text("Qté", cols.qty, tableTop + 7, { width: 40, align: "center" });
        doc.text("P.U. HT", cols.unit, tableTop + 7, { width: 50, align: "right" });
        doc.text("TVA", cols.tva, tableTop + 7, { width: 40, align: "center" });
        doc.text("Total HT", cols.total, tableTop + 7, { width: 60, align: "right" });
        // Table rows
        let y = tableTop + 28;
        const lines = invoice.lines || [];
        lines.forEach((line, i) => {
            const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
            doc.rect(50, y - 4, 495.28, 20).fill(bg);
            doc.fontSize(8).fillColor("#333333");
            doc.text(line.description || "", cols.desc + 8, y, { width: 250 });
            doc.text(String(line.quantity || 0), cols.qty, y, { width: 40, align: "center" });
            doc.text(centimesToMAD(line.unitPrice || 0), cols.unit, y, { width: 50, align: "right" });
            doc.text(`${line.tvaRate || 0}%`, cols.tva, y, { width: 40, align: "center" });
            doc.text(centimesToMAD(line.totalHT || 0), cols.total, y, { width: 60, align: "right" });
            y += 20;
        });
        // Divider
        y += 10;
        doc.moveTo(350, y).lineTo(545, y).strokeColor("#e2e8f0").stroke();
        y += 8;
        // --- Totals ---
        const totals = invoice.totals || {};
        doc.fontSize(9).fillColor("#666666");
        doc.text("Total HT", 360, y, { width: 100 });
        doc.text(centimesToMAD(totals.totalHT || 0), 460, y, { width: 80, align: "right" });
        y += 16;
        // TVA breakdown
        const tvaBreakdown = totals.tvaBreakdown || [];
        tvaBreakdown.forEach((t) => {
            doc.text(`TVA ${t.rate}%`, 360, y, { width: 100 });
            doc.text(centimesToMAD(t.amount || 0), 460, y, { width: 80, align: "right" });
            y += 14;
        });
        y += 4;
        doc.rect(350, y, 195, 24).fill(brandColor);
        doc.fontSize(11).fillColor("#ffffff");
        doc.text("Total TTC", 360, y + 6, { width: 100 });
        doc.text(centimesToMAD(totals.totalTTC || 0), 460, y + 6, { width: 80, align: "right" });
        // --- Notes ---
        if (invoice.notes) {
            const notesY = Math.max(y + 50, 550);
            doc.fontSize(8).fillColor("#999999").text("Notes:", 50, notesY);
            doc.fontSize(8).fillColor("#666666").text(invoice.notes, 50, notesY + 12, { width: 300 });
        }
        // --- Bank details (footer) ---
        if (business.bankDetails) {
            const bk = business.bankDetails;
            const bankY = 720;
            doc.fontSize(7).fillColor("#999999");
            doc.text("Coordonnées Bancaires", 50, bankY);
            doc.fontSize(7).fillColor("#666666");
            if (bk.bankName)
                doc.text(`Banque: ${bk.bankName}`, 50, bankY + 10);
            if (bk.rib)
                doc.text(`RIB: ${bk.rib}`, 50, bankY + 20);
            if (bk.iban)
                doc.text(`IBAN: ${bk.iban}`, 250, bankY + 10);
            if (bk.swift)
                doc.text(`SWIFT: ${bk.swift}`, 250, bankY + 20);
        }
        // --- Footer bar ---
        doc.rect(0, 841.89 - 8, 595.28, 8).fill(brandColor);
        doc.end();
    });
}
function getInvoiceTypeLabel(type) {
    const map = {
        facture: "FACTURE",
        avoir: "AVOIR",
        proforma: "FACTURE PROFORMA",
        devis: "DEVIS",
    };
    return map[type] || "FACTURE";
}
// =============================================================================
// 2. onInvoiceStatusChanged — Handle status transitions
// =============================================================================
exports.onInvoiceStatusChanged = fn.firestore
    .document("businesses/{businessId}/invoices/{invoiceId}")
    .onUpdate(async (change, context) => {
    var _a, _b, _c;
    const { businessId, invoiceId } = context.params;
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return;
    if (before.status === after.status)
        return; // No status change
    const newStatus = after.status;
    const oldStatus = before.status;
    functions.logger.info("Invoice status changed", {
        businessId, invoiceId,
        from: oldStatus, to: newStatus,
    });
    try {
        // --- OVERDUE ---
        if (newStatus === "overdue") {
            await logActivity(businessId, "system", "Facture en retard", "invoice", invoiceId, { number: after.number, dueDate: formatDate(after.dueDate) });
        }
        // --- PAID ---
        if (newStatus === "paid") {
            // Update client's totalPaid denormalized field
            const clientId = after.clientId;
            if (clientId) {
                const totalTTC = ((_a = after.totals) === null || _a === void 0 ? void 0 : _a.totalTTC) || 0;
                const clientRef = db
                    .collection("businesses").doc(businessId)
                    .collection("clients").doc(clientId);
                await db.runTransaction(async (t) => {
                    const clientDoc = await t.get(clientRef);
                    if (!clientDoc.exists)
                        return;
                    const clientData = clientDoc.data();
                    const currentPaid = clientData.totalPaid || 0;
                    const currentInvoiced = clientData.totalInvoiced || 0;
                    const newPaid = currentPaid + totalTTC;
                    t.update(clientRef, {
                        totalPaid: newPaid,
                        balance: currentInvoiced - newPaid,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
            }
            // Update paidAt timestamp
            await change.after.ref.update({
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await logActivity(businessId, "system", "Facture payée", "invoice", invoiceId, { number: after.number, totalTTC: (_b = after.totals) === null || _b === void 0 ? void 0 : _b.totalTTC });
        }
        // --- CANCELLED ---
        if (newStatus === "cancelled") {
            await change.after.ref.update({
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await logActivity(businessId, "system", "Facture annulée", "invoice", invoiceId, {
                number: after.number,
                reason: after.cancellationReason || "Non spécifié",
                previousStatus: oldStatus,
            });
        }
        // --- SENT ---
        if (newStatus === "sent" && oldStatus === "draft") {
            await change.after.ref.update({
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Update client's totalInvoiced
            const clientId = after.clientId;
            if (clientId) {
                const totalTTC = ((_c = after.totals) === null || _c === void 0 ? void 0 : _c.totalTTC) || 0;
                const clientRef = db
                    .collection("businesses").doc(businessId)
                    .collection("clients").doc(clientId);
                await db.runTransaction(async (t) => {
                    const clientDoc = await t.get(clientRef);
                    if (!clientDoc.exists)
                        return;
                    const clientData = clientDoc.data();
                    const currentInvoiced = clientData.totalInvoiced || 0;
                    const currentPaid = clientData.totalPaid || 0;
                    const newInvoiced = currentInvoiced + totalTTC;
                    t.update(clientRef, {
                        totalInvoiced: newInvoiced,
                        balance: newInvoiced - currentPaid,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                });
            }
            await logActivity(businessId, "system", "Facture envoyée", "invoice", invoiceId, { number: after.number });
        }
    }
    catch (err) {
        functions.logger.error("onInvoiceStatusChanged failed", {
            businessId, invoiceId, error: err,
        });
    }
});
// =============================================================================
// 3. sendInvoiceReminder — WhatsApp deep link builder
// =============================================================================
exports.sendInvoiceReminder = fn.https.onCall(async (data, context) => {
    var _a, _b;
    // Auth check
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentification requise.");
    }
    const { businessId, invoiceId } = data;
    if (!businessId || typeof businessId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "businessId requis.");
    }
    if (!invoiceId || typeof invoiceId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "invoiceId requis.");
    }
    // Fetch invoice
    const invoiceDoc = await db
        .collection("businesses").doc(businessId)
        .collection("invoices").doc(invoiceId)
        .get();
    if (!invoiceDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Facture introuvable.");
    }
    const invoice = invoiceDoc.data();
    // Fetch client
    const clientDoc = await db
        .collection("businesses").doc(businessId)
        .collection("clients").doc(invoice.clientId)
        .get();
    const client = clientDoc.data();
    // Fetch business
    const businessDoc = await db.collection("businesses").doc(businessId).get();
    const business = businessDoc.data();
    const clientPhone = ((_a = client === null || client === void 0 ? void 0 : client.phone) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, "").replace(/^0/, "+212")) || "";
    const clientName = (client === null || client === void 0 ? void 0 : client.name) || "Client";
    const invoiceNumber = invoice.number || invoiceId;
    const amount = centimesToMAD(((_b = invoice.totals) === null || _b === void 0 ? void 0 : _b.totalTTC) || 0);
    const businessName = (business === null || business === void 0 ? void 0 : business.legalName) || "Votre fournisseur";
    const message = `Bonjour ${clientName}, votre facture ${invoiceNumber} d'un montant de ${amount} est en attente de règlement. Merci de procéder au paiement dans les meilleurs délais. — ${businessName}`;
    const whatsappUrl = `https://wa.me/${clientPhone.replace("+", "")}?text=${encodeURIComponent(message)}`;
    // Log the reminder
    await logActivity(businessId, context.auth.uid, "Rappel envoyé", "invoice", invoiceId, { number: invoiceNumber, via: "whatsapp", clientName });
    return {
        url: whatsappUrl,
        message,
        clientPhone,
        clientName,
    };
});
exports.generateTVAReport = fn.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Authentification requise.");
    }
    const { businessId, quarter, year } = data;
    if (!businessId || typeof businessId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "businessId requis.");
    }
    if (!quarter || !["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
        throw new functions.https.HttpsError("invalid-argument", "quarter invalide (Q1/Q2/Q3/Q4).");
    }
    if (!year || typeof year !== "number" || year < 2020 || year > 2100) {
        throw new functions.https.HttpsError("invalid-argument", "year invalide.");
    }
    // Determine date range for the quarter
    const quarterStartMonth = {
        Q1: 0, Q2: 3, Q3: 6, Q4: 9,
    };
    const startMonth = quarterStartMonth[quarter];
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59); // last day of quarter
    const startTs = admin.firestore.Timestamp.fromDate(startDate);
    const endTs = admin.firestore.Timestamp.fromDate(endDate);
    // Query invoices in period (only sent, paid, partially_paid — not drafts or cancelled)
    const validStatuses = ["sent", "validated", "paid", "partially_paid", "overdue"];
    const invoicesSnap = await db
        .collection("businesses").doc(businessId)
        .collection("invoices")
        .where("issueDate", ">=", startTs)
        .where("issueDate", "<=", endTs)
        .get();
    const tvaMap = new Map();
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;
    let invoiceCount = 0;
    invoicesSnap.docs.forEach((doc) => {
        const inv = doc.data();
        // Skip drafts and cancelled
        if (!validStatuses.includes(inv.status))
            return;
        invoiceCount++;
        const totals = inv.totals || {};
        totalHT += totals.totalHT || 0;
        totalTVA += totals.totalTVA || 0;
        totalTTC += totals.totalTTC || 0;
        // Aggregate by TVA rate
        const breakdown = totals.tvaBreakdown || [];
        breakdown.forEach((entry) => {
            var _a;
            const rate = (_a = entry.rate) !== null && _a !== void 0 ? _a : 0;
            const existing = tvaMap.get(rate) || { rate, baseHT: 0, tvaAmount: 0, invoiceCount: 0 };
            existing.baseHT += entry.base || 0;
            existing.tvaAmount += entry.amount || 0;
            existing.invoiceCount += 1;
            tvaMap.set(rate, existing);
        });
    });
    // Build sorted breakdown
    const tvaBreakdown = Array.from(tvaMap.values()).sort((a, b) => a.rate - b.rate);
    return {
        period: { quarter, year },
        dateRange: {
            start: startDate.toISOString().slice(0, 10),
            end: endDate.toISOString().slice(0, 10),
        },
        invoiceCount,
        totalHT,
        totalTVA,
        totalTTC,
        // Formatted for humans
        totalHT_MAD: centimesToMAD(totalHT),
        totalTVA_MAD: centimesToMAD(totalTVA),
        totalTTC_MAD: centimesToMAD(totalTTC),
        tvaBreakdown: tvaBreakdown.map((t) => ({
            rate: t.rate,
            baseHT: t.baseHT,
            tvaAmount: t.tvaAmount,
            invoiceCount: t.invoiceCount,
            baseHT_MAD: centimesToMAD(t.baseHT),
            tvaAmount_MAD: centimesToMAD(t.tvaAmount),
        })),
        // SIMPL-TVA reference
        simplTVA: {
            regime: "Mensuel ou Trimestriel",
            reference: `TVA-${quarter}-${year}`,
            note: "Ce rapport est généré à titre indicatif. Veuillez vérifier les montants avant soumission au portail SIMPL.",
        },
    };
});
// =============================================================================
// 5. validateICE — ICE format validator
// =============================================================================
exports.validateICE = fn.https.onCall(async (data) => {
    const { ice } = data;
    if (!ice || typeof ice !== "string") {
        return { valid: false, error: "ICE requis (chaîne de caractères)." };
    }
    const trimmed = ice.trim();
    // Must be exactly 15 digits
    if (!/^\d{15}$/.test(trimmed)) {
        if (trimmed.length !== 15) {
            return {
                valid: false,
                error: `L'ICE doit contenir exactement 15 chiffres. Longueur actuelle: ${trimmed.length}.`,
            };
        }
        return {
            valid: false,
            error: "L'ICE ne doit contenir que des chiffres (0-9).",
        };
    }
    // Basic checksum/format heuristics (Moroccan ICE structure)
    // First 9 digits = company number, next 4 = establishment, last 2 = control
    const companyPart = trimmed.slice(0, 9);
    const establishmentPart = trimmed.slice(9, 13);
    const controlPart = trimmed.slice(13, 15);
    // Check that company part is not all zeros
    if (/^0+$/.test(companyPart)) {
        return { valid: false, error: "Numéro d'entreprise invalide (tout zéros)." };
    }
    return {
        valid: true,
        structure: {
            companyNumber: companyPart,
            establishmentNumber: establishmentPart,
            controlDigits: controlPart,
        },
        note: "Format valide. La vérification auprès du registre DGI sera disponible prochainement.",
    };
});
// =============================================================================
// 6. scheduledOverdueCheck — Daily 8am Morocco time
// =============================================================================
exports.scheduledOverdueCheck = fn.pubsub
    .schedule("0 8 * * *") // 8:00 AM every day
    .timeZone("Africa/Casablanca")
    .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    functions.logger.info("Running scheduled overdue check", { timestamp: now.toDate().toISOString() });
    try {
        // Get all businesses
        const businessesSnap = await db.collection("businesses").get();
        let totalUpdated = 0;
        for (const businessDoc of businessesSnap.docs) {
            const businessId = businessDoc.id;
            // Query invoices that are "sent" and past due date
            const overdueSnap = await db
                .collection("businesses").doc(businessId)
                .collection("invoices")
                .where("status", "==", "sent")
                .where("dueDate", "<", now)
                .get();
            if (overdueSnap.empty)
                continue;
            // Batch update
            const batch = db.batch();
            overdueSnap.docs.forEach((invoiceDoc) => {
                batch.update(invoiceDoc.ref, {
                    status: "overdue",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
            totalUpdated += overdueSnap.size;
            functions.logger.info(`Marked ${overdueSnap.size} invoices as overdue`, { businessId });
        }
        functions.logger.info("Overdue check complete", { totalUpdated });
    }
    catch (err) {
        functions.logger.error("scheduledOverdueCheck failed", { error: err });
    }
});
//# sourceMappingURL=index.js.map