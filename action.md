# Actions Requises (WhatsApp Bot via Twilio)

Puisque le compte Meta Business est bloqué et nécessite une vérification d'entreprise impossible pour le moment, nous avons migré vers **Twilio WhatsApp Sandbox**. Cela vous permet d'utiliser le bot immédiatement sans attendre de validation.

---

### Étape 1 : Récupération des clés Twilio
1. Créez un compte sur [Twilio.com](https://www.twilio.com/) (ou connectez-vous).
2. Dans votre Console Twilio (Dashboard principal), récupérez :
   - **Account SID**
   - **Auth Token**
3. Allez dans **Messaging** → **Try it out** → **Send a WhatsApp message**.
4. Suivez les instructions pour activer la **Sandbox** :
   - Envoyez le code (ex: `join context-xyz`) depuis votre téléphone au numéro Twilio indiqué (ex: `+1 415 523 8886`).
   - Notez ce **numéro de téléphone Twilio** (celui de la sandbox).

### Étape 2 : Configuration du fichier `.env`
Allez dans votre dossier `functions/` et mettez à jour (ou créez) le fichier `.env` avec vos nouveaux identifiants :

```env
TWILIO_ACCOUNT_SID="VOTRE_ACCOUNT_SID"
TWILIO_AUTH_TOKEN="VOTRE_AUTH_TOKEN"
TWILIO_PHONE_NUMBER="whatsapp:+14155238886"  # Le numéro de la Sandbox Twilio
GEMINI_API_KEY="VOTRE_CLE_API_GEMINI"
```

### Étape 3 : Déploiement du nouveau code
Nous avons refait le code pour Twilio. Déployez-le maintenant :

```bash
cd functions
npm run build
firebase deploy --only functions
```

### Étape 4 : Configuration du Webhook sur Twilio
C'est l'étape CRUCIALE pour que Twilio envoie les messages à votre code Firebase.

1. Dans la console Twilio, allez dans **Messaging** → **Settings** → **WhatsApp Sandbox Settings**.
2. Dans le champ **"WHEN A MESSAGE COMES IN"**, collez votre URL Firebase :
   `https://europe-west1-fatura-saas-maroc.cloudfunctions.net/whatsappWebhook`
3. Vérifiez que la méthode à côté est bien **HTTP POST**.
4. Cliquez sur **Save**.

### Étape 5 : Activation dans Fatura
1. Allez sur votre application Fatura (la version locale ou déployée).
2. Allez dans **Paramètres (Settings)** → **WhatsApp**.
3. Assurez-vous que votre numéro de téléphone est bien renseigné et cliquez sur **Activer**.

### Étape 6 : Tests !
Envoyez un message depuis votre téléphone au numéro de la Sandbox Twilio :

1. **Test AIDE :** Envoyez "aide".
2. **Test Facture :** Envoyez "Facture pour Ahmed, consulting 5000dh".
3. **Validation :** Répondez avec les chiffres pour choisir le client/produit si demandé, puis cliquez sur "Générer" (qui sera un message texte "1" ou "Générer" car la sandbox ne supporte pas bien les boutons riches sans templates pré-approuvés).

---
**Note sur les Boutons :** Dans la Sandbox Twilio, nous utilisons des réponses numérotées (ex: [1] Confirmer, [2] Modifier) car les vrais boutons WhatsApp nécessitent une approbation de template par Meta, ce qui prend du temps.
