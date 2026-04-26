# WhatsApp Invoice Bot — Implementation Prompts for Antigravity

> **How to use this file:** Each prompt below is a self-contained task for Antigravity. Run them **in order** — each prompt builds on the work from the previous one. Some prompts end with a `⏸️ HAMZA ACTION REQUIRED` section — those are things **you** need to do before the next prompt can run. Don't skip those steps.
>make sure you track the prompts that you finished and make sure you have that traced somewhere so we always know what we have done and what is left to do.
> Before each prompt, Antigravity should read `SKILL.md` and `INSTRUCTIONS.md` at the repo root.

 
---

## Pre-Flight Checklist (Do This Before Prompt 1)

Before giving Antigravity any prompt, you need to set up Meta's side. This takes ~1 week and Antigravity can't do it for you.

### What You Need to Do:

1. **Create a Meta Business Account** at [business.facebook.com](https://business.facebook.com)
   - Use your business legal name and details
   - Start the Business Verification process (upload trade register / RC document)
   - This takes 1-5 business days for Meta to approve

2. **Create a Meta App** at [developers.facebook.com](https://developers.facebook.com)
   - Click "Create App" → Choose "Business" type
   - Add the "WhatsApp" product to your app
   - Note down: **App ID** and **App Secret**

3. **Set Up WhatsApp Business**
   - In the Meta App dashboard, go to WhatsApp → Getting Started
   - Add a phone number (you can use Meta's test number initially)
   - Note down: **Phone Number ID** and **WhatsApp Business Account ID**
   - Generate a **Permanent Access Token** (System User → Generate Token → select whatsapp_business_messaging permission)

4. **Get an Gemini API Key**
   - Go to [console.Gemini.com](https://console.Gemini.com)
   - Create an API key for gemini gemini flash or similar access
   - Note down: **Gemini_API_KEY**

5. **Collect all credentials** — you'll need these for Prompt 2:
   - `META_APP_SECRET` (from Meta App → Settings → Basic)
   - `META_ACCESS_TOKEN` (permanent system user token)
   - `META_PHONE_NUMBER_ID` (from WhatsApp → Getting Started)
   - `META_WABA_ID` (WhatsApp Business Account ID)
   - `WHATSAPP_VERIFY_TOKEN` (make up a random string, e.g. `fatura_wa_verify_2026_xxxx`)
   - `Gemini_API_KEY`

> **Note:** You can start Prompts 1 while waiting for Meta Business Verification. But Prompts 4+ require a working WhatsApp setup.

---

## Prompt 1 — Data Models & Firestore Collections

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Add WhatsApp bot data models and Firestore infrastructure.

CONTEXT: We're building a WhatsApp invoice bot. Users will message a WhatsApp bot
to create invoices via natural language. The bot identifies businesses by their
registered phone number. We need new data models for conversation state and
phone-to-business mapping.

DO THE FOLLOWING:

1. READ these files first to understand existing patterns:
   - src/types/index.ts (all current interfaces)
   - src/lib/firestore.ts (CRUD patterns, transaction patterns)
   - src/contexts/AuthContext.tsx (how business/user state works)

2. ADD these new types to src/types/index.ts:

   a) WhatsAppSession interface:
      - id, businessId, waId (string, E.164 without +)
      - state: 'idle' | 'parsing_intent' | 'awaiting_client' | 'creating_client' |
        'awaiting_product' | 'creating_product' | 'awaiting_details' | 'confirming' |
        'generating' | 'delivered' | 'error'
      - intentData: { clientName?, productLabel?, quantity?, unitPrice? (centimes),
        tvaRate?, priceType?: 'HT' | 'TTC', notes?, dueDate? }
      - resolvedData: { clientId?, productId?, lines?: InvoiceLine[], totals? }
      - pendingField: string | null
      - messageHistory: { role: 'user' | 'bot', content: string, timestamp: Timestamp }[]
        (keep last 10)
      - invoiceId: string | null
      - expiresAt: Timestamp
      - createdAt, updatedAt: Timestamp

   b) WhatsAppLink interface:
      - waId: string (document ID, E.164 without +, e.g. "212612345678")
      - businessId: string
      - ownerId: string
      - isActive: boolean
      - linkedAt: Timestamp
      - lastMessageAt: Timestamp

   c) WhatsAppPreferences interface:
      - defaultTvaRate: TvaRate (default 20)
      - autoConfirm: boolean (default false)
      - language: 'fr' | 'ar' (default 'fr')
      - notifyOnGeneration: boolean (default true)

   d) Add to existing Business interface:
      - whatsappEnabled?: boolean
      - whatsappWaId?: string | null
      - whatsappPreferences?: WhatsAppPreferences

   e) NlpIntent interface:
      - intent: 'create_invoice' | 'check_status' | 'cancel' | 'help' | 'unknown'
      - confidence: number (0-1)
      - entities: {
          clientName: string | null,
          productLabel: string | null,
          quantity: number | null,
          unitPrice: number | null (centimes),
          currency: 'MAD',
          tvaOverride: TvaRate | null,
          priceType: 'HT' | 'TTC',
          dueDate: string | null (ISO),
          notes: string | null
        }

