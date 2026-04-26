# Actions Requises (WhatsApp Bot)

Voici un résumé complet de toutes les actions que vous devez effectuer (les étapes "HAMZA ACTION REQUIRED") pour finaliser l'intégration du bot WhatsApp, depuis le début jusqu'à la fin de l'étape 8. 

Puisque nous avons développé toutes les fonctionnalités jusqu'à l'étape 8 sans que vous ayez pu encore tout configurer (en attente de la validation Meta), **voici exactement ce que vous devez faire dès que votre compte Meta est approuvé.**

---

### Étape 1 : Récupération des clés et Configuration Firebase
Dès que Meta valide votre entreprise, vous aurez accès à vos identifiants de production.

1. **Récupérez vos identifiants Meta :**
   - `App Secret` (depuis les paramètres de l'app Meta)
   - `Permanent Access Token` (Token d'accès permanent)
   - `Phone Number ID` (ID du numéro de téléphone)
   - `WABA ID` (ID du compte WhatsApp Business)
2. **Choisissez un Verify Token :** Inventez une chaîne de caractères aléatoire (ex: `fatura_wa_verify_2026_xyz`).
3. **Configurez Firebase avec un fichier `.env` :**
   Firebase n'utilise plus `functions:config:set` (déprécié). Créez plutôt un fichier nommé `.env` dans le dossier `functions/` avec le contenu suivant :
   ```env
   META_APP_SECRET="XXX"
   META_ACCESS_TOKEN="XXX"
   META_PHONE_NUMBER_ID="XXX"
   META_WABA_ID="XXX"
   WHATSAPP_VERIFY_TOKEN="XXX"
   GEMINI_API_KEY="VOTRE_CLE_API_GEMINI"
   ```

### Étape 2 : Déploiement Complet
Maintenant que le code est prêt et configuré, il faut tout envoyer sur vos serveurs.

1. **Déployez les Cloud Functions et les Index Firestore :**
   ```bash
   firebase deploy --only functions,firestore:indexes
   ```
2. **Déployez le Frontend :**
   Déployez votre application React sur Vercel (ou votre plateforme d'hébergement habituelle) pour que la nouvelle interface de configuration WhatsApp et le Dashboard soient en ligne.

### Étape 3 : Configuration du Webhook sur Meta
C'est ici que vous connectez Meta à votre application Fatura.

1. Allez dans le tableau de bord de votre App Meta → **WhatsApp** → **Configuration**.
2. Modifiez le **Webhook URL** et mettez : 
   `https://europe-west1-fatura-saas-maroc.cloudfunctions.net/whatsappWebhook`
3. Renseignez le **Verify Token** (celui que vous avez inventé à l'Étape 1).
4. Cliquez sur **Gérer** dans les champs du webhook et abonnez-vous au champ `messages`.

### Étape 4 : Activation dans Fatura
1. Connectez-vous à votre application Fatura (sur votre version déployée).
2. Allez dans les **Paramètres (Settings)**.
3. Cherchez la nouvelle section **"WhatsApp — Facturation par message"**.
4. Cliquez sur **Activer WhatsApp** pour lier votre compte Fatura au numéro WhatsApp.
5. **Vérification :** Vous devriez recevoir automatiquement un message de bienvenue sur votre WhatsApp !

### Étape 5 : Tests d'utilisation (Recette)
Testez le bot WhatsApp pour vous assurer que tout fonctionne correctement :

1. **Le flux normal :**
   - Envoyez : *"Facture pour [Nom d'un client existant], [Produit] [Prix]dh"*
   - Le bot doit vous répondre avec un résumé et des boutons.
   - Cliquez sur **Générer**.
   - Le bot doit générer la facture, et après quelques instants, **vous envoyer le PDF directement sur WhatsApp**.
2. **La modification :**
   - Créez une nouvelle facture, mais avant de générer, cliquez sur **Modifier**. Changez le prix ou la quantité pour tester le flux de modification.
3. **Les cas d'erreur et limites :**
   - Envoyez le mot `"aide"` (le bot doit vous renvoyer le menu d'aide).
   - Envoyez le mot `"annuler"` au milieu d'une création de facture.
   - Envoyez une image ou un fichier audio (le bot doit vous dire qu'il ne comprend que le texte).
   - Envoyez 5 à 6 messages très rapidement pour vérifier que la limite de débit (Rate Limiting) fonctionne.
4. **Le Tableau de Bord (Dashboard) :**
   - Retournez sur votre application Web Fatura, allez sur le Dashboard principal.
   - Vérifiez que la nouvelle carte **"Activité WhatsApp"** s'affiche correctement avec le nombre de sessions, factures générées, et PDF envoyés.
