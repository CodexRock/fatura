import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, CreditCard, Share2, Copy, Send,
  Trash2, XCircle, CheckCircle, Clock, FileText, AlertCircle 
} from 'lucide-react';
import { getInvoice, getClient, addPayment, updateInvoiceStatus, cancelInvoice, markInvoiceAsSent } from '../lib/firestore';
import { useAuth } from '../contexts/AuthContext';
import { INVOICE_STATUS_LABELS } from '../types';
import type { Invoice, Client, PaymentMethod } from '../types';
import { formatMAD } from '../lib/tva';
import { generateInvoicePDF } from '../lib/pdf';
import { Timestamp } from 'firebase/firestore';

export default function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { business } = useAuth();
  
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('virement');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

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
      alert('Erreur lors de la génération du PDF');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business || !invoice) return;
    
    // Parse the string float to integer centimes safely
    const amountFloat = parseFloat(paymentAmount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      alert("Le montant doit être supérieur à zéro.");
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
        notes: paymentNotes
      });
      
      // Reload logic - cheap
      const updated = await getInvoice(business.id, invoice.id);
      setInvoice(updated);
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
    } catch (err) {
      console.error('Error recording payment:', err);
      alert('Erreur lors de lenregistrement du paiement');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancel = async () => {
    if (!business || !invoice) return;
    const reason = prompt('Raison de l\'annulation :');
    if (reason !== null) {
      try {
        await cancelInvoice(business.id, invoice.id, reason);
        const updated = await getInvoice(business.id, invoice.id);
        setInvoice(updated);
      } catch (error) {
        console.error(error);
        alert("Erreur lors de l'annulation.");
      }
    }
  };

  const handleMarkAsSent = async () => {
    if (!business || !invoice) return;
    try {
      await markInvoiceAsSent(business.id, invoice.id);
      const updated = await getInvoice(business.id, invoice.id);
      setInvoice(updated);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la mise à jour du statut.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Facture introuvable</h2>
        <button 
          onClick={() => navigate('/invoices')}
          className="mt-6 text-indigo-600 font-medium hover:text-indigo-500"
        >
          &larr; Retour aux factures
        </button>
      </div>
    );
  }

  const statusInfo = INVOICE_STATUS_LABELS[invoice.status];
  const dDate = invoice.issueDate?.toDate?.() || new Date(invoice.issueDate as any);
  const totalPaid = invoice.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const remaining = Math.max(0, invoice.totals.totalTTC - totalPaid);
  const paidPercentage = Math.min(100, Math.round((totalPaid / invoice.totals.totalTTC) * 100)) || 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-32 md:pb-12 text-slate-900">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.fr}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Client : {client?.name || 'Inconnu'} • Émise le {dDate.toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        
        {/* Actions Menu */}
        <div className="flex flex-wrap items-center gap-3">
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              onClick={() => {
                setPaymentAmount((remaining / 100).toFixed(2));
                setShowPaymentModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
            >
              <CreditCard className="h-4 w-4" />
              Enregistrer un paiement
            </button>
          )}

          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>

          <button
            onClick={() => navigate(`/invoices/new?duplicate=${invoice.id}`)}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <Copy className="h-4 w-4" />
            Dupliquer
          </button>

          {invoice.status === 'validated' && (
            <button
              onClick={handleMarkAsSent}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 text-indigo-700 px-4 py-2 text-sm font-semibold hover:bg-indigo-100 transition-colors"
            >
              <Send className="h-4 w-4" />
              Marquer comme envoyé
            </button>
          )}

          {invoice.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Annuler
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invoice Document and Timeline (Takes up 2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Virtual PDF Document Preview (Simplified standard view) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="border-b border-gray-100 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{business?.legalName}</h3>
                  <p className="text-sm text-gray-500">ICE : {business?.ice}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-indigo-600 mb-1">FACTURE</h2>
                  <p className="text-sm text-gray-500 font-medium">N° {invoice.number}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">FACTURÉ À</p>
                <p className="font-bold text-gray-900">{client?.name}</p>
                {client?.ice && <p className="text-sm text-gray-600">ICE : {client.ice}</p>}
                <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">
                  {client?.address?.street}<br/>
                  {client?.address?.postalCode} {client?.address?.city}
                </p>
              </div>

              <div className="flex flex-col justify-center space-y-3 pl-8">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date d'émission</p>
                  <p className="font-medium text-gray-900">{dDate.toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date d'échéance</p>
                  <p className="font-medium text-gray-900">
                    {(() => {
                      const due = invoice.dueDate?.toDate?.() || new Date(invoice.dueDate as any);
                      return due.toLocaleDateString('fr-FR');
                    })()}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="min-w-full text-left text-sm mb-8">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50">
                    <th className="py-3 px-4 font-semibold text-gray-900 rounded-tl-lg">Description</th>
                    <th className="py-3 px-4 font-semibold text-gray-900 text-right">Qté</th>
                    <th className="py-3 px-4 font-semibold text-gray-900 text-right">Prix HT</th>
                    <th className="py-3 px-4 font-semibold text-gray-900 text-right">TVA</th>
                    <th className="py-3 px-4 font-semibold text-gray-900 text-right rounded-tr-lg">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-4 text-gray-900 min-w-[200px]">{line.description}</td>
                      <td className="py-3 px-4 text-gray-600 text-right">{line.quantity}</td>
                      <td className="py-3 px-4 text-gray-600 text-right">{formatMAD(line.unitPrice)}</td>
                      <td className="py-3 px-4 text-gray-600 text-right">{line.tvaRate}%</td>
                      <td className="py-3 px-4 text-gray-900 text-right font-medium">{formatMAD(line.totalHT)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end border-t border-gray-200 pt-6">
              <div className="w-72 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sous-total HT</span>
                  <span className="font-medium text-gray-900">{formatMAD(invoice.totals.totalHT)}</span>
                </div>
                {invoice.totals.tvaBreakdown.map(tax => (
                  <div key={tax.rate} className="flex justify-between text-sm">
                    <span className="text-gray-500">TVA ({tax.rate}%)</span>
                    <span className="font-medium text-gray-900">{formatMAD(tax.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-200 mt-3">
                  <span className="text-gray-900">Total TTC</span>
                  <span className="text-indigo-600">{formatMAD(invoice.totals.totalTTC)}</span>
                </div>
              </div>
            </div>
            
            {invoice.notes && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payments and tracking */}
        <div className="space-y-6">
          
          {/* Payment Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <CheckCircle className="h-5 w-5 text-indigo-600" />
              État du paiement
            </h3>
            
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-500">Payé : <span className="font-bold text-gray-900">{formatMAD(totalPaid)}</span></span>
              <span className="text-gray-500">Reste : <span className="font-bold text-gray-900">{formatMAD(remaining)}</span></span>
            </div>
            
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full transition-all duration-500 ${paidPercentage === 100 ? 'bg-green-500' : 'bg-indigo-600'}`}
                style={{ width: `${paidPercentage}%` }}
              />
            </div>
            
            {paidPercentage === 100 ? (
              <div className="rounded-lg bg-green-50 p-4 border border-green-100 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800 font-medium">Facture intégralement payée. Bon travail !</p>
              </div>
            ) : invoice.status === 'cancelled' ? (
               <div className="rounded-lg bg-red-50 p-4 border border-red-100">
                <p className="text-sm text-red-800 font-medium">Facture annulée.</p>
              </div>
            ) : invoice.status === 'overdue' ? (
              <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-start gap-3">
                <Clock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">Le paiement est en retard. Relancez le client.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center">En attente du règlement client.</p>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Historique des paiements</h3>
            
            {!invoice.payments || invoice.payments.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center py-4">Aucun paiement enregistré pour le moment.</p>
            ) : (
              <ul className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:border-l-2 before:border-gray-100">
                {invoice.payments.map((payment, idx) => {
                  const pDate = payment.date?.toDate?.() || new Date(payment.date as any);
                  return (
                    <li key={payment.id || idx} className="relative flex gap-4">
                      <div className="absolute left-1.5 -ml-1 h-3 w-3 rounded-full bg-indigo-500 ring-4 ring-white" />
                      <div className="pl-6 w-full">
                        <div className="flex justify-between">
                          <p className="text-sm font-bold text-gray-900">{formatMAD(payment.amount)}</p>
                          <p className="text-xs text-gray-500">{pDate.toLocaleDateString('fr-FR')}</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">
                          {payment.method} {payment.reference ? `• Réf: ${payment.reference}` : ''}
                        </p>
                        {payment.notes && <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">{payment.notes}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Enregistrer un paiement</h3>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={submitPayment} className="p-6">
              <div className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date du paiement</label>
                  <input
                    required
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant payé (MAD)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    max={(remaining/100).toFixed(2)}
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de paiement</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="virement">Virement bancaire</option>
                    <option value="cash">Espèces</option>
                    <option value="check">Chèque</option>
                    <option value="carte">Carte bancaire</option>
                    <option value="mobile">Paiement Mobile</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: N° Chèque, Réf Virement..."
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                  <textarea
                    rows={2}
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

              </div>
              
              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {submittingPayment ? 'Enregistrement...' : 'Valider le paiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