3. ADD Firestore CRUD functions to src/lib/firestore.ts:
   Follow the EXACT same patterns as the existing functions (converters, error
   handling, serverTimestamp, etc.):

   - createWhatsAppLink(waId, businessId, ownerId) → creates whatsappLinks/{waId}
   - getWhatsAppLink(waId) → returns WhatsAppLink | null
   - deactivateWhatsAppLink(waId) → sets isActive = false
   - getOrCreateSession(businessId, waId) → finds active session or creates new one
     with state='idle', expiresAt = now + 30min
   - updateSession(businessId, sessionId, data) → partial update
   - addMessageToHistory(businessId, sessionId, role, content) → append to
     messageHistory array (trim to last 10)
   - expireSession(businessId, sessionId) → set state='idle', clear intentData/resolvedData

   IMPORTANT: whatsappLinks is a TOP-LEVEL collection (not nested under businesses/).
   This is for fast lookup by phone number. Sessions ARE nested: businesses/{id}/whatsappSessions/

4. UPDATE Firestore security rules (firestore.rules):
   - whatsappLinks: read/write only for authenticated users where ownerId == request.auth.uid
   - whatsappSessions: same rules as other business sub-collections

5. RUN the existing build to make sure types compile:
   npm run build (or tsc --noEmit)

DO NOT create any Cloud Functions yet — that's the next prompt.
DO NOT install any new npm packages yet.
```

---

## Prompt 2 — Cloud Functions: Webhook & Configuration

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Build the WhatsApp webhook Cloud Function and set up configuration.

CONTEXT: We need a Cloud Function that receives WhatsApp messages via Meta's
Cloud API webhook. This function handles: webhook verification (GET), message
reception (POST), signature verification, and routing to the conversation engine.

READ FIRST:
- functions/src/index.ts (existing Cloud Functions — follow the same patterns)
- functions/package.json (current dependencies)
- src/types/index.ts (the types you added in the previous step)

DO THE FOLLOWING:

1. INSTALL dependencies in functions/:
   cd functions && npm install @Gemini-ai/sdk
   (The Gemini SDK is needed for NLP parsing in the next prompt, install now)

2. CREATE functions/src/whatsapp/ directory with these files:

   a) functions/src/whatsapp/config.ts
      - Export a config object that reads from functions.config():
        meta.appSecret, meta.accessToken, meta.phoneNumberId, meta.wabaId,
        whatsapp.verifyToken, Gemini.apiKey
      - Export the WhatsApp Cloud API base URL: https://graph.facebook.com/v19.0

   b) functions/src/whatsapp/webhook.ts
      - Export whatsappWebhook as an HTTPS Cloud Function (europe-west1)
      - GET handler: webhook verification
        - Check hub.mode === 'subscribe' && hub.verify_token matches config
        - Return hub.challenge with 200, or 403 on mismatch
      - POST handler:
        - Verify X-Hub-Signature-256 using HMAC-SHA256 with meta.appSecret
        - Return 200 immediately (async processing)
        - Extract messages from the webhook payload:
          body.entry[0].changes[0].value.messages[0]
        - For each message: extract waId (from), message type, message body
        - Look up whatsappLinks/{waId} in Firestore
        - If not found: send a "not registered" text message and return
        - If found but !isActive: send "disabled" message and return
        - If found: call processMessage() (stub for now — just log and echo back)
        - Deduplicate by message ID (store last 100 message IDs in memory/cache)
      - Rate limiting: track per-business message counts, reject > 60/min

   c) functions/src/whatsapp/messenger.ts
      - Export helper functions for sending WhatsApp messages via Cloud API:
        - sendTextMessage(waId, text) — POST to /{phoneNumberId}/messages
        - sendButtonMessage(waId, bodyText, buttons[]) — interactive reply buttons (max 3)
        - sendListMessage(waId, bodyText, sections[]) — interactive list message
        - sendDocumentMessage(waId, mediaUrl, filename, caption) — send PDF
        - uploadMedia(buffer, mimeType) — upload media, return media ID
      - All functions use the Meta access token from config
      - All functions include error handling and logging
      - All functions return the WhatsApp message ID on success

   d) functions/src/whatsapp/types.ts
      - TypeScript types for WhatsApp Cloud API payloads:
        - WebhookPayload, WebhookEntry, WebhookChange, WebhookMessage
        - TextMessage, InteractiveMessage, ButtonReply, ListReply
        - OutboundMessage, OutboundButton, OutboundListSection
      - These are Meta's API types, not our domain types

3. EXPORT the webhook from functions/src/index.ts:
   Import and re-export whatsappWebhook so it deploys as a Cloud Function.

4. ADD to functions/package.json scripts:
   "build:watch" should already exist. Verify tsc compiles cleanly.

5. TEST: Run `cd functions && npm run build` — must compile with zero errors.

OUTPUT: Tell me the exact Firebase CLI command to set the config values, formatted
like this so I can copy-paste:
firebase functions:config:set meta.app_secret="XXX" meta.access_token="XXX" ...

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Run the firebase config command that Antigravity gives you, replacing XXX with
  your actual credentials from the Pre-Flight Checklist
- Deploy functions: firebase deploy --only functions
- In Meta App dashboard → WhatsApp → Configuration:
  - Set Webhook URL to: https://europe-west1-YOUR_PROJECT_ID.cloudfunctions.net/whatsappWebhook
  - Set Verify Token to the same value you used in the config
  - Subscribe to webhook fields: messages
- Test: send any message to your WhatsApp Business number — you should get an echo back
```

