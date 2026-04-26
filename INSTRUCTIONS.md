# Instructions — Fatura Engineering Agent

You are a principal-level engineer embedded in Fatura, a SaaS invoicing platform for
Moroccan small businesses. Read this file and SKILL.md before every task. No exceptions.

---

 

## What Fatura Is

Fatura helps Moroccan auto-entrepreneurs, freelancers, and small businesses create
professional, tax-compliant invoices. Users create clients, add products, generate
invoices with automatic TVA calculation, and track payments. The app generates branded
PDF invoices and UBL 2.1 XML for DGI (Direction Générale des Impôts) e-invoicing compliance.

The WhatsApp invoice bot (in development) lets users create invoices by sending a
natural language message to a WhatsApp bot, without opening the web app.

---

## Tech Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Frontend | React 19, TypeScript 6, Vite 8 | SPA, mobile-first |
| Styling | Tailwind CSS 3 | Config in `tailwind.config.ts` |
| Icons | Lucide React | |
| Cloud Functions | Firebase Functions, Node 20 | Region: **europe-west1** (closest to Morocco) |
| Database | Firestore (NoSQL) | Location: **eur3**. Nested collections. |
| Auth | Firebase Phone Auth | SMS OTP, +212 Moroccan numbers, reCAPTCHA v3 |
| Storage | Firebase Storage | Invoice PDFs, business logos |
| PDF (server) | PDFKit | `onInvoiceCreated` trigger in Cloud Functions |
| PDF (client) | jsPDF + jsPDF-autotable | `src/lib/pdf.ts` |
| NLP | Gemini AI (key in .) | WhatsApp bot intent parsing |
| Messaging | WhatsApp Business Cloud API (Meta) | WhatsApp bot channel |
| Hosting | Vercel (frontend), Firebase (functions + storage) | |

---

## Project Structure

```
fatura/
├── functions/                         # Firebase Cloud Functions (server-side)
│   ├── src/
│   │   ├── index.ts                   # Triggers, callables, scheduled functions
│   │   └── whatsapp/                  # WhatsApp bot module
│   │       ├── config.ts              # Meta & GEMINI API config (reads functions.config())
│   │       ├── webhook.ts             # HTTPS handler: GET verify + POST messages
│   │       ├── engine.ts              # Conversation state machine
│   │       ├── nlp.ts                 # gemini gemini flash or similar intent parser
│   │       ├── matcher.ts            # Fuzzy client/product matching (Jaro-Winkler)
│   │       ├── messenger.ts           # WhatsApp Cloud API message senders
│   │       ├── tva-server.ts          # TVA calc with firebase-admin (not client SDK)
│   │       ├── invoice-creator.ts     # Invoice creation via admin SDK transaction
│   │       ├── pdf-delivery.ts        # PDF fetch from Storage → send via WhatsApp
│   │       ├── link.ts                # Callable: link/unlink WhatsApp account
│   │       └── types.ts               # Meta webhook payload TypeScript types
│   ├── package.json                   # firebase-admin, firebase-functions, pdfkit, @gemini-ai/sdk
│   └── tsconfig.json
│
├── src/
│   ├── types/index.ts                 # ALL TypeScript interfaces (single source of truth)
│   ├── lib/
│   │   ├── firebase.ts                # Firebase app init
│   │   ├── auth.ts                    # Phone auth, OTP, phone normalization
│   │   ├── firestore.ts               # ALL Firestore CRUD, converters, transactions
│   │   ├── tva.ts                     # TVA calculation, centimes helpers, payment balance
│   │   ├── pdf.ts                     # Client-side PDF generation (jsPDF)
│   │   ├── ubl.ts                     # UBL 2.1 XML for DGI e-invoicing
│   │   └── utils.ts
│   ├── contexts/
│   │   ├── AuthContext.tsx             # Auth + business state provider
│   │   └── LanguageContext.tsx         # i18n (fr/ar)
│   ├── hooks/                         # useInvoices, useClients, useProducts, useDashboard
│   ├── pages/                         # Login, Onboarding, Dashboard, Invoices, Settings, etc.
│   ├── components/                    # layout/, clients/, products/, ui/
│   └── i18n/                          # fr.ts, ar.ts translations
│
├── INSTRUCTIONS.md                    # ← You are here. Project facts and conventions.
├── SKILL.md                           # Engineering persona, decision-making, domain knowledge.
├── WHATSAPP-BOT-PROMPTS.md            # Sequenced implementation prompts
├── firestore.rules                    # Security rules (currently permissive — needs hardening)
├── firestore.indexes.json             # Composite indexes
├── firebase.json                      # Firebase project config
└── .env.example                       # Frontend env vars template
```

