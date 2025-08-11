// js/wallet.js

// This module manages:
// - Displaying the user's wallet (coin balance)
// - Listing transaction history
// - The UI and logic for depositing funds (with JazzCash placeholders)
// - The UI and logic for withdrawing funds

import { showToast } from './app.js';

// Renders the main Deposit / Withdraw page
export async function renderDepositWithdrawPage(appRoot) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    appRoot.innerHTML = `
        <div class="content-section">
            <h2>Wallet & Transactions</h2>
            
            <!-- Deposit Section -->
            <div class="wallet-action-card">
                <h3>Deposit Coins</h3>
                <p>Add funds to your wallet to join tournaments. We partner with JazzCash for secure payments.</p>
                
                <!-- This is a placeholder for a real payment flow -->
                <div class="form-group">
                    <label for="deposit-amount">Amount (PKR)</label>
                    <input type="number" id="deposit-amount" class="form-control" placeholder="e.g., 500">
                </div>
                <button id="jazzcash-deposit-btn" class="btn btn-primary">Proceed to JazzCash</button>
                <hr style="margin: 1.5rem 0; border-color: var(--card-border);">
                <p>For testing purposes:</p>
                <button id="test-deposit-btn" class="btn btn-secondary">Add 1000 Test Coins</button>
            </div>

            <!-- Withdraw Section -->
            <div class="wallet-action-card">
                <h3>Withdraw Winnings</h3>
                <p>Withdraw your coins to your JazzCash account. Withdrawals are processed within 24-48 hours.</p>
                 <form id="withdraw-form">
                    <div class="form-group">
                        <label for="withdraw-amount">Amount (Coins)</label>
                        <input type="number" id="withdraw-amount" class="form-control" placeholder="e.g., 1000" required>
                    </div>
                     <div class="form-group">
                        <label for="jazzcash-number">JazzCash Mobile Number</label>
                        <input type="tel" id="jazzcash-number" class="form-control" placeholder="03xxxxxxxxx" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Request Withdrawal</button>
                </form>
                <small>Note: A small processing fee may apply. Ensure your account details are correct.</small>
            </div>

             <!-- Transaction History -->
            <div class="wallet-action-card">
                <h3>Transaction History</h3>
                <div id="transaction-history-list">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    attachWalletListeners();
    loadTransactionHistory();
}

// Attaches event listeners for wallet actions
function attachWalletListeners() {
    // Demo button to add test coins
    document.getElementById('test-deposit-btn').addEventListener('click', handleTestDeposit);
    
    // Placeholder for real JazzCash integration
    document.getElementById('jazzcash-deposit-btn').addEventListener('click', handleJazzCashDeposit);

    // Withdrawal form submission
    document.getElementById('withdraw-form').addEventListener('submit', handleWithdrawRequest);
}

// Loads and displays the user's transaction history
async function loadTransactionHistory() {
    const user = firebase.auth().currentUser;
    const listElement = document.getElementById('transaction-history-list');
    
    try {
        const querySnapshot = await firebase.firestore()
            .collection('users').doc(user.uid).collection('transactions')
            .orderBy('timestamp', 'desc').limit(20).get();

        if (querySnapshot.empty) {
            listElement.innerHTML = `<p>No recent transactions found.</p>`;
            return;
        }

        listElement.innerHTML = `
            <ul style="list-style: none;">
                ${querySnapshot.docs.map(doc => {
                    const tx = doc.data();
                    const date = tx.timestamp ? new Date(tx.timestamp.seconds * 1000).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }) : 'N/A';
                    const amountClass = tx.amount > 0 ? 'success-text' : 'error-text';
                    return `
                        <li style="border-bottom: 1px solid var(--card-border); padding: 0.5rem 0;">
                            <strong>${tx.type.replace('_', ' ').toUpperCase()}</strong>: 
                            <span class="${amountClass}">${tx.amount} coins</span> - 
                            <small>${date}</small>
                            <p>${tx.details || ''}</p>
                        </li>
                    `;
                }).join('')}
            </ul>
        `;
    } catch (error) {
        console.error("Error loading transaction history:", error);
        listElement.innerHTML = `<p style="color: var(--error-color);">Could not load transaction history.</p>`;
    }
}

// --- DEPOSIT & WITHDRAWAL HANDLERS ---

// Simulates a deposit for testing purposes by directly adding coins in Firestore
async function handleTestDeposit() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const amountToAdd = 1000;
    const userDocRef = firebase.firestore().collection('users').doc(user.uid);

    try {
        // Use a transaction for safety, even in testing
        await firebase.firestore().runTransaction(async (transaction) => {
            transaction.update(userDocRef, {
                coins: firebase.firestore.FieldValue.increment(amountToAdd)
            });
            const txRef = userDocRef.collection('transactions').doc();
             transaction.set(txRef, {
                type: 'deposit_test',
                amount: amountToAdd,
                details: 'Test coins added for demonstration',
                status: 'completed',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        showToast(`${amountToAdd} test coins added!`, 'success');
        window.renderWallet(); // Function exposed globally from app.js to refresh header
        loadTransactionHistory();

    } catch (error) {
        console.error("Test deposit failed:", error);
        showToast('Could not add test coins.', 'error');
    }
}

// Placeholder function for initiating the real JazzCash payment flow
function handleJazzCashDeposit() {
    const amount = document.getElementById('deposit-amount').value;
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount.', 'error');
        return;
    }

    showToast('Redirecting to JazzCash...', 'success');

    // --- PRODUCTION JAZZCASH INTEGRATION ---
    // 1. Client sends a request to your secure backend (e.g., a Cloud Function).
    //    NEVER handle API keys or secrets on the client.
    //
    //    Example API call:
    //    fetch('https://your-cloud-function-url/createJazzCashPayment', {
    //        method: 'POST',
    //        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}` },
    //        body: JSON.stringify({ amount: amount })
    //    })
    //    .then(res => res.json())
    //    .then(data => {
    //        // 2. The backend returns a redirect URL for the JazzCash gateway.
    //        //    The client then redirects the user to this URL.
    //        window.location.href = data.jazzCashRedirectUrl;
    //    })
    //    .catch(err => {
    //        console.error("JazzCash initiation error:", err);
    //        showToast('Could not connect to payment service.', 'error');
    //    });
    //
    // 3. After payment, JazzCash calls your backend webhook to confirm.
    // 4. Your webhook verifies the payment and securely updates the user's `coins` in Firestore.
    
    alert(`PRODUCTION FLOW:\n1. Call backend with amount: ${amount} PKR.\n2. Backend creates JazzCash request and returns URL.\n3. Redirect user to JazzCash.\n4. Backend webhook verifies payment & adds coins.`);
}