---

## Prompt 3 — NLP Intent Parser (gemini Integration)

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Build the NLP intent parser using gemini gemini flash or similar that extracts structured
invoice data from natural language French messages.

CONTEXT: When a user sends "Facture pour Ahmed, logo design 8500dh", we need to
extract: clientName="Ahmed", productLabel="logo design", unitPrice=850000 (centimes),
currency="MAD", intent="create_invoice". The parser must handle informal French,
Moroccan price formats (dh, MAD, dirhams), and various ways of expressing invoice data.

READ FIRST:
- src/types/index.ts (NlpIntent interface you created)
- functions/src/whatsapp/config.ts (Gemini API key config)
- src/lib/tva.ts (how TVA calculation works)

DO THE FOLLOWING:

1. CREATE functions/src/whatsapp/nlp.ts with:

   a) parseInvoiceIntent(message: string, messageHistory: array) → NlpIntent
      - Calls gemini gemini flash or similar (gemini-gemini flash or similar-4-5-20251001) via Gemini SDK
      - Uses the system prompt below (adapt/improve it if you see gaps)
      - Passes the last few messages as context for multi-turn conversations
      - Returns structured JSON matching the NlpIntent interface
      - Handles API errors gracefully (timeout, rate limit, etc.)
      - Logs the parse result for debugging

   b) System prompt must cover:
      - You are an intent parser for a Moroccan invoicing app called Fatura
      - Extract client name, product/service, quantity, unit price, TVA, dates
      - Price formats: "8500dh", "8500 MAD", "8.500,00", "huit mille", "8500 dirhams"
      - Always convert price to centimes (integer). 8500dh = 850000 centimes
      - Default quantity to 1 if not specified
      - "HT" = hors taxe (before tax), "TTC" = toutes taxes comprises (with tax)
      - Default priceType to "HT" when ambiguous
      - Detect "sans TVA" = tvaOverride: 0
      - Date expressions: "fin du mois", "15 jours", "le 30 mai", "échéance 60 jours"
      - Multi-line: "facture: consulting 5000dh, déplacement 500dh" = 2 line items
      - Confidence < 0.5 if you can't identify at least a client name OR a price
      - For non-invoice intents: "aide"/"help" → help, "annuler" → cancel

   c) Price parsing helper: parseMoroccanPrice(priceStr: string) → number (centimes)
      - Handle: "8500", "8500dh", "8 500 MAD", "8.500,00", "8500,50"
      - Moroccan format uses dot for thousands, comma for decimals: "8.500,00" = 8500.00 MAD
      - Return as centimes (integer)

2. CREATE functions/src/whatsapp/matcher.ts with:

   a) findClientByName(businessId, name) → { exact: Client | null, fuzzy: Client[], none: boolean }
      - First: exact match query (where name == extractedName)
      - Then: prefix match using Firestore range query (name >= X, name <= X + \uf8ff)
      - Then: compute Jaro-Winkler similarity on results, accept >= 0.8
      - Return categorized: exact match, fuzzy matches (sorted by score), or none

   b) findProductByLabel(businessId, label) → { exact: Product | null, fuzzy: Product[], none: boolean }
      - Same logic as client matching but on the 'label' field
      - Only match active products (isActive === true)

   c) Helper: jaroWinklerSimilarity(s1, s2) → number (0-1)
      - Implement Jaro-Winkler string similarity
      - Normalize both strings: lowercase, trim, remove diacritics (é→e, etc.)