---

## Firestore Data Architecture

### Collection Hierarchy

```
businesses/{businessId}/
  ├── clients/{clientId}
  ├── products/{productId}
  ├── invoices/{invoiceId}           # Lines[] and payments[] embedded in document
  ├── counters/invoice               # { currentYear, lastNumber } for F-YYYY-NNNN
  ├── whatsappSessions/{sessionId}   # Conversation state for WhatsApp bot
  ├── rateLimits/whatsapp            # Sliding window message counter
  └── activity/{logId}               # Audit trail

whatsappLinks/{waId}                 # TOP-LEVEL — maps phone number → businessId
```

`whatsappLinks` is top-level because the webhook knows only the sender's phone number.
It must find the business without knowing the businessId first.

### Key Interfaces (all in `src/types/index.ts`)

**Business**: `id`, `ownerId`, `legalName`, `tradeName`, `ice` (15 digits), `identifiantFiscal?`,
`registreCommerce?`, `cnss?`, `tvaRegime` (assujetti | non_assujetti | exonere), `legalForm`,
`address`, `phone?`, `email?`, `logoUrl?`, `brandColor?`, `defaultPaymentTermsDays` (default 30),
`defaultCurrency` ('MAD'), `bankDetails?`, `subscription`, `whatsappEnabled?`, `whatsappWaId?`,
`whatsappPreferences?`

**Client**: `id`, `businessId`, `name`, `ice?`, `contactPerson?`, `email?`, `phone?`, `address`,
`paymentTermsDays?`, `notes?`, `tags?`, `totalInvoiced` (centimes), `totalPaid` (centimes),
`balance` (centimes)

**Product**: `id`, `businessId`, `label`, `description?`, `unitPrice` (centimes),
`tvaRate` (0|7|10|14|20), `unit` (unit|hour|day|kg|m2|forfait|lot), `category?`, `isActive`

**Invoice**: `id`, `businessId`, `clientId`, `number` (F-YYYY-NNNN), `type` (facture|avoir|proforma|devis),
`status` (draft|sent|validated|paid|partially_paid|overdue|cancelled), `issueDate`, `dueDate`,
`lines[]` (InvoiceLine), `totals` ({ totalHT, tvaBreakdown[], totalTVA, totalTTC }), `payments[]`,
`pdfUrl?`, `ublXml?`, `dgiStatus`, `dgiValidationId?`

**InvoiceLine**: `id`, `productId?`, `description`, `quantity`, `unitPrice` (centimes),
`tvaRate`, `discount?` ({ type: percentage|fixed, value }), `totalHT`, `totalTVA`, `totalTTC`

---

## Core Conventions

### Money: Centimes, Integers, No Exceptions

All monetary values are integers representing centimes. `4 500,00 MAD` = `450000`.
Never use floats for money. This prevents rounding errors in TVA calculations.

```typescript
unitPrice: 850000    // ✅ 8 500,00 MAD in centimes
unitPrice: 8500.00   // ❌ NEVER — will cause rounding errors
```

Conversion helpers in `src/lib/tva.ts`: `madToCentimes(mad)`, `centimesToMAD(centimes)`,
`formatMAD(centimes, locale)`.

### Invoice Numbering: Transactional

Format: `F-YYYY-NNNN` (e.g., `F-2026-0042`). Counter document at
`businesses/{id}/counters/invoice` with `{ currentYear, lastNumber }`.

The counter MUST be incremented inside a Firestore transaction together with invoice
creation. This prevents duplicate numbers under concurrent requests. The pattern is
implemented in `createInvoice()` in `src/lib/firestore.ts` — study it before writing
any invoice creation logic. The WhatsApp bot must use the identical pattern.

Counter resets to 1 when `currentYear` changes.

### TVA (Moroccan VAT)

Legal rates: `0%`, `7%`, `10%`, `14%`, `20%`. Type: `TvaRate = 0 | 7 | 10 | 14 | 20`.

Calculation order: discount first, then TVA on discounted amount. Integer arithmetic
throughout. See `calculateLineTotal()` in `src/lib/tva.ts`.

`tvaRegime` on Business:
- `assujetti`: subject to TVA — TVA calculated and shown on invoices
- `non_assujetti`: not subject — TVA is 0% on all lines, mention "Non assujetti à la TVA" on invoice
- `exonere`: exempt — TVA is 0%, mention "Exonéré de TVA" on invoice

### Tax Identifiers

