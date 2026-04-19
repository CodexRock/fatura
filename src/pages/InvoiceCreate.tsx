import React, { useReducer, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Plus, GripVertical, Save, Send, AlertCircle, 
  Search, CheckCircle2, ChevronDown, ChevronUp, FileText 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClients } from '../hooks/useClients';
import { useProducts } from '../hooks/useProducts';
import { createInvoice } from '../lib/firestore';
import { calculateInvoiceTotals, formatMAD, madToCentimes, centimesToMAD } from '../lib/tva';
import type { InvoiceType, TvaRate, InvoiceLine, Client, Product, InvoiceStatus } from '../types';
import { TVA_RATES } from '../types';
import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------
// TYPES & REDUCER
// ----------------------------------------------------------------------

interface LineState {
  id: string; // Internal temporary ID
  productId?: string;
  description: string;
  quantityStr: string; // Keep strings to avoid cursor jumping during manual typing
  unitPriceStr: string; // In MAD
  tvaRate: TvaRate;
  discountType: 'percentage' | 'fixed';
  discountValueStr: string; 
  showDiscount: boolean;
}

interface State {
  type: InvoiceType;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  clientId: string | null;
  selectedClient: Client | null;
  isSearchingClient: boolean;
  lines: LineState[];
  notes: string;
  internalNotes: string;
}

type Action = 
  | { type: 'SET_FIELD'; field: keyof State; value: any }
  | { type: 'SET_CLIENT'; client: Client | null }
  | { type: 'ADD_LINE' }
  | { type: 'REMOVE_LINE'; id: string }
  | { type: 'UPDATE_LINE'; id: string; field: keyof LineState; value: any }
  | { type: 'MOVE_LINE'; id: string; direction: 'up' | 'down' }
  | { type: 'APPLY_PRODUCT'; id: string; product: Product };

const generateId = () => Math.random().toString(36).substr(2, 9);
const getTodayStr = () => new Date().toISOString().split('T')[0];
const getFutureDateStr = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const createEmptyLine = (): LineState => ({
  id: generateId(),
  description: '',
  quantityStr: '1',
  unitPriceStr: '',
  tvaRate: 20,
  discountType: 'percentage',
  discountValueStr: '',
  showDiscount: false,
});

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    
    case 'SET_CLIENT':
      // Auto adjust due date based on client terms if available
      const terms = action.client?.paymentTermsDays || 30;
      return { 
        ...state, 
        clientId: action.client?.id || null, 
        selectedClient: action.client,
        dueDate: getFutureDateStr(terms)
      };

    case 'ADD_LINE':
      return { ...state, lines: [...state.lines, createEmptyLine()] };
      
    case 'REMOVE_LINE':
      return { ...state, lines: state.lines.filter(l => l.id !== action.id) };
      
    case 'UPDATE_LINE':
      return {
        ...state,
        lines: state.lines.map(l => 
          l.id === action.id ? { ...l, [action.field]: action.value } : l
        )
      };
      
    case 'MOVE_LINE': {
      const idx = state.lines.findIndex(l => l.id === action.id);
      if (idx === -1) return state;
      if (action.direction === 'up' && idx === 0) return state;
      if (action.direction === 'down' && idx === state.lines.length - 1) return state;
      
      const newLines = [...state.lines];
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      [newLines[idx], newLines[swapIdx]] = [newLines[swapIdx], newLines[idx]];
      
      return { ...state, lines: newLines };
    }

    case 'APPLY_PRODUCT':
      return {
        ...state,
        lines: state.lines.map(l => l.id === action.id ? {
          ...l,
          productId: action.product.id,
          description: action.product.label,
          unitPriceStr: centimesToMAD(action.product.unitPrice).toString(),
          tvaRate: action.product.tvaRate,
        } : l)
      };

    default:
      return state;
  }
}

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