3. WRITE TESTS: Create functions/src/whatsapp/__tests__/nlp.test.ts
   - Test parseMoroccanPrice with: "8500dh", "8.500,00", "500", "15000 MAD", "8500,50 dh"
   - Test jaroWinklerSimilarity with: ("Ahmed", "Ahmed") = 1.0, ("Ahmed", "Ahmad") > 0.8,
     ("Ahmed", "Karim") < 0.5
   - Mock gemini API for parseInvoiceIntent tests with sample messages

4. COMPILE: cd functions && npm run build — must succeed with zero errors.

DO NOT modify the webhook yet — the next prompt connects everything.
```

---

## Prompt 4 — Conversation Engine (State Machine)

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Build the conversation engine — the state machine that drives multi-turn
WhatsApp conversations from intent parsing to invoice generation.

CONTEXT: This is the brain of the bot. It receives a parsed message, checks the
current session state, decides what to do next (ask for missing info, confirm,
generate), and produces the WhatsApp response. It must feel natural and fast.

READ FIRST:
- src/types/index.ts (WhatsAppSession, NlpIntent, all invoice types)
- functions/src/whatsapp/nlp.ts (parser you built)
- functions/src/whatsapp/matcher.ts (client/product matching)
- functions/src/whatsapp/messenger.ts (WhatsApp message sending)
- src/lib/firestore.ts (createInvoice function — study the transaction logic carefully)
- src/lib/tva.ts (TVA calculation — you'll need to replicate this server-side)

DO THE FOLLOWING:

1. CREATE functions/src/whatsapp/engine.ts — the main conversation handler:

   Export: processMessage(businessId: string, waId: string, message: WhatsAppMessage)

   This function:
   a) Loads the current session (getOrCreateSession)
   b) Adds the incoming message to history
   c) Routes based on session.state:

   STATE HANDLERS:

   idle / parsing_intent:
   - Call parseInvoiceIntent(message.text, session.messageHistory)
   - If intent === 'help': send help text, stay idle
   - If intent === 'cancel': send "Rien à annuler", stay idle
   - If intent === 'create_invoice':
     - Store intentData in session
     - If clientName found: run findClientByName()
       - exact match → move to product matching
       - fuzzy matches → send interactive list, move to awaiting_client
       - no match → ask "Client not found, create?" with buttons, move to awaiting_client
     - If no clientName: ask "Pour quel client ?", move to awaiting_client
   - If confidence < 0.5: send "Je n'ai pas compris. Essayez: Facture pour [client] [montant]"

   awaiting_client:
   - Handle interactive reply (list selection or button tap)
   - If user selected a client from list: set resolvedData.clientId, move to product phase
   - If user chose "Créer nouveau client": move to creating_client
   - If user typed a name: re-run findClientByName with the new text

   creating_client:
   - Ask for ICE (with "passer" option to skip)
   - Once done: call createClient() server-side (use firebase-admin equivalent)
   - Set resolvedData.clientId, move to product phase

   Product phase (awaiting_product):
   - If intentData.productLabel exists: run findProductByLabel()
     - exact/fuzzy → same disambiguation logic as clients
     - no match → offer to create inline or use as-is (custom description)
   - If intentData has both product and price → move to confirming
   - If missing price → ask "Quel est le prix HT ?", set pendingField='price'

   awaiting_details:
   - Parse the response for the specific pendingField
   - Validate (price must be > 0, quantity must be > 0, etc.)
   - Once all required fields filled → move to confirming

   confirming:
   - Build the invoice summary message:
     "📋 Facture pour [Client Name]:
      • [Product] — [qty] x [price] MAD HT
      • TVA [rate]%: [amount] MAD
      • Total TTC: [total] MAD
      Échéance: [date]"
   - Send with 3 buttons: "✅ Générer", "✏️ Modifier", "❌ Annuler"

   - On "✅ Générer": move to generating
   - On "✏️ Modifier": send list of modifiable fields, re-enter awaiting_details
   - On "❌ Annuler": send "Facture annulée.", reset to idle

   generating:
   - Lock: if session is already in 'generating', respond "Patientez..."
   - Assemble CreateDTO<Invoice> from resolvedData:
     - Calculate totals using TVA logic (replicate tva.ts helpers server-side)
     - Set type='facture', status='sent' (skip draft for WhatsApp)
     - Set issueDate=now, dueDate=now + paymentTermsDays
   - Call the server-side createInvoice equivalent (Firestore transaction with
     admin SDK — atomic counter increment, client total update)
   - Update session: invoiceId = created invoice ID, state = 'generating'
   - The existing onInvoiceCreated trigger will generate the PDF automatically

   delivered:
   - This state is set by the PDF delivery function (next prompt)
   - Session auto-expires after delivery

   error:
   - Send error message with "Réessayer" button
   - On retry: reset to idle

2. CREATE functions/src/whatsapp/tva-server.ts
   - Replicate the TVA calculation logic from src/lib/tva.ts but using firebase-admin
     (no client SDK imports). Functions needed:
     - calculateLineTotals(unitPrice, quantity, tvaRate, discount?) → { totalHT, totalTVA, totalTTC }
     - calculateInvoiceTotals(lines[]) → { totalHT, tvaBreakdown[], totalTVA, totalTTC }
   - All values in centimes, integer arithmetic only

3. CREATE functions/src/whatsapp/invoice-creator.ts
   - createInvoiceFromWhatsApp(businessId, resolvedData, intentData) → Invoice
   - Uses firebase-admin (server-side Firestore) to:
     - Run the same transaction as src/lib/firestore.ts createInvoice():
       atomic counter increment, invoice creation, client total update
     - Set createdBy = 'whatsapp-bot' (for audit trail distinction)
   - Returns the created invoice document

4. CONNECT to webhook: Update functions/src/whatsapp/webhook.ts
   - Replace the echo stub with: await processMessage(businessId, waId, message)
   - Wrap in try/catch: on error, send "Une erreur est survenue" via messenger

5. COMPILE: cd functions && npm run build

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Deploy: firebase deploy --only functions
- Test the bot end-to-end with a real WhatsApp message:
  1. Send "Facture pour [an existing client name], [a product] [price]dh"
  2. Verify you get a confirmation summary with buttons
  3. Tap "Générer" — invoice should be created in Firestore
  4. Check Firestore console: the invoice should appear under your business
- Report back: what worked, what didn't, any error messages
```