| ID | Name | Format | Required |
|----|------|--------|----------|
| ICE | Identifiant Commun de l'Entreprise | 15 digits exactly | Mandatory since 2019 |
| IF | Identifiant Fiscal | Variable | Optional |
| RC | Registre de Commerce | Variable | Optional |
| CNSS | Caisse Nationale de Sécurité Sociale | Variable | Optional |

ICE structure: first 9 digits = company number, next 4 = establishment, last 2 = control.

### Phone Numbers

Two formats in this codebase:
- **E.164 (with +)**: `+212612345678` — used in Firebase Auth, stored in Business.phone
- **waId (without +)**: `212612345678` — used as WhatsApp identifier, stored as document ID in `whatsappLinks`

Input normalization (0612345678 → +212612345678) is in `src/lib/auth.ts`.
For WhatsApp conversion: strip the `+` prefix for waId, add it back for E.164.

### Timestamps

Always `serverTimestamp()` for `createdAt` and `updatedAt`. Never `new Date()` or
`Timestamp.now()` for these fields.

Exception: `expiresAt` on WhatsApp sessions uses `Timestamp.fromDate(new Date(Date.now() + 30*60*1000))`
because it's a future timestamp, not a "now" marker.

### Firestore Transactions

All reads first, then all writes. Firestore requires this ordering. Existing pattern
in `createInvoice()`:

```typescript
return await runTransaction(db, async (transaction) => {
  // 1. ALL READS
  const counterDoc = await transaction.get(counterRef);
  const clientDoc = await transaction.get(clientRef);
  
  // 2. LOGIC (pure computation, no Firestore calls)
  const nextNumber = ...;
  
  // 3. ALL WRITES
  transaction.set(invoiceRef, newInvoice);
  transaction.set(counterRef, { ... });
  transaction.update(clientRef, { ... });
});
```

### Naming

- Files: kebab-case (`invoice-creator.ts`)
- Components: PascalCase (`ClientForm.tsx`)
- Variables/functions: camelCase (`createInvoice`, `totalHT`)
- Firestore fields: camelCase (`businessId`, `tvaRate`, `totalTTC`)
- Types: PascalCase (`InvoiceLine`, `TvaRate`, `WhatsAppSession`)
- Constants: UPPER_SNAKE_CASE (`TVA_RATES`, `INVOICE_STATUS_LABELS`)
- Code/comments: English
- UI text: French (primary) + Arabic
- WhatsApp bot messages: French (MVP)

### Logging

- Cloud Functions: `functions.logger.info()`, `.error()`, `.warn()`. Never `console.log`.
- Include context in logs: `{ businessId, invoiceId, sessionId, error }`.
- Activity logging: use `logActivity()` helper for audit trail entries.

### Secrets

All API keys and tokens in Firebase Functions environment config:
```bash
firebase functions:config:set meta.app_secret="..." meta.access_token="..." ...
```
Access in code via `functions.config().meta.app_secret`. Never hardcode. Never commit.

---

## WhatsApp Bot — Conversation State Machine

### States and Transitions

```
idle → parsing_intent → awaiting_client → awaiting_product → confirming → generating → delivered
                      → awaiting_client → creating_client ↗
                      → awaiting_product → creating_product ↗
                      → awaiting_details ↗
                      
Any state → idle (on "annuler" or session timeout)
Any state → error → idle (on retry or timeout)
```

| State | What's Happening | Next States |
|-------|-----------------|-------------|
| idle | Waiting for user input | parsing_intent |
| parsing_intent | NLP analyzing message via gemini gemini flash or similar | awaiting_client, awaiting_product, confirming, idle (on failure) |
| awaiting_client | Client ambiguous or not found, asking user | creating_client, awaiting_product, confirming |
| creating_client | Creating new client inline (asking for ICE, etc.) | awaiting_product, confirming |
| awaiting_product | Product ambiguous or not found | creating_product, confirming |
| creating_product | Creating new product inline | confirming |
| awaiting_details | Missing required field (price, quantity, etc.) | confirming |
| confirming | Summary shown, waiting for user to tap Generate/Modify/Cancel | generating, awaiting_details, idle |
| generating | Invoice being created + PDF generating | delivered, error |
| delivered | PDF sent to user. Session complete. | idle (auto-expire) |
| error | Something failed. Retry or abandon. | idle, parsing_intent |

### NLP Intent Schema (gemini gemini flash or similar output)

```typescript
interface NlpIntent {
  intent: 'create_invoice' | 'check_status' | 'cancel' | 'help' | 'unknown';
  confidence: number;  // 0.0–1.0. Below 0.5 = ask user to rephrase.
  entities: {
    clientName: string | null;
    productLabel: string | null;
    quantity: number | null;       // default 1 if not specified
    unitPrice: number | null;      // IN CENTIMES — gemini must convert
    currency: 'MAD';
    tvaOverride: TvaRate | null;   // null = use business default
    priceType: 'HT' | 'TTC';      // default HT when ambiguous
    dueDate: string | null;        // ISO 8601 or null
    notes: string | null;
  };
}
```

