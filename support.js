// js/support.js

// This module handles the customer support section:
// - A form for users to submit support tickets
// - Logic to save tickets to the 'supportTickets' collection in Firestore
// - A view for users to see their past ticket history and status

import { showToast } from './app.js';

// Renders the main customer support page
export async function renderSupportPage(appRoot) {
    appRoot.innerHTML = `
        <div class="content-section">
            <h2>Customer Support</h2>
            
            <!-- Ticket Submission Form -->
            <div class="support-card">
                <h3>Submit a New Ticket</h3>
                <p>Have an issue with a payment, tournament, or your account? Let us know.</p>
                <form id="support-ticket-form">
                    <div class="form-group">
                        <label for="ticket-subject">Subject</label>
                        <input type="text" id="ticket-subject" class="form-control" required placeholder="e.g., Issue with deposit">
                    </div>
                    <div class="form-group">
                        <label for="ticket-message">Message</label>
                        <textarea id="ticket-message" class="form-control" rows="5" required placeholder="Please describe your issue in detail..."></textarea>
                    </div>
                    <!-- File input is a placeholder; real implementation requires Firebase Storage -->
                    <div class="form-group">
                        <label for="ticket-file">Attach a File (Optional)</label>
                        <input type="file" id="ticket-file" class="form-control">
                        <small>File uploads require Firebase Storage setup.</small>
                    </div>
                    <button type="submit" class="btn btn-primary">Submit Ticket</button>
                </form>
            </div>

            <!-- Ticket History -->
            <div class="support-card">
                <h3>Your Ticket History</h3>
                <div id="ticket-history-list">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('support-ticket-form').addEventListener('submit', handleTicketSubmit);
    loadTicketHistory();
}

// Handles the submission of a new support ticket
async function handleTicketSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const subject = form['ticket-subject'].value;
    const message = form['ticket-message'].value;
    const button = form.querySelector('button[type="submit"]');
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('You must be logged in to submit a ticket.', 'error');
        return;
    }

    setButtonLoading(button, true);

    try {
        await firebase.firestore().collection('supportTickets').add({
            userId: user.uid,
            userEmail: user.email,
            subject: subject,
            message: message,
            status: 'open', // Default status for a new ticket
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            // fileUrl: '...' // This would be populated after a file upload to Firebase Storage
        });

        showToast('Support ticket submitted successfully!', 'success');
        form.reset();
        loadTicketHistory(); // Refresh the ticket list

    } catch (error) {
        console.error("Error submitting ticket:", error);
        showToast('Failed to submit ticket. Please try again.', 'error');
    } finally {
        setButtonLoading(button, false);
    }
}

// Loads and displays the user's past support tickets
async function loadTicketHistory() {
    const user = firebase.auth().currentUser;
    const listElement = document.getElementById('ticket-history-list');
    
    if (!user) {
        listElement.innerHTML = `<p>Please log in to see your ticket history.</p>`;
        return;
    }
    
    try {
        const querySnapshot = await firebase.firestore()
            .collection('supportTickets')
            .where('userId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .get();

        if (querySnapshot.empty) {
            listElement.innerHTML = `<p>You have not submitted any support tickets.</p>`;
            return;
        }

        listElement.innerHTML = querySnapshot.docs.map(doc => {
            const ticket = doc.data();
            const date = new Date(ticket.createdAt.seconds * 1000).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
            return `
                <div class="ticket-item">
                    <p><strong>Subject:</strong> ${ticket.subject}</p>
                    <p><strong>Status:</strong> <span class="status-${ticket.status}">${ticket.status}</span></p>
                    <p><small>Submitted on: ${date}</small></p>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading ticket history:", error);
        listElement.innerHTML = `<p style="color: var(--error-color);">Could not load your tickets.</p>`;
    }
}

// --- UTILITY FUNCTIONS ---

// Utility to disable a button and show a spinner
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