---

## Prompt 5 — PDF Delivery via WhatsApp

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Complete the invoice delivery loop — when a PDF is generated by the existing
onInvoiceCreated trigger, send it back to the user via WhatsApp.

CONTEXT: The flow right now is: user confirms → invoice created in Firestore →
onInvoiceCreated trigger generates PDF and sets pdfUrl. But the PDF doesn't get
sent back to WhatsApp yet. We need to close this loop.

READ FIRST:
- functions/src/index.ts (onInvoiceCreated — see how pdfUrl is set)
- functions/src/whatsapp/messenger.ts (sendDocumentMessage, uploadMedia)
- functions/src/whatsapp/engine.ts (the 'generating' state)

DO THE FOLLOWING:

1. CREATE functions/src/whatsapp/pdf-delivery.ts:

   Export: deliverInvoicePDF(businessId, invoiceId, sessionId)

   Logic:
   a) Poll for pdfUrl on the invoice document (check every 2 seconds, max 30 seconds)
      - Use a simple retry loop, not a Firestore listener (Cloud Functions context)
   b) Once pdfUrl is available:
      - Download the PDF from Firebase Storage
      - Upload to WhatsApp Media API via uploadMedia()
      - Send document message via sendDocumentMessage() with:
        - filename: "{invoiceNumber}.pdf"
        - caption: "✅ Votre facture {number} est prête ! Montant: {totalTTC} MAD TTC.
          Transférez ce PDF à votre client."
   c) Update session state to 'delivered'
   d) Log activity: "Facture envoyée via WhatsApp"
   e) If PDF doesn't arrive in 30s:
      - Send text message: "La facture {number} a été créée mais le PDF prend du temps.
        Retrouvez-la dans l'application Fatura."
      - Still update session to 'delivered'

2. INTEGRATE into the conversation engine:
   - In engine.ts, after createInvoiceFromWhatsApp() succeeds:
     - Send "⏳ Génération en cours..." text message
     - Call deliverInvoicePDF() — can be async (fire and forget with error handling)

3. HANDLE the "Modifier" button flow in engine.ts:
   - When user taps "✏️ Modifier" on the confirmation:
     - Send a list message with options: Client, Produit/Service, Quantité, Prix, TVA, Échéance, Notes
     - When user selects one, set pendingField and ask for the new value
     - After receiving the new value, recalculate totals and show updated confirmation

4. ADD the welcome/linking message:
   Create a function sendWelcomeMessage(waId) in messenger.ts that sends:
   "🎉 Bienvenue sur Fatura WhatsApp ! Vous pouvez maintenant créer des factures
   en envoyant un simple message.

   Exemple: \"Facture pour Ahmed, consulting 5000dh\"

   Envoyez \"aide\" pour plus d'informations."

5. COMPILE and verify: cd functions && npm run build

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Deploy: firebase deploy --only functions
- Test the FULL flow:
  1. Send "facture pour [client] [product] [price]dh"
  2. Confirm with the button
  3. Wait for the PDF to arrive in WhatsApp
  4. Open the PDF — verify it looks correct (business info, client, line items, TVA)
  5. Try "Modifier" flow — change the price, then generate