Price parsing examples the NLP must handle:
- `"8500dh"` → 850000 centimes
- `"8 500 MAD"` → 850000
- `"8.500,00"` → 850000 (Moroccan format: dot=thousands, comma=decimals)
- `"8500,50 dh"` → 850050
- `"sans TVA"` → tvaOverride: 0
- `"TTC"` → priceType: 'TTC'
- `"échéance 15 jours"` → dueDate: ISO date 15 days from now

### Fuzzy Matching

For client/product lookup after NLP extraction:

1. Exact match: Firestore `where('name', '==', extractedName)`
2. Prefix match: Firestore range query `where('name', '>=', x)`, `where('name', '<=', x + '\uf8ff')`
3. Fuzzy: Jaro-Winkler similarity on results. Accept score ≥ 0.8.
4. Multiple matches (2+): show WhatsApp interactive list, user picks one.
5. No match: offer to create new client/product inline.

Normalize before comparing: lowercase, trim, strip diacritics (é→e, à→a, etc.).

Implement Jaro-Winkler in-house (small algorithm, no npm package needed).

### Rate Limiting

- Per-business: max 60 messages/minute via WhatsApp
- Invoice creation: max 20 invoices/hour per business via WhatsApp
- Session timeout: 30 minutes of inactivity
- Implementation: Firestore document `businesses/{id}/rateLimits/whatsapp` with
  sliding window counter (`{ messageCount, windowStart, invoiceCount, invoiceWindowStart }`)

### Webhook Deduplication

Meta retries webhooks if they don't get 200 OK within 5 seconds. Track the last 100
message IDs in an in-memory Map (Cloud Functions instance). If a message ID is seen
again, skip processing. The Map resets when the function cold-starts, which is fine —
duplicates only happen within seconds of each other.

### 24-Hour Messaging Window

Meta allows free-form messages only within 24 hours of the user's last message to us.
After that, only pre-approved template messages are allowed.

For the invoice bot, this is not an issue in MVP because the user always initiates
(sends a message first, opening the window). Template messages will be needed later
for proactive features like payment reminders.

---

## Files You Must Study Before Writing Code

Read these files in full before implementing any feature. They contain the patterns
you must follow exactly:

| What | File | Why |
|------|------|-----|
| All types | `src/types/index.ts` | Every interface, union type, and constant. Add new types here. |
| Firestore CRUD | `src/lib/firestore.ts` | Converter pattern, transaction pattern, query patterns, error handling |
| Invoice creation | `src/lib/firestore.ts` → `createInvoice()` | The atomic transaction you must replicate server-side |
| TVA math | `src/lib/tva.ts` | Integer arithmetic, line totals, invoice totals, breakdown |
| Cloud Functions | `functions/src/index.ts` | Region setup, trigger/callable/scheduled patterns, helpers |
| PDF generation | `functions/src/index.ts` → `generateInvoicePDF()` | How business+client data flows into the PDF |
| Phone auth | `src/lib/auth.ts` | Phone normalization, E.164, Moroccan number handling |
| Settings page | `src/pages/Settings.tsx` | UI patterns, component usage, card styling |
| Auth context | `src/contexts/AuthContext.tsx` | How user/business state is loaded and accessed |

---

## Working With Me (the Project Owner)

### When You Finish a Task

Tell me:
1. What you built and what changed (files created/modified)
2. Any trade-offs or assumptions you made
3. Exact commands I need to run to deploy
4. Exact steps I need to take in external dashboards (Meta, Firebase Console, etc.)
5. How to test that it works (specific messages to send, things to check)
6. Any known limitations or follow-up work

### When You Need Me to Act

Give me step-by-step instructions with exact commands, URLs, and field values.
Not "configure the webhook" but:
```
1. Go to developers.facebook.com → Your App → WhatsApp → Configuration
2. Set Webhook URL to: https://europe-west1-fatura-xxxxx.cloudfunctions.net/whatsappWebhook
3. Set Verify Token to: [the value from functions.config().whatsapp.verify_token]
4. Click "Subscribe" next to the "messages" field
```

### When Something Is Ambiguous

State your assumption, build it that way, and flag it:
"I assumed X because Y. If you meant Z, I'll adjust."
Don't ask for clarification on every small detail. Only ask when the ambiguity would
lead to fundamentally different implementations.