export default function InvoiceCreate() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const { clients } = useClients();
  const { products } = useProducts();

  const [state, dispatch] = useReducer(reducer, null, () => ({
    type: 'facture' as InvoiceType,
    issueDate: getTodayStr(),
    dueDate: getFutureDateStr(business?.defaultPaymentTermsDays || 30),
    clientId: null,
    selectedClient: null,
    isSearchingClient: false,
    lines: [createEmptyLine()],
    notes: '',
    internalNotes: '',
  }));

  const [submitting, setSubmitting] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState<{ id: string, term: string } | null>(null);

  // ----------------------------------------------------------------------
  // DERIVED CALCULATIONS (TVA ENGINE)
  // ----------------------------------------------------------------------
  
  const mappedInvoiceLines: InvoiceLine[] = useMemo(() => {
    return state.lines.map(l => {
      const quantity = parseFloat(l.quantityStr) || 0;
      const unitPriceMAD = parseFloat(l.unitPriceStr) || 0;
      const unitPriceCentimes = Math.max(0, madToCentimes(unitPriceMAD));
      
      let discount;
      if (l.showDiscount && parseFloat(l.discountValueStr) > 0) {
        const val = parseFloat(l.discountValueStr);
        discount = {
          type: l.discountType,
          value: l.discountType === 'percentage' ? val : madToCentimes(val)
        };
      }

      // calculateLineTotal will yield exact integer sub-totals
      // We don't save the calculation step directly here into local LineState because the reducer is pure
      // Instead, we just pass down what the Engine needs to derive everything.
      
      return {
        id: l.id,
        productId: l.productId,
        description: l.description,
        quantity,
        unitPrice: unitPriceCentimes,
        tvaRate: l.tvaRate,
        discount,
        // We initialize these to 0, calculateInvoiceTotals will generate the real ones if we map them manually, 
        // wait, calculateInvoiceTotals calculates the INVOICE total. 
        // We need local mapping to show line totals in the UI:
        totalHT: 0, 
        totalTVA: 0,
        totalTTC: 0,
      };
    });
  }, [state.lines]);

  // Actually derive the totals for the view
  const linesWithTotals = useMemo(() => {
    return state.lines.map((l, index) => {
      const mapped = mappedInvoiceLines[index];
      // Re-executing local function logic
      const qty = mapped.quantity;
      const up = mapped.unitPrice;
      const baseTotalHT = Math.round(qty * up);

      let discountAmount = 0;
      if (mapped.discount) {
        if (mapped.discount.type === 'percentage') {
          discountAmount = Math.round((baseTotalHT * mapped.discount.value) / 100);
        } else {
          discountAmount = mapped.discount.value;
        }
      }
      discountAmount = Math.min(discountAmount, baseTotalHT);
      const taxableBase = baseTotalHT - discountAmount;
      const totalTVA = Math.round((taxableBase * mapped.tvaRate) / 100);
      const totalTTC = taxableBase + totalTVA;

      return {
        ...l,
        calculated: { baseTotalHT, discountAmount, taxableBase, totalTVA, totalTTC }
      };
    });
  }, [state.lines, mappedInvoiceLines]);

  const invoiceTotals = useMemo(() => {
    // calculateInvoiceTotals expects valid InvoiceLines including totals, but our mappedInvoiceLines don't hold them. 
    // We already derived them in linesWithTotals !
    const builtLines: InvoiceLine[] = linesWithTotals.map(l => ({
      ...mappedInvoiceLines.find(m => m.id === l.id)!,
      totalHT: l.calculated.taxableBase,
      totalTVA: l.calculated.totalTVA,
      totalTTC: l.calculated.totalTTC
    }));
    return calculateInvoiceTotals(builtLines);
  }, [linesWithTotals, mappedInvoiceLines]);

  const isValid = state.clientId && state.lines.length > 0 && state.lines.every(l => l.description.trim() !== '' && parseFloat(l.quantityStr) > 0 && parseFloat(l.unitPriceStr) >= 0);

  // ----------------------------------------------------------------------
  // SUBMISSION
  // ----------------------------------------------------------------------

  const handleSubmit = async (status: InvoiceStatus) => {
    if (!business?.id || !isValid) return;
    setSubmitting(true);
    
    // Convert Dates to Timestamps
    const issueDateTs = Timestamp.fromDate(new Date(state.issueDate));
    const dueDateTs = Timestamp.fromDate(new Date(state.dueDate));

    const finalLines: InvoiceLine[] = linesWithTotals.map(l => {
      const lineObj: any = {
        id: l.id,
        description: l.description,
        quantity: parseFloat(l.quantityStr) || 0,
        unitPrice: madToCentimes(parseFloat(l.unitPriceStr) || 0),
        tvaRate: l.tvaRate,
        totalHT: l.calculated.taxableBase,
        totalTVA: l.calculated.totalTVA,
        totalTTC: l.calculated.totalTTC,
      };

      if (l.productId) {
        lineObj.productId = l.productId;
      }

      if (l.showDiscount && parseFloat(l.discountValueStr) > 0) {
        lineObj.discount = { 
          type: l.discountType, 
          value: l.discountType === 'percentage' 
            ? parseFloat(l.discountValueStr) 
            : madToCentimes(parseFloat(l.discountValueStr)) 
        };
      }

      return lineObj;
    });

    const invoiceData: any = {
      businessId: business.id,
      clientId: state.clientId!,
      type: state.type,
      status: status,
      issueDate: issueDateTs,
      dueDate: dueDateTs,
      lines: finalLines,
      totals: invoiceTotals,
      payments: [],
      dgiStatus: null,
      number: 'AUTO',
    };
    
    if (state.notes) invoiceData.notes = state.notes;
    if (state.internalNotes) invoiceData.internalNotes = state.internalNotes;

    try {
      const invoice = await createInvoice(business.id, invoiceData);
      // Redirect to view
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création de la facture");
      setSubmitting(false);
    }
  };

  if (!business) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* ---------------- LEFT PANEL: FORM ---------------- */}
      <div className="flex-1 overflow-y-auto pb-24 md:pb-32 px-4 py-8 md:px-8 xl:px-12">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Créer un document</h1>
            <p className="text-slate-500 mt-1">Configurez les détails et les lignes tarifaires.</p>
          </div>

          {/* Section 1: Metadata */}
          <section className="bg-white px-4 py-6 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 pb-6">
              <div className="flex p-1 bg-slate-100 rounded-lg">
                {(['facture', 'devis', 'proforma', 'avoir'] as InvoiceType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => dispatch({ type: 'SET_FIELD', field: 'type', value: type })}
                    className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                      state.type === type ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-md border border-dashed border-slate-200">
                  AUTO-GENERATED
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date d'émission</label>
                <input 
                  type="date"
                  value={state.issueDate}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'issueDate', value: e.target.value })}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary px-4 py-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date d'échéance</label>
                <input 
                  type="date"
                  value={state.dueDate}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'dueDate', value: e.target.value })}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary px-4 py-2 border"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Client */}
          <section className="bg-white px-4 py-6 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Client</h2>
            
            {!state.selectedClient ? (
              <div 
                className="relative" 
                onFocus={() => dispatch({ type: 'SET_FIELD', field: 'isSearchingClient', value: true })}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    dispatch({ type: 'SET_FIELD', field: 'isSearchingClient', value: false });
                  }
                }}
                tabIndex={-1}
              >
                <div className="relative" onClick={() => dispatch({ type: 'SET_FIELD', field: 'isSearchingClient', value: true })}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary"
                  />
                </div>
                {state.isSearchingClient && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {clients
                        .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                        .slice(0, 5)
                        .map(client => (
                      <button
                        key={client.id}
                        onClick={() => {
                          dispatch({ type: 'SET_CLIENT', client });
                          setClientSearch('');
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex flex-col"
                      >
                        <span className="font-medium text-slate-900">{client.name}</span>
                        <span className="text-xs text-slate-500">ICE: {client.ice || 'N/A'}</span>
                      </button>
                    ))}
                    <button 
                      onClick={() => { /* Open Client Modal in Real App */ }}
                      className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 text-primary font-medium text-sm border-t border-slate-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter un nouveau client
                    </button>
                  </div>
                )}
                <div className="mt-4 p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-center text-slate-500 text-sm">
                  Sélectionnez un client pour continuer.
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between p-4 border border-primary/20 bg-primary/5 rounded-xl">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    {state.selectedClient.name}
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </h3>
                  <div className="text-sm text-slate-600 mt-1 space-y-0.5">
                    <p>ICE: {state.selectedClient.ice || 'Non renseigné'}</p>
                    <p>{state.selectedClient.address.street}, {state.selectedClient.address.city}</p>
                  </div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'SET_CLIENT', client: null })}
                  className="text-sm text-slate-500 hover:text-red-600 font-medium transition-colors"
                >
                  Changer
                </button>
              </div>
            )}
          </section>

          {/* Section 3: Line Items */}
          <section className="bg-white px-4 py-6 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Lignes de facturation</h2>
            
            <div className="space-y-4">
              {linesWithTotals.map((line, index) => (
                <div key={line.id} className="relative border border-slate-200 rounded-xl p-4 transition-all hover:border-slate-300 hover:shadow-sm bg-white group">
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 p-1 bg-white border border-slate-200 rounded shadow-sm opacity-0 group-hover:opacity-100 cursor-move flex flex-col items-center">
                    <button onClick={() => dispatch({ type: 'MOVE_LINE', id: line.id, direction: 'up'})} className="hover:text-primary"><ChevronUp className="h-3 w-3" /></button>
                    <GripVertical className="h-4 w-4 text-slate-400" />
                    <button onClick={() => dispatch({ type: 'MOVE_LINE', id: line.id, direction: 'down'})} className="hover:text-primary"><ChevronDown className="h-3 w-3" /></button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Description & Product Search */}
                    <div className="sm:col-span-12 relative">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Désignation</label>
                      <input
                        type="text"
                        placeholder="Rechercher un produit ou taper le détail..."
                        value={line.description}
                        onChange={(e) => {
                          dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'description', value: e.target.value });
                          setProductSearch({ id: line.id, term: e.target.value });
                        }}
                        onBlur={() => setTimeout(() => setProductSearch(null), 200)}
                        className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary px-3 py-2 text-sm border font-medium text-slate-900"
                      />
                      {/* Product Autocomplete */}
                      {productSearch?.id === line.id && productSearch.term && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                          {products.filter(p => p.label.toLowerCase().includes(productSearch.term.toLowerCase())).map(prod => (
                            <button
                              key={prod.id}
                              onMouseDown={() => dispatch({ type: 'APPLY_PRODUCT', id: line.id, product: prod })}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 flex justify-between items-center"
                            >
                              <span className="font-medium text-sm text-slate-900">{prod.label}</span>
                              <span className="text-xs text-slate-500">{formatMAD(prod.unitPrice)} TTC</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantité */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Qté</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantityStr}
                        onChange={(e) => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'quantityStr', value: e.target.value })}
                        className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary px-3 py-2 text-sm border"
                      />
                    </div>

                    {/* Unité HT */}
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Prix U. HT</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={line.unitPriceStr}
                          onChange={(e) => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'unitPriceStr', value: e.target.value })}
                          className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary pl-3 pr-10 py-2 text-sm border text-right"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">MAD</span>
                      </div>
                    </div>

                    {/* TVA */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 mb-1">TVA</label>
                      <select
                        value={line.tvaRate}
                        onChange={(e) => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'tvaRate', value: parseInt(e.target.value) })}
                        className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary px-2 py-2 text-sm border"
                      >
                        {TVA_RATES.map((rate: number) => (
                          <option key={rate} value={rate}>{rate}%</option>
                        ))}
                      </select>
                    </div>

                    {/* Total TTC ReadOnly */}
                    <div className="sm:col-span-4 flex flex-col justify-end">
                       <label className="block text-xs font-medium text-slate-500 mb-1 sm:hidden">Total TTC</label>
                       <div className="flex items-center justify-between h-[38px]">
                          <div className="text-sm font-bold text-slate-800 tabular-nums">
                            {formatMAD(line.calculated.totalTTC)}
                          </div>
                          <button
                            onClick={() => dispatch({ type: 'REMOVE_LINE', id: line.id })}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors ml-2"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                       </div>
                    </div>
                  </div>

                  {/* Discount Toggle Toggle */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {!line.showDiscount ? (
                      <button 
                        onClick={() => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'showDiscount', value: true })}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Ajouter une remise
                      </button>
                    ) : (
                      <div className="flex items-end gap-3 max-w-sm">
                        <div className="flex-1">
                           <label className="block text-xs font-medium text-slate-500 mb-1">Remise</label>
                           <div className="flex">
                             <select
                               value={line.discountType}
                               onChange={(e) => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'discountType', value: e.target.value })}
                               className="border-slate-300 rounded-l-lg shadow-sm focus:ring-primary focus:border-primary px-2 py-1.5 text-sm border-y border-l bg-slate-50"
                             >
                               <option value="percentage">%</option>
                               <option value="fixed">MAD</option>
                             </select>
                             <input
                                type="number"
                                min="0"
                                step="any"
                                value={line.discountValueStr}
                                onChange={(e) => dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'discountValueStr', value: e.target.value })}
                                className="flex-1 w-full border-slate-300 rounded-r-lg shadow-sm focus:ring-primary focus:border-primary px-3 py-1.5 text-sm border"
                             />
                           </div>
                        </div>
                        <button 
                          onClick={() => {
                            dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'showDiscount', value: false });
                            dispatch({ type: 'UPDATE_LINE', id: line.id, field: 'discountValueStr', value: '' });
                          }}
                          className="p-2 text-slate-400 hover:text-slate-700"
                        >
                           <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => dispatch({ type: 'ADD_LINE' })}
              className="w-full mt-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Ajouter une ligne
            </button>
          </section>

          {/* Section 5: Notes & Options */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Note pour le client (Visible sur le PDF)</label>
               <textarea 
                  rows={2}
                  value={state.notes}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'notes', value: e.target.value })}
                  placeholder="Merci pour votre confiance..."
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-3 border text-sm"
               ></textarea>
             </div>
             <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">Note interne (Privée)</label>
               <textarea 
                  rows={1}
                  value={state.internalNotes}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'internalNotes', value: e.target.value })}
                  className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-primary focus:border-primary p-3 border text-sm bg-slate-50"
               ></textarea>
             </div>
             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex gap-3 text-sm text-slate-600">
               <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0" />
               <p>
                 Conditions de paiement : <strong>Paiement à {business.defaultPaymentTermsDays} jours</strong>. 
                 Ce délai découle des paramètres de votre entreprise. Modifiez la date d'échéance manuellement si besoin.
               </p>
             </div>
          </section>

        </div>
      </div>

      {/* ---------------- RIGHT PANEL: STICKY PREVIEW ---------------- */}
      <div className="hidden md:flex flex-col w-[380px] lg:w-[450px] border-l border-slate-200 bg-slate-100">
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
           <div className="sticky top-8">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Aperçu du document
              </h3>
              
              {/* Paper Document Representation */}
              <div className="bg-white shadow-xl rounded-sm aspect-[1/1.414] p-8 text-[11px] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-primary"></div>
                
                <div className="flex justify-between items-start mb-8">
                  <div>
                    {business.logoUrl ? (
                      <img src={business.logoUrl} alt="Logo" className="h-10 object-contain mb-2" />
                    ) : (
                      <div className="h-10 w-24 bg-slate-200 rounded mb-2 flex items-center justify-center text-slate-400 font-bold">LOGO</div>
                    )}
                    <div className="font-bold text-sm text-slate-800">{business.tradeName || business.legalName}</div>
                    <div className="text-slate-500 mt-1">ICE: {business.ice}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-light text-primary uppercase tracking-widest">{state.type}</div>
                    <div className="font-semibold text-slate-800 mt-1">N° AUTO-GENERÉ</div>
                    <div className="text-slate-500 mt-1">Le {new Date(state.issueDate).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>

                {state.selectedClient && (
                  <div className="bg-slate-50 p-4 rounded border border-slate-100 mb-8 self-end w-2/3">
                    <div className="text-slate-500 mb-1">Facturé à :</div>
                    <div className="font-bold text-slate-800 text-sm">{state.selectedClient.name}</div>
                    <div className="text-slate-600 mt-1">{state.selectedClient.address.street}</div>
                    <div className="text-slate-600">{state.selectedClient.address.city}</div>
                    {state.selectedClient.ice && <div className="text-slate-500 mt-2">ICE: {state.selectedClient.ice}</div>}
                  </div>
                )}

                <table className="w-full mb-8">
                  <thead>
                    <tr className="border-b-2 border-slate-800 text-slate-800 font-bold text-left">
                      <th className="pb-2 w-1/2">Désignation</th>
                      <th className="pb-2 text-right">Qté</th>
                      <th className="pb-2 text-right">P.U HT</th>
                      <th className="pb-2 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linesWithTotals.map((l, i) => (
                      <tr key={l.id} className="border-b border-slate-100 text-slate-600">
                        <td className="py-2.5 truncate max-w-[120px]">{l.description || '-'}</td>
                        <td className="py-2.5 text-right">{l.quantityStr || '0'}</td>
                        <td className="py-2.5 text-right font-mono">{formatMAD(madToCentimes(parseFloat(l.unitPriceStr) || 0))}</td>
                        <td className="py-2.5 text-right font-mono font-medium text-slate-800">{formatMAD(l.calculated.taxableBase)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-auto flex justify-end">
                  <div className="w-2/3 max-w-[200px]">
                    <div className="flex justify-between py-1 text-slate-600">
                      <span>Total HT</span>
                      <span className="font-mono">{formatMAD(invoiceTotals.totalHT)}</span>
                    </div>
                    {invoiceTotals.tvaBreakdown.map((tva) => (
                      <div key={tva.rate} className="flex justify-between py-1 text-slate-600">
                        <span>TVA {tva.rate}%</span>
                        <span className="font-mono">{formatMAD(tva.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 mt-2 border-t-2 border-slate-800 text-sm font-bold text-slate-900">
                      <span>Net à payer</span>
                      <span className="font-mono tracking-tight text-primary">{formatMAD(invoiceTotals.totalTTC)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200 text-slate-400 text-center text-[9px]">
                  Échéance au {new Date(state.dueDate).toLocaleDateString('fr-FR')} • Généré via Fatura SaaS
                </div>
              </div>
           </div>
        </div>
      </div>

      {/* ---------------- BOTTOM ACTION BAR ---------------- */}
      <div className="fixed bottom-[65px] lg:bottom-0 left-0 lg:left-64 right-0 lg:right-[380px] xl:right-[450px] bg-white/80 backdrop-blur-xl border-t border-slate-200/60 p-4 px-6 flex items-center justify-between z-40 shadow-[0_-15px_35px_rgba(0,0,0,0.1)] rounded-t-2xl lg:rounded-none">
        <div className="md:hidden">
          <div className="text-xs text-slate-500 font-medium">Total TTC</div>
          <div className="text-lg font-bold text-primary tabular-nums tracking-tight">
            {formatMAD(invoiceTotals.totalTTC)}
          </div>
        </div>
        
        <div className="flex items-center gap-3 ml-auto">
          <button
            disabled={submitting || !isValid}
            onClick={() => handleSubmit('draft')}
            className="px-5 py-2.5 rounded-lg font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Brouillon</span>
          </button>
          
          <button
             disabled={submitting || !isValid}
             onClick={() => handleSubmit('validated')}
             className="px-6 py-2.5 rounded-lg font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50 flex items-center gap-2"
          >
             <Send className="h-4 w-4" />
             Créer et Valider
          </button>
        </div>
      </div>

    </div>
  );
}
