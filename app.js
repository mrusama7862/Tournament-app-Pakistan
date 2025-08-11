// js/app.js

// This is the main application orchestrator. It handles:
// - Firebase initialization
// - Listening to authentication state changes (the core of the app's reactivity)
// - Rendering the appropriate view (Auth form or Dashboard)
// - Storing user data globally
// - Providing utility functions like toasts and navigation

import { firebaseConfig } from './firebase-config.js';
import { renderAuthForm } from './auth.js';
import { renderViewTournaments, renderMyTournaments } from './tournaments.js';
import { renderDepositWithdrawPage } from './wallet.js';
import { renderSupportPage } from './support.js';

// --- INITIALIZATION ---
// Initialize Firebase with the configuration from the dedicated file
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const appRoot = document.getElementById('app-root');

let currentUserData = null; // A global cache for the logged-in user's Firestore data

// --- AUTH STATE LISTENER ---
// This is the most important listener in the app. It fires whenever a user
// logs in or out, and is the central point for controlling the UI.
auth.onAuthStateChanged(async user => {
    if (user) {
        // User is signed in.
        // Fetch their profile from Firestore to get app-specific data like 'coins' and 'isAdmin'.
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            currentUserData = { uid: user.uid, ...userDoc.data() };
            renderDashboard(user);
        } else {
            // This case might happen if a user exists in Auth but not Firestore (e.g., data deletion).
            // We log them out to force a clean re-signup.
            console.error("User document not found in Firestore. Logging out.");
            auth.signOut();
        }
    } else {
        // User is signed out.
        currentUserData = null;
        renderAuthForm(appRoot);
    }
});

// --- UI RENDERING ---

// Renders the main user dashboard after a successful login
function renderDashboard(user) {
    appRoot.innerHTML = `
        <header class="main-header">
            <div class="user-info">
                <div class="user-avatar">${user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</div>
                <div>
                    <strong>Welcome, ${user.displayName || 'User'}!</strong>
                    <div id="wallet-balance-display" class="wallet-balance">Loading...</div>
                </div>
            </div>
            <button id="logout-btn" class="btn btn-secondary">Logout</button>
        </header>
        <nav class="main-nav">
            <ul>
                <li><button class="btn nav-btn" data-target="view-tournaments">View Tournaments</button></li>
                <li><button class="btn nav-btn" data-target="my-tournaments">My Tournaments</button></li>
                <li><button class="btn nav-btn" data-target="deposit-withdraw">Deposit / Withdraw</button></li>
                <li><button class="btn nav-btn" data-target="support">Customer Support</button></li>
            </ul>
        </nav>
        <div id="dashboard-content">
            <!-- Dynamic content will be loaded here -->
        </div>
    `;
    
    // Attach event listeners for the dashboard
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', handleNavigation);
    });

    // Initial actions on dashboard load
    renderWallet(); // Update wallet balance in the header
    renderViewTournaments(document.getElementById('dashboard-content')); // Show tournaments by default
}

// Handles navigation between different sections of the dashboard
function handleNavigation(event) {
    const target = event.target.dataset.target;
    const contentArea = document.getElementById('dashboard-content');
    
    // Simple router
    switch (target) {
        case 'view-tournaments':
            renderViewTournaments(contentArea);
            break;
        case 'my-tournaments':
            renderMyTournaments(contentArea);
            break;
        case 'deposit-withdraw':
            renderDepositWithdrawPage(contentArea);
            break;
        case 'support':
            renderSupportPage(contentArea);
            break;
        default:
            console.error('Unknown navigation target:', target);
    }
}

// Function to update the wallet balance in the header.
// It's exposed on the window object so other modules can call it after transactions.
export async function renderWallet() {
    const balanceDisplay = document.getElementById('wallet-balance-display');
    if (!balanceDisplay || !currentUserData) return;

    // Listen for realtime updates to the user's document
    db.collection('users').doc(currentUserData.uid).onSnapshot(doc => {
        if (doc.exists) {
            const userData = doc.data();
            currentUserData.coins = userData.coins; // Update global cache
            balanceDisplay.innerHTML = `💰 ${userData.coins} Coins`;
        }
    }, err => {
        console.error("Error listening to wallet updates:", err);
        balanceDisplay.innerHTML = `💰 Error`;
    });
}

// Make renderWallet globally accessible for updates from other modules
window.renderWallet = renderWallet;

// --- UTILITY FUNCTIONS ---

// Displays a toast/snackbar notification at the bottom of the screen.
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}