import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, CreditCard, Copy, Send,
  XCircle, CheckCircle, Clock, FileText, AlertCircle, X, Loader2,
} from 'lucide-react';
import { getInvoice, getClient, addPayment, updateInvoiceStatus, cancelInvoice, markInvoiceAsSent } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { INVOICE_STATUS_LABELS } from '../types';
import type { Invoice, Client, PaymentMethod } from '../types';
import { formatMAD } from '../lib/tva';
import { generateInvoicePDF } from '../lib/pdf';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '../components/ui/Toast';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';

const INPUT = 'w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400 transition-all placeholder:text-slate-400 text-slate-900';
const LABEL = 'block text-sm font-semibold text-slate-700 mb-1.5';

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { business } = useAuth();
  const { success, error: toastError } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment modal
  const [showPaymentModal, setShowPaymentModal]     = useState(false);
  const [paymentAmount, setPaymentAmount]           = useState('');
  const [paymentDate, setPaymentDate]               = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod]           = useState<PaymentMethod>('virement');
  const [paymentReference, setPaymentReference]     = useState('');
  const [paymentNotes, setPaymentNotes]             = useState('');
  const [submittingPayment, setSubmittingPayment]   = useState(false);
  const [paymentError, setPaymentError]             = useState('');

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState('');
  const [cancellingInvoice, setCancellingInvoice] = useState(false);

  // Sent confirm
  const [confirmSent, setConfirmSent]   = useState(false);
  const [markingSent, setMarkingSent]   = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!business?.id || !id) return;
      try {
        const inv = await getInvoice(business.id, id);
        if (inv) {
          setInvoice(inv);
          if (inv.clientId) {
            const cli = await getClient(business.id, inv.clientId);
            setClient(cli);
          }
        }
      } catch (err) {
        console.error('Error loading invoice', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [business?.id, id]);

  const reloadInvoice = async () => {
    if (!business?.id || !id) return;
    const updated = await getInvoice(business.id, id);
    setInvoice(updated);
  };

  const handleDownloadPDF = async () => {
    if (!business || !invoice || !client) return;
    try {
      const blob = await generateInvoicePDF(invoice, business, client);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture_${invoice.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toastError('Erreur lors de la génération du PDF');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !invoice) return;
    setPaymentError('');

    const amountFloat = parseFloat(paymentAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setPaymentError('Le montant doit être supérieur à zéro.');
      return;
    }
    const amountCentimes = Math.round(amountFloat * 100);

    setSubmittingPayment(true);
    try {
      await addPayment(business.id, invoice.id, {
        date: Timestamp.fromDate(new Date(paymentDate)),
        amount: amountCentimes,
        method: paymentMethod,
        reference: paymentReference,
        notes: paymentNotes,
      });
      await reloadInvoice();
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      success('Paiement enregistré avec succès.');
    } catch (err) {
      console.error('Error recording payment:', err);
      toastError('Erreur lors de l\'enregistrement du paiement.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancel = async () => {
    if (!business || !invoice) return;
    setCancellingInvoice(true);
    try {
      await cancelInvoice(business.id, invoice.id, cancelReason);
      await reloadInvoice();
      setShowCancelModal(false);
      setCancelReason('');
      success('Facture annulée.');
    } catch {
      toastError('Erreur lors de l\'annulation.');
    } finally {
      setCancellingInvoice(false);
    }
  };

  const handleMarkAsSent = async () => {
    if (!business || !invoice) return;
    setMarkingSent(true);
    try {
      await markInvoiceAsSent(business.id, invoice.id);
      await reloadInvoice();
      setConfirmSent(false);
      success('Facture marquée comme envoyée.');
    } catch {
      toastError('Erreur lors de la mise à jour du statut.');
    } finally {
      setMarkingSent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-700" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-danger-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Facture introuvable</h2>
        <button
          onClick={() => navigate('/invoices')}
          className="mt-2 text-sm font-semibold text-primary-700 hover:underline"
        >
          ← Retour aux factures
        </button>
      </div>
    );
  }

  const statusInfo = INVOICE_STATUS_LABELS[invoice.status];
  const issueDate  = invoice.issueDate?.toDate?.() || new Date(invoice.issueDate as any);
  const totalPaid  = invoice.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const remaining  = Math.max(0, invoice.totals.totalTTC - totalPaid);
  const paidPct    = Math.min(100, Math.round((totalPaid / invoice.totals.totalTTC) * 100)) || 0;

  return (
    <div className="space-y-6 animate-page-enter">

      {/* Cancel Modal */}
      <Modal
        open={showCancelModal}
        onClose={() => { setShowCancelModal(false); setCancelReason(''); }}
        title="Annuler la facture"
        description="Cette action est irréversible."
        size="sm"
        footer={
          <>
            <button
              onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Retour
            </button>
            <button
              onClick={handleCancel}
              disabled={cancellingInvoice}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-danger-500 rounded-xl hover:bg-danger-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {cancellingInvoice && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer l'annulation
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-danger-50 rounded-xl border border-danger-100">
            <p className="text-sm text-danger-700 font-medium">
              La facture {invoice.number} sera annulée définitivement.
            </p>
          </div>
          <div>
            <label className={LABEL}>Raison de l'annulation (optionnel)</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Ex: Commande annulée par le client..."
              className={INPUT + ' resize-none'}
            />
          </div>
        </div>
      </Modal>

      {/* Mark as sent confirm */}
      <ConfirmDialog
        open={confirmSent}
        onClose={() => setConfirmSent(false)}
        onConfirm={handleMarkAsSent}
        loading={markingSent}
        title="Marquer comme envoyée ?"
        message="La facture sera marquée comme envoyée au client."
        confirmLabel="Confirmer"
      />

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{invoice.number}</h1>
              <span className={`badge ${statusInfo.color}`}>{statusInfo.fr}</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              {client?.name || 'Client inconnu'} · Émise le {issueDate.toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              onClick={() => { setPaymentAmount((remaining / 100).toFixed(2)); setShowPaymentModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-success-500 hover:bg-success-600 rounded-xl shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <CreditCard className="w-4 h-4" /> Enregistrer un paiement
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => navigate(`/invoices/new?duplicate=${invoice.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <Copy className="w-4 h-4" /> Dupliquer
          </button>
          {invoice.status === 'validated' && (
            <button
              onClick={() => setConfirmSent(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <Send className="w-4 h-4" /> Marquer envoyée
            </button>
          )}
          {invoice.status !== 'cancelled' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-danger-500 bg-danger-50 hover:bg-danger-100 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-primary-400"
            >
              <XCircle className="w-4 h-4" /> Annuler
            </button>
          )}
        </div>
      </div>

      {/* Overdue banner */}
      {invoice.status === 'overdue' && (
        <div className="flex items-center justify-between px-5 py-3.5 bg-danger-50 border border-danger-100 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-danger-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-danger-700">
              Cette facture est en retard. Relancez votre client.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Invoice preview (2/3 width) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-8">
            {/* Letterhead */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">{business?.legalName}</h3>
                {business?.ice && <p className="text-sm text-slate-500 mt-0.5">ICE : {business.ice}</p>}
                {business?.address?.city && (
                  <p className="text-sm text-slate-500">{business.address.city}</p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-primary-700 mb-1 tracking-tight">FACTURE</h2>
                <p className="text-sm text-slate-500 font-medium">N° {invoice.number}</p>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">FACTURÉ À</p>
                <p className="font-bold text-slate-900">{client?.name}</p>
                {client?.ice && <p className="text-sm text-slate-600 mt-0.5">ICE : {client.ice}</p>}
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {client?.address?.street}
                  {client?.address?.street && <br />}
                  {[client?.address?.postalCode, client?.address?.city].filter(Boolean).join(' ')}
                </p>
              </div>
              <div className="space-y-4 pl-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date d'émission</p>
                  <p className="font-semibold text-slate-900 text-sm">{issueDate.toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Échéance</p>
                  <p className="font-semibold text-slate-900 text-sm">
                    {(() => {
                      try {
                        const due = invoice.dueDate?.toDate?.() || new Date(invoice.dueDate as any);
                        return due.toLocaleDateString('fr-FR');
                      } catch { return '–'; }
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Lines table */}
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 mb-6">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/70">
                    <th className="py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide">Description</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Qté</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Prix HT</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">TVA</th>
                    <th className="py-3 px-4 font-semibold text-slate-600 text-xs uppercase tracking-wide text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoice.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-slate-900 min-w-[180px]">{line.description}</td>
                      <td className="py-3 px-4 text-slate-500 text-right tabular-nums">{line.quantity}</td>
                      <td className="py-3 px-4 text-slate-500 text-right tabular-nums">{formatMAD(line.unitPrice)}</td>
                      <td className="py-3 px-4 text-slate-500 text-right tabular-nums">{line.tvaRate}%</td>
                      <td className="py-3 px-4 text-slate-900 text-right font-semibold tabular-nums">{formatMAD(line.totalHT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end border-t border-slate-100 pt-6">
              <div className="w-72 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sous-total HT</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{formatMAD(invoice.totals.totalHT)}</span>
                </div>
                {invoice.totals.tvaBreakdown.map(tax => (
                  <div key={tax.rate} className="flex justify-between text-sm">
                    <span className="text-slate-500">TVA ({tax.rate}%)</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{formatMAD(tax.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-base font-bold pt-3 border-t border-slate-200 mt-1">
                  <span className="text-slate-900">Total TTC</span>
                  <span className="text-primary-700 tabular-nums">{formatMAD(invoice.totals.totalTTC)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Payment status */}
          <div className="card p-6">
            <h3 className="font-semibold text-[15px] text-slate-900 flex items-center gap-2 mb-5">
              <CheckCircle className="w-4 h-4 text-slate-400" />
              État du paiement
            </h3>

            <div className="mb-2 flex justify-between text-sm">
              <span className="text-slate-500">Payé : <span className="font-bold text-slate-900 tabular-nums">{formatMAD(totalPaid)}</span></span>
              <span className="text-slate-500">Reste : <span className="font-bold text-slate-900 tabular-nums">{formatMAD(remaining)}</span></span>
            </div>

            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all duration-700 ${paidPct === 100 ? 'bg-success-500' : 'bg-primary-700'}`}
                style={{ width: `${paidPct}%` }}
              />
            </div>

            {paidPct === 100 ? (
              <div className="flex items-start gap-3 p-3.5 bg-success-50 border border-success-100 rounded-xl">
                <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-success-700 font-semibold">Facture intégralement payée.</p>
              </div>
            ) : invoice.status === 'cancelled' ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm text-slate-600 font-semibold">Facture annulée.</p>
              </div>
            ) : invoice.status === 'overdue' ? (
              <div className="flex items-start gap-3 p-3.5 bg-danger-50 border border-danger-100 rounded-xl">
                <Clock className="w-4 h-4 text-danger-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-700 font-semibold">Paiement en retard. Relancez le client.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center font-medium">En attente du règlement.</p>
            )}
          </div>

          {/* Payment history */}
          <div className="card p-6">
            <h3 className="font-semibold text-[15px] text-slate-900 mb-5">Historique des paiements</h3>

            {!invoice.payments || invoice.payments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Aucun paiement enregistré.</p>
            ) : (
              <ul className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-slate-100">
                {invoice.payments.map((payment, idx) => {
                  const pDate = payment.date?.toDate?.() || new Date(payment.date as any);
                  return (
                    <li key={payment.id || idx} className="relative flex gap-4 pl-8">
                      <div className="absolute left-1.5 w-3 h-3 rounded-full bg-primary-700 ring-4 ring-white flex-shrink-0 mt-1" />
                      <div className="w-full">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMAD(payment.amount)}</p>
                          <p className="text-xs text-slate-400 tabular-nums">{pDate.toLocaleDateString('fr-FR')}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 capitalize">
                          {payment.method}{payment.reference ? ` · Réf: ${payment.reference}` : ''}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 p-2 rounded-lg">{payment.notes}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-modal max-w-md w-full overflow-hidden animate-modal-enter">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h3 className="text-[17px] font-bold text-slate-900">Enregistrer un paiement</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitPayment} className="p-6 space-y-4">
              {paymentError && (
                <div className="p-3 bg-danger-50 border border-danger-100 rounded-xl text-sm text-danger-700 font-medium">
                  {paymentError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Date du paiement</label>
                  <input required type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Montant (MAD)</label>
                  <input
                    required type="number" step="0.01" min="0" max={(remaining / 100).toFixed(2)}
                    value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                    className={INPUT + ' tabular-nums'}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Méthode</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className={INPUT + ' cursor-pointer'}>
                  <option value="virement">Virement bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="carte">Carte bancaire</option>
                  <option value="mobile">Paiement Mobile</option>
                </select>
              </div>

              <div>
                <label className={LABEL}>Référence <span className="font-normal text-slate-400">(optionnel)</span></label>
                <input type="text" placeholder="N° chèque, réf. virement..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className={INPUT} />
              </div>

              <div>
                <label className={LABEL}>Notes <span className="font-normal text-slate-400">(optionnel)</span></label>
                <textarea rows={2} value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className={INPUT + ' resize-none'} />
              </div>

              {/* Remaining preview */}
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="flex justify-between text-sm px-4 py-3 bg-primary-50 rounded-xl border border-primary-100">
                  <span className="text-primary-600 font-semibold">Solde restant après paiement</span>
                  <span className="font-bold text-primary-700 tabular-nums">
                    {formatMAD(Math.max(0, remaining - Math.round(parseFloat(paymentAmount) * 100)))}
                  </span>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={submittingPayment}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-700 rounded-xl hover:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {submittingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                  Valider le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