- Report back with results
```

---

## Prompt 6 — Settings Page (WhatsApp Activation UI)

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Add WhatsApp activation to the Settings page so users can enable/disable
the WhatsApp bot from the web app.

CONTEXT: Right now, there's no way for users to link their WhatsApp. We need a
section in Settings where they can toggle the feature on/off, see their linked
number, and configure preferences.

READ FIRST:
- src/pages/Settings.tsx (existing settings page — match the UI patterns)
- src/contexts/AuthContext.tsx (how business state is accessed)
- src/lib/firestore.ts (updateBusiness function)
- src/types/index.ts (WhatsAppPreferences, Business with new fields)
- src/components/ui/ (existing UI components — Button, Input, Select, etc.)

DO THE FOLLOWING:

1. CREATE a new callable Cloud Function: linkWhatsApp
   In functions/src/whatsapp/link.ts:
   - Input: { businessId: string }
   - Auth: verify context.auth.uid matches business.ownerId
   - Logic:
     a) Get the business document, extract phone number
     b) Normalize phone to WhatsApp format (212XXXXXXXXX, no +)
     c) Check if whatsappLinks/{waId} already exists for another business → error
     d) Create whatsappLinks/{waId} document
     e) Update business: whatsappEnabled=true, whatsappWaId=waId, whatsappPreferences=defaults
     f) Send welcome template message to the user's WhatsApp
     g) Return { success: true, waId }
   - Export from functions/src/index.ts

2. CREATE a callable: unlinkWhatsApp
   - Deactivate whatsappLinks document
   - Update business: whatsappEnabled=false

3. ADD WhatsApp section to src/pages/Settings.tsx:
   - New card/section titled "WhatsApp — Facturation par message"
   - If NOT linked:
     - Description text explaining the feature
     - "Activer WhatsApp" button → calls linkWhatsApp function
     - Show the user's registered phone number so they know what will be linked
     - Loading state while linking
   - If LINKED:
     - Show linked number with green status indicator
     - Toggle for enabled/disabled
     - Preferences section:
       - Default TVA rate dropdown (0%, 7%, 10%, 14%, 20%)
       - Language select (Français, العربية)
       - Auto-confirm toggle (with warning that it skips confirmation)
     - "Désactiver WhatsApp" button with confirmation dialog
   - Match the exact same card styling, spacing, and component usage as the rest
     of the Settings page

4. UPDATE src/contexts/AuthContext.tsx (if needed):
   - Make sure refreshBusiness() picks up the new whatsapp fields

5. COMPILE BOTH:
   - cd functions && npm run build
   - cd .. && npm run build (or npx tsc --noEmit for frontend)

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Deploy: firebase deploy --only functions
- Deploy frontend to Vercel (your usual deploy process)
- Go to Settings in the app and activate WhatsApp
- Verify you receive the welcome message on your WhatsApp
- Test: send a "facture pour..." message — everything should work now
```

---

## Prompt 7 — Error Handling, Rate Limiting & Session Cleanup

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Harden the WhatsApp bot with proper error handling, rate limiting,
session cleanup, and edge case management.

CONTEXT: The bot works for the happy path. Now we need to make it production-ready:
handle every failure mode, prevent abuse, and clean up stale sessions.

READ FIRST:
- functions/src/whatsapp/engine.ts (conversation engine)
- functions/src/whatsapp/webhook.ts (message handling)
- functions/src/whatsapp/messenger.ts (WhatsApp API calls)
- functions/src/index.ts (see scheduledOverdueCheck for scheduled function pattern)

DO THE FOLLOWING:

1. IMPROVE ERROR HANDLING in engine.ts:
   - Wrap every state handler in try/catch
   - On NLP API failure: send "Désolé, une erreur technique est survenue. Réessayez."
   - On Firestore failure: send "Erreur de base de données. Réessayez dans quelques instants."
   - On WhatsApp API send failure: retry 3x with exponential backoff (1s, 4s, 16s)
   - On all errors: log full context (businessId, sessionId, state, error message, stack)
   - After 3 consecutive errors in a session: reset to idle and inform user

2. ADD RATE LIMITING in webhook.ts:
   - Per-business: max 60 messages/minute
   - Invoice creation limit: max 20 invoices/hour per business
   - Implementation: use a Firestore document businesses/{id}/rateLimits/whatsapp
     with a sliding window counter (or in-memory Map with TTL — simpler for MVP)
   - When rate limited: send "Vous envoyez trop de messages. Réessayez dans une minute."

3. CREATE a scheduled function: cleanupWhatsAppSessions
   - Add to functions/src/index.ts following the scheduledOverdueCheck pattern
   - Schedule: every 15 minutes
   - Logic: query all businesses, find sessions where expiresAt < now,
     delete or mark them as expired
   - Log: "Cleaned up X expired sessions"

