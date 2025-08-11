// js/tournaments.js

// This module handles:
// - Fetching and displaying all available tournaments
// - Searching and filtering tournaments
// - The user flow for joining a tournament (including wallet checks and Firestore transactions)
// - Displaying tournaments the user has joined ("My Tournaments")
// - The logic for canceling a tournament registration

import { showToast, renderWallet } from './app.js';

let allTournaments = []; // Cache for tournaments to enable client-side search

// Renders the main "View Tournaments" page
export async function renderViewTournaments(appRoot) {
    appRoot.innerHTML = `
        <div class="content-section">
            <h2>Upcoming Tournaments</h2>
            <div class="form-group">
                <input type="search" id="tournament-search" class="form-control" placeholder="Search by name or game type...">
            </div>
            <div id="tournament-list" class="tournament-list">
                <div class="spinner"></div>
            </div>
        </div>
    `;

    document.getElementById('tournament-search').addEventListener('input', debounce(filterTournaments, 300));
    
    try {
        const querySnapshot = await firebase.firestore().collection('tournaments').orderBy('date').get();
        allTournaments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayTournaments(allTournaments);
    } catch (error) {
        console.error("Error fetching tournaments: ", error);
        document.getElementById('tournament-list').innerHTML = `<p style="color: var(--error-color);">Could not fetch tournaments. Please try again later.</p>`;
        showToast('Failed to load tournaments.', 'error');
    }
}

// Displays a list of tournament cards in the UI
function displayTournaments(tournaments) {
    const listElement = document.getElementById('tournament-list');
    if (tournaments.length === 0) {
        listElement.innerHTML = `<p>No tournaments found. Check back later!</p>`;
        return;
    }

    listElement.innerHTML = tournaments.map(t => `
        <div class="tournament-card">
            <h3>${t.name}</h3>
            <p><strong>Game:</strong> ${t.gameType}</p>
            <p><strong>Date:</strong> ${new Date(t.date.seconds * 1000).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
            <p><strong>Location:</strong> ${t.location}</p>
            <p><strong>Entry Fee:</strong> ${t.entryFee} Coins</p>
            <details>
                <summary>Rules & Details</summary>
                <p>${t.rules || 'No specific rules provided.'}</p>
            </details>
            <button class="btn btn-primary" onclick="window.joinTournament('${t.id}')">Join Now</button>
        </div>
    `).join('');
}

// Debounced search filter
function filterTournaments(event) {
    const searchTerm = event.target.value.toLowerCase();
    const filtered = allTournaments.filter(t => 
        t.name.toLowerCase().includes(searchTerm) || 
        t.gameType.toLowerCase().includes(searchTerm)
    );
    displayTournaments(filtered);
}