// Handles the withdrawal request form
async function handleWithdrawRequest(e) {
    e.preventDefault();
    const form = e.target;
    const amount = parseInt(form['withdraw-amount'].value, 10);
    const jazzCashNumber = form['jazzcash-number'].value;
    const button = form.querySelector('button[type="submit"]');

    const user = firebase.auth().currentUser;
    if (!user) return;
    
    setButtonLoading(button, true);

    const userDocRef = firebase.firestore().collection('users').doc(user.uid);

    try {
        await firebase.firestore().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) throw "User not found.";
            
            const currentCoins = userDoc.data().coins;
            if (amount <= 0) throw "Invalid withdrawal amount.";
            if (currentCoins < amount) throw "Insufficient coins for withdrawal.";

            // 1. Deduct coins immediately to prevent double-spending
            const newBalance = currentCoins - amount;
            transaction.update(userDocRef, { coins: newBalance });

            // 2. Create a withdrawal request document for admin approval
            const withdrawalRef = firebase.firestore().collection('withdrawals').doc();
            transaction.set(withdrawalRef, {
                userId: user.uid,
                amount: amount,
                contactInfo: jazzCashNumber, // For JazzCash transfer
                status: 'pending', // Admins will review and change this to 'completed'
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. Add a transaction record for the user
            const txRef = userDocRef.collection('transactions').doc();
            transaction.set(txRef, {
                type: 'withdrawal_request',
                amount: -amount,
                details: `Withdrawal to ${jazzCashNumber}`,
                status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showToast('Withdrawal request submitted! It will be processed shortly.', 'success');
        form.reset();
        window.renderWallet(); // Refresh header
        loadTransactionHistory();

    } catch (error) {
        console.error("Withdrawal request failed:", error);
        showToast(typeof error === 'string' ? error : "Withdrawal request failed.", 'error');
        // IMPORTANT: In a real app, you'd need a robust rollback system if coins were deducted
        // but the request failed to be created. Transactions handle this automatically.
    } finally {
        setButtonLoading(button, false);
    }
}

// Utility to disable button and show spinner
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px;"></div>';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText;
    }
}