4. HANDLE EDGE CASES in engine.ts:
   - User sends a message while bot is in 'generating' state:
     "⏳ Votre facture est en cours de génération, veuillez patienter."
   - User sends an image/voice/location/sticker:
     "Je ne comprends que les messages texte pour l'instant.
     Envoyez votre demande en texte."
   - User sends empty message: ignore silently
   - User sends very long message (>1000 chars): truncate before sending to NLP
   - User sends "aide" or "help" from any state:
     Send help text explaining available commands and examples
   - User sends "annuler" from any active state:
     Cancel the current session, send "Session annulée."
   - Concurrent sessions: only one active session per business per waId

5. ADD the "aide" help message content:
   "📋 Comment utiliser Fatura WhatsApp:

   Créer une facture:
   → \"Facture pour [client], [produit] [prix]dh\"
   → \"Facture pour Ahmed Benali, consulting 5000 MAD\"

   Options:
   → \"sans TVA\" pour une facture sans TVA
   → \"TTC\" si le prix inclut la TVA
   → \"échéance 15 jours\" pour changer l'échéance

   Commandes:
   → \"aide\" — afficher ce message
   → \"annuler\" — annuler la session en cours

   Le bot utilise les clients et produits de votre compte Fatura."

6. COMPILE: cd functions && npm run build

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Deploy: firebase deploy --only functions
- Test these edge cases:
  1. Send 5+ messages very fast — check rate limiting works
  2. Send "aide" — check help message
  3. Send gibberish like "asdfghjkl" — should get "Je n'ai pas compris" message
  4. Start a facture flow, then send "annuler" — should cancel
  5. Send an image — should get "text only" message
  6. Wait 30+ minutes mid-conversation — should expire
```

---

## Prompt 8 — Activity Logging, Monitoring & Firestore Indexes

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Add comprehensive activity logging, create required Firestore indexes,
and add monitoring for the WhatsApp bot.

READ FIRST:
- functions/src/index.ts (logActivity helper — reuse it)
- firestore.indexes.json (currently empty — we need indexes)
- functions/src/whatsapp/engine.ts
- functions/src/whatsapp/pdf-delivery.ts

DO THE FOLLOWING:

1. ADD ACTIVITY LOGGING throughout the WhatsApp flow:
   Use the existing logActivity() helper with these action strings:
   - "WhatsApp: session démarrée" (when new session created)
   - "WhatsApp: intent parsé" (after NLP, include confidence and entities in details)
   - "WhatsApp: client résolu" (when client matched, include clientId and method: exact/fuzzy/created)
   - "WhatsApp: facture confirmée" (when user taps Générer)
   - "WhatsApp: facture créée" (after createInvoice, include invoiceId and number)
   - "WhatsApp: PDF envoyé" (after PDF delivered via WhatsApp)
   - "WhatsApp: session annulée" (on cancel)
   - "WhatsApp: erreur" (on any error, include error details)
   - "WhatsApp: compte lié" (when user activates WhatsApp in Settings)

2. ADD FIRESTORE INDEXES to firestore.indexes.json:
   These are needed for the queries used by the WhatsApp bot:
   - whatsappSessions: composite index on (businessId, state, expiresAt) for cleanup query
   - whatsappSessions: composite index on (businessId, waId, state) for active session lookup

3. ADD a Cloud Function for basic metrics: getWhatsAppStats (callable)
   - Input: { businessId, period: 'day' | 'week' | 'month' }
   - Returns:
     - Total messages received
     - Total invoices created via WhatsApp
     - Average time to invoice (session created → delivered)
     - Top 5 clients invoiced via WhatsApp
     - NLP accuracy (intents with confidence > 0.8 / total)
   - Query from activity logs filtered by "WhatsApp:" prefix

4. UPDATE the Dashboard page (src/pages/Dashboard.tsx):
   - If business.whatsappEnabled, add a small card showing:
     "WhatsApp: X factures ce mois" with a WhatsApp icon
   - Keep it minimal — just a counter, not a full dashboard

5. COMPILE: cd functions && npm run build && cd .. && npx tsc --noEmit

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Deploy everything: firebase deploy
- Deploy frontend to Vercel
- Run: firebase deploy --only firestore:indexes
- Create 3-4 invoices via WhatsApp to generate activity data
- Check the Dashboard — WhatsApp counter should appear
- Check Firestore console → activity logs — WhatsApp entries should be there
```

---

## Prompt 9 — Final Polish, Testing & Security Audit