// Renders the "My Tournaments" page
export async function renderMyTournaments(appRoot) {
     appRoot.innerHTML = `
        <div class="content-section">
            <h2>My Registered Tournaments</h2>
            <div id="my-tournaments-list" class="tournament-list">
                <div class="spinner"></div>
            </div>
        </div>
    `;
    
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        // Query the 'participants' subcollections across all tournaments for the current user
        const participantsSnapshot = await firebase.firestore().collectionGroup('participants').where('userId', '==', user.uid).get();
        
        if (participantsSnapshot.empty) {
            document.getElementById('my-tournaments-list').innerHTML = `<p>You haven't joined any tournaments yet. <a href="#" onclick="window.renderViewTournaments(document.getElementById('app-root'))">Find one to join!</a></p>`;
            return;
        }

        const tournamentPromises = participantsSnapshot.docs.map(doc => doc.ref.parent.parent.get());
        const tournamentDocs = await Promise.all(tournamentPromises);
        
        const myTournaments = tournamentDocs.map(doc => ({ id: doc.id, ...doc.data() }));

        document.getElementById('my-tournaments-list').innerHTML = myTournaments.map(t => `
            <div class="tournament-card">
                <h3>${t.name}</h3>
                <p><strong>Game:</strong> ${t.gameType}</p>
                <p><strong>Date:</strong> ${new Date(t.date.seconds * 1000).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
                <button class="btn btn-secondary" onclick="window.cancelRegistration('${t.id}', ${t.entryFee})">Cancel Registration</button>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error fetching my tournaments:", error);
        document.getElementById('my-tournaments-list').innerHTML = `<p style="color: var(--error-color);">Could not fetch your tournaments.</p>`;
    }
}


// --- JOIN AND CANCEL LOGIC ---

// Initiates the join tournament flow
window.joinTournament = async function(tournamentId) {
    const user = firebase.auth().currentUser;
    const tournament = allTournaments.find(t => t.id === tournamentId);

    if (!user || !tournament) {
        showToast('Could not find user or tournament data.', 'error');
        return;
    }
    
    const confirmation = confirm(`You are about to join "${tournament.name}". The entry fee is ${tournament.entryFee} coins. Continue?`);
    if (!confirmation) return;

    const userDocRef = firebase.firestore().collection('users').doc(user.uid);

    try {
        // Use a Firestore transaction to ensure atomicity
        await firebase.firestore().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) throw "User document does not exist!";
            
            const currentCoins = userDoc.data().coins;
            if (currentCoins < tournament.entryFee) {
                throw "Insufficient coins! Please top up your wallet.";
            }

            // 1. Deduct coins from user's wallet
            const newBalance = currentCoins - tournament.entryFee;
            transaction.update(userDocRef, { coins: newBalance });

            // 2. Add user to the tournament's participants subcollection
            const participantRef = firebase.firestore().collection('tournaments').doc(tournamentId).collection('participants').doc(user.uid);
            transaction.set(participantRef, {
                userId: user.uid,
                displayName: user.displayName,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 3. (Optional but good practice) Create a transaction record
            const txRef = userDocRef.collection('transactions').doc();
            transaction.set(txRef, {
                type: 'tournament_join',
                amount: -tournament.entryFee,
                details: `Entry fee for ${tournament.name}`,
                status: 'completed',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showToast(`Successfully joined ${tournament.name}!`, 'success');
        renderWallet(); // Refresh wallet display
        renderMyTournaments(document.getElementById('app-root')); // Navigate to my tournaments

    } catch (error) {
        console.error("Join tournament transaction failed: ", error);
        showToast(typeof error === 'string' ? error : "Failed to join tournament. Please try again.", 'error');
    }
}

// Cancels a user's registration and refunds the entry fee
window.cancelRegistration = async function(tournamentId, entryFee) {
     const user = firebase.auth().currentUser;
     const tournament = allTournaments.find(t => t.id === tournamentId) || { name: 'this tournament' };

    if (!user) return;

    const confirmation = confirm(`Are you sure you want to cancel your registration for ${tournament.name}? Your entry fee of ${entryFee} coins will be refunded.`);
    if (!confirmation) return;

    const userDocRef = firebase.firestore().collection('users').doc(user.uid);
    const participantRef = firebase.firestore().collection('tournaments').doc(tournamentId).collection('participants').doc(user.uid);

    try {
        // Use a transaction to ensure the refund and deletion are atomic
        await firebase.firestore().runTransaction(async (transaction) => {
            // 1. Add coins back to the user (refund)
            transaction.update(userDocRef, { 
                coins: firebase.firestore.FieldValue.increment(entryFee)
            });

            // 2. Remove the participant document
            transaction.delete(participantRef);

            // 3. Create a refund transaction record
             const txRef = userDocRef.collection('transactions').doc();
            transaction.set(txRef, {
                type: 'refund',
                amount: entryFee,
                details: `Refund for canceling registration for ${tournament.name}`,
                status: 'completed',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showToast('Registration canceled and fee refunded!', 'success');
        renderWallet(); // Refresh wallet balance
        renderMyTournaments(document.getElementById('app-root')); // Re-render the list

    } catch (error) {
        console.error("Cancel registration failed: ", error);
        showToast("Failed to cancel registration. Please contact support.", 'error');
    }
}


// --- UTILITIES ---

// Debounce function to limit the rate at which a function gets called
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}