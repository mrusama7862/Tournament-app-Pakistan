# Tournament App - Pakistan | User Panel

This is a production-ready, client-side user panel for a tournament application tailored for the Pakistani market. It's built with modular HTML, CSS, and JavaScript, and is ready for integration with Firebase for backend services and JazzCash for payments.

## Features
- **Modern Authentication**: Secure sign-up/login with Email/Password and Google Sign-In.
- **Tournament Management**: View, search, and join tournaments.
- **Wallet System**: Manage in-app currency (coins), with placeholders for JazzCash deposit/withdrawal.
- **User Dashboard**: A central hub for navigation and user information.
- **Support System**: Users can create and view support tickets.
- **Admin Capabilities**: Hidden UI for admins to manage tournament details.
- **Mobile-First & Accessible**: Designed for a seamless experience on all devices.

## Setup Instructions

### 1. Firebase Project Setup

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Add a Web App**: In your project dashboard, click the "</>" icon to add a new web app.
3.  **Copy Firebase Config**: After registering the app, Firebase will provide you with a configuration object. Copy this object.
4.  **Paste Config**: Open `/js/firebase-config.js` and paste your copied configuration into the `firebaseConfig` object.

    ```javascript
    // js/firebase-config.js
    export const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      // ... paste the rest of your config here
    };
    ```

### 2. Enable Firebase Services

1.  **Authentication**:
    *   In the Firebase Console, navigate to **Authentication** -> **Sign-in method**.
    *   Enable **Email/Password**.
    *   Enable **Google** and provide a project support email.

2.  **Firestore Database**:
    *   Navigate to **Firestore Database** -> **Create database**.
    *   Start in **production mode**.
    *   Choose a location close to your users (e.g., an Asian region).

3.  **App Check**:
    *   (Recommended for production) Go to **App Check**.
    *   Register your web app and enable enforcement for Firestore and Authentication to prevent abuse.

### 3. Firestore Security Rules

For security, paste the following rules into **Firestore Database** -> **Rules**. These rules ensure users can only modify their own data and that coin balances are protected.
rules_version = '2';
service cloud.firestore {
match /databases/{database}/documents {
// Users can read/write their own document, but cannot change their coins or admin status
match /users/{userId} {
allow read, update, delete: if request.auth.uid == userId;
allow create: if request.auth.uid == userId && request.resource.data.coins == 0 && request.resource.data.isAdmin == false;
// Prevent users from updating their own coins or admin status
allow update: if request.auth.uid == userId && request.resource.data.coins == resource.data.coins && request.resource.data.isAdmin == resource.data.isAdmin;
}

// Tournaments can be read by anyone, but only edited by an admin
match /tournaments/{tourneyId} {
  allow read;
  allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
}

// Participants can be added by any logged-in user, but only they can delete their own entry
match /tournaments/{tourneyId}/participants/{userId} {
  allow read;
  allow create: if request.auth.uid == userId;
  allow delete: if request.auth.uid == userId;
}

// Users can only create tickets for themselves
match /supportTickets/{ticketId} {
  allow read: if request.auth.uid == resource.data.userId;
  allow create: if request.auth.uid == request.resource.data.userId;
}

// Withdrawal requests can only be created by the user
match /withdrawals/{withdrawalId} {
    allow create: if request.auth.uid == request.resource.data.userId;
    allow read: if request.auth.uid == resource.data.userId;
}
}
}

### 4. Local Testing with Firebase Emulators

1.  **Install Firebase CLI**: If you don't have it, install it: `npm install -g firebase-tools`.
2.  **Login**: `firebase login`.
3.  **Initialize Emulators**: In your project root, run `firebase init emulators`. Select Authentication and Firestore.
4.  **Start Emulators**: Run `firebase emulators:start`. The app will now connect to the local emulators instead of production Firebase, allowing for safe testing.

### 5. JazzCash Integration (Production)

This app is client-side only. **For security, all JazzCash API calls must be made from a trusted server environment (like a Cloud Function).** The client should never handle your secret keys.

**The Flow:**
1.  **Get a Merchant Account**: Sign up for a JazzCash Merchant Account to get your Merchant ID, Password, and Integrity Salt.
2.  **Create a Cloud Function**: Set up a Firebase Cloud Function (e.g., `createJazzCashPayment`).
3.  **Client Request**: The user clicks "Deposit" in the app. The client calls your Cloud Function with the desired amount.
4.  **Backend Logic (Cloud Function)**:
    *   The function receives the amount and the `userId`.
    *   It constructs a payment request object.
    *   It generates a secure hash (HMAC-SHA256) of the payment details using your **Integrity Salt**.
    *   It returns the payment URL and parameters to the client.
5.  **Client Redirect**: The client redirects the user to the JazzCash Payment Gateway.
6.  **Backend Verification (Webhook)**:
    *   Set up another Cloud Function as a webhook (e.g., `verifyJazzCashPayment`).
    *   After the user completes the payment, JazzCash sends a POST request to your webhook URL.
    *   Your webhook verifies the integrity of the incoming data from JazzCash.
    *   If verified, it securely updates the user's `coins` in their Firestore document using the Firebase Admin SDK. **This is the ONLY way coins should be added.**

### 6. Setting an Admin User

There is no UI for this to prevent abuse. To make a user an admin:

1.  Find the user's `uid` in the Firebase Authentication console.
2.  Go to the Firestore Database.
3.  Navigate to the `users` collection and open the document with the matching `uid`.
4.  Manually change the `isAdmin` field from `false` to `true`.

The user will see admin controls on their next session.