```
Read SKILL.md and INSTRUCTIONS.md at the repo root before starting.

TASK: Final review, security hardening, and comprehensive testing of the
WhatsApp bot feature.

READ: All files in functions/src/whatsapp/ and any modified files in src/.

DO THE FOLLOWING:

1. SECURITY REVIEW:
   - Verify webhook signature validation is correct (HMAC-SHA256 with raw body)
   - Verify no secrets are hardcoded anywhere (grep for API keys, tokens)
   - Verify whatsappLinks security rules prevent cross-business access
   - Verify rate limiting can't be bypassed
   - Verify session data doesn't leak between businesses
   - Check for any injection vectors in NLP prompt construction
   - Verify all error messages don't leak internal details to users

2. UPDATE Firestore security rules (firestore.rules):
   - whatsappLinks: only the business owner can read/write their link
   - whatsappSessions: only accessible within the business scope
   - Rate limit documents: only writable by Cloud Functions (admin)

3. CODE REVIEW — check every file in functions/src/whatsapp/ for:
   - Consistent error handling (no unhandled promises)
   - Proper TypeScript types (no `any` where avoidable)
   - No console.log (use functions.logger instead)
   - Proper async/await (no floating promises)
   - Memory leaks (no growing arrays or maps without cleanup)
   - Follow existing code patterns from functions/src/index.ts

4. WRITE INTEGRATION TESTS in functions/src/whatsapp/__tests__/:
   - webhook.test.ts: verify signature validation, verify token check
   - engine.test.ts: test each state transition with mocked Firestore and NLP
   - messenger.test.ts: test message formatting
   - Test: what happens with malformed webhook payloads
   - Test: what happens when Firestore is down
   - Test: what happens when gemini API times out

5. CREATE a test script: functions/src/whatsapp/__tests__/e2e-simulator.ts
   - Simulates a full conversation flow by calling processMessage directly
   - Uses Firebase emulator for Firestore
   - Covers: happy path, unknown client, fuzzy match, modification, cancellation

6. REVIEW all user-facing messages for:
   - Consistent tone (professional but friendly, in French)
   - Correct grammar and spelling
   - Appropriate use of emojis (sparingly, functionally)
   - No technical jargon in error messages

7. COMPILE: cd functions && npm run build
   Run tests: cd functions && npm test (if test runner is configured)

OUTPUT: Provide a summary of:
- All security issues found and fixed
- All code quality issues found and fixed
- Test coverage summary
- Any remaining TODOs or known limitations
- Recommended monitoring alerts to set up

⏸️ HAMZA ACTION REQUIRED after this prompt:
- Final deploy: firebase deploy
- Deploy frontend: your usual Vercel deploy
- Run through the full test scenario one more time:
  1. Activate WhatsApp from Settings page
  2. Send "facture pour [real client] [real product] [price]dh"
  3. Get confirmation, tap Générer
  4. Receive PDF in WhatsApp
  5. Open PDF, verify everything is correct
  6. Check Fatura web app — invoice should appear in the invoice list
  7. Test "aide", "annuler", edge cases
- If everything works: you're ready for beta!
```

---

## Post-Launch Checklist

After all 9 prompts are complete and tested:

1. **Submit WhatsApp Message Templates** for future proactive features:
   - Go to Meta Business Suite → WhatsApp → Message Templates
   - Create a "welcome" template (for initial linking confirmation)
   - Create a "invoice_ready" template (for sending PDFs after 24h window)
   - Templates need Meta approval (~24-48 hours)

2. **Set up monitoring alerts** in Google Cloud Console:
   - Alert if Cloud Function error rate > 5%
   - Alert if WhatsApp webhook response time > 5 seconds
   - Alert if > 100 rate-limit rejections per hour

3. **Beta launch:**
   - Invite 10-20 power users from your existing user base
   - Monitor activity logs daily for the first week
   - Collect feedback via a simple Google Form

4. **Track these metrics weekly:**
   - WhatsApp activation rate (% of users who enable it)
   - Invoice completion rate (started → delivered)
   - Average time to invoice
   - NLP accuracy rate
   - Error rate

---

## Quick Reference: What Antigravity Does vs. What You Do

| Step | Antigravity | Hamza |
|------|-------------|-------|
| Pre-Flight | Nothing | Set up Meta Business, get API keys |
| Prompt 1 | Data models, types, Firestore functions | Nothing |
| Prompt 2 | Webhook, messenger, config | Set Firebase config, deploy, configure Meta webhook URL |
| Prompt 3 | NLP parser, client/product matching | Nothing |
| Prompt 4 | Conversation engine, invoice creator | Deploy, test full flow |
| Prompt 5 | PDF delivery, modification flow | Deploy, test PDF delivery |
| Prompt 6 | Settings UI, linking functions | Deploy both, test activation |
| Prompt 7 | Error handling, rate limiting | Deploy, test edge cases |
| Prompt 8 | Logging, monitoring, indexes | Deploy all, deploy indexes |
| Prompt 9 | Security audit, tests, polish | Final deploy, full test, beta launch |
