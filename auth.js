// js/auth.js

// This module handles all user authentication logic:
// - Displaying login/signup forms
// - Handling user registration with Email/Password
// - Handling user login with Email/Password and Google
// - Managing user sessions and logout
// - Password reset functionality

import { showToast } from './app.js';

// Renders the initial authentication form (login view by default)
export function renderAuthForm(appRoot) {
    appRoot.innerHTML = `
        <div class="auth-container">
            <div id="auth-content">
                <!-- Login form will be injected here by default -->
            </div>
        </div>
    `;
    renderLoginForm();
}

// Renders the login form inside the auth container
function renderLoginForm() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
        <h2>Login to Your Account</h2>
        <p>Welcome back! Please enter your details.</p>
        <form id="login-form">
            <div class="form-group">
                <label for="login-email">Email</label>
                <input type="email" id="login-email" class="form-control" required autocomplete="email">
            </div>
            <div class="form-group">
                <label for="login-password">Password</label>
                <div class="password-wrapper">
                    <input type="password" id="login-password" class="form-control" required autocomplete="current-password">
                    <button type="button" class="password-toggle" onclick="togglePasswordVisibility('login-password')">👁️</button>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Login</button>
        </form>
        <button id="google-signin-btn" class="btn btn-google">
            <img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Google logo">
            Sign in with Google
        </button>
        <p style="text-align:center; margin-top:1rem;">
            <a href="#" id="forgot-password-link">Forgot Password?</a> | 
            Don't have an account? <a href="#" id="show-signup-link">Sign Up</a>
        </p>
    `;
    attachLoginListeners();
}

// Renders the sign-up form
function renderSignupForm() {
    const authContent = document.getElementById('auth-content');
    authContent.innerHTML = `
        <h2>Create an Account</h2>
        <p>Join the competition! It's quick and easy.</p>
        <form id="signup-form">
            <div class="form-group">
                <label for="signup-name">Full Name</label>
                <input type="text" id="signup-name" class="form-control" required autocomplete="name">
            </div>
            <div class="form-group">
                <label for="signup-email">Email</label>
                <input type="email" id="signup-email" class="form-control" required autocomplete="email">
            </div>
            <div class="form-group">
                <label for="signup-password">Password (min. 8 characters)</label>
                 <div class="password-wrapper">
                    <input type="password" id="signup-password" class="form-control" required minlength="8" autocomplete="new-password">
                    <button type="button" class="password-toggle" onclick="togglePasswordVisibility('signup-password')">👁️</button>
                </div>
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;">Create Account</button>
        </form>
        <p style="text-align:center; margin-top:1rem;">
            Already have an account? <a href="#" id="show-login-link">Login</a>
        </p>
    `;
    attachSignupListeners();
}

// Attaches event listeners for the login form
function attachLoginListeners() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('google-signin-btn').addEventListener('click', handleGoogleSignIn);
    document.getElementById('show-signup-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderSignupForm();
    });
    document.getElementById('forgot-password-link').addEventListener('click', handleForgotPassword);
}

// Attaches event listeners for the signup form
function attachSignupListeners() {
    document.getElementById('signup-form').addEventListener('submit', handleSignup);
    document.getElementById('show-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        renderLoginForm();
    });
}


// --- AUTHENTICATION HANDLERS ---

// Handles the sign-up process
async function handleSignup(e) {
    e.preventDefault();
    const form = e.target;
    const name = form['signup-name'].value;
    const email = form['signup-email'].value;
    const password = form['signup-password'].value;
    const button = form.querySelector('button[type="submit"]');

    setButtonLoading(button, true);

    try {
        // 1. Create user in Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // 2. Update user profile in Firebase Auth
        await user.updateProfile({ displayName: name });

        // 3. Create user document in Firestore
        // This is where we store additional app-specific data
        await firebase.firestore().collection('users').doc(user.uid).set({
            displayName: name,
            email: email,
            coins: 0, // All new users start with 0 coins
            isAdmin: false, // Default user role
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Account created successfully! Welcome!', 'success');
        // The onAuthStateChanged listener in app.js will handle the UI update
    } catch (error) {
        console.error("Signup Error:", error);
        showToast(error.message, 'error');
        setButtonLoading(button, false);
    }
}

// Handles the email/password login process
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const email = form['login-email'].value;
    const password = form['login-password'].value;
    const button = form.querySelector('button[type="submit"]');

    setButtonLoading(button, true);

    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        showToast('Logged in successfully!', 'success');
        // The onAuthStateChanged listener in app.js will handle the UI update
    } catch (error) {
        console.error("Login Error:", error);
        showToast(error.message, 'error');
        setButtonLoading(button, false);
    }
}

// Handles the Google Sign-In process
async function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const button = document.getElementById('google-signin-btn');
    setButtonLoading(button, true, true);

    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const user = result.user;

        // Check if this is a new user
        const userDocRef = firebase.firestore().collection('users').doc(user.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            // If it's a new user, create their document in Firestore
            await userDocRef.set({
                displayName: user.displayName,
                email: user.email,
                coins: 0,
                isAdmin: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Account created successfully with Google!', 'success');
        } else {
            showToast('Signed in with Google!', 'success');
        }
        // onAuthStateChanged will redirect
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        showToast(error.message, 'error');
        setButtonLoading(button, false, true);
    }
}

// Handles the "Forgot Password" functionality
async function handleForgotPassword(e) {
    e.preventDefault();
    const email = prompt("Please enter your email address to receive a password reset link:");
    if (email) {
        try {
            await firebase.auth().sendPasswordResetEmail(email);
            showToast('Password reset link sent! Check your email.', 'success');
        } catch (error) {
            console.error("Password Reset Error:", error);
            showToast(error.message, 'error');
        }
    }
}

// --- UTILITY FUNCTIONS ---

// Toggles password visibility in an input field
window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁️";
    }
}

// Utility to disable a button and show a spinner
function setButtonLoading(button, isLoading, isGoogle = false) {
    if (isLoading) {
        button.disabled = true;
        if (isGoogle) {
             button.innerHTML = '<div class="spinner"></div> Signing In...';
        } else {
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<div class="spinner"></div>';
        }
    } else {
        button.disabled = false;
        if (isGoogle) {
             button.innerHTML = `<img src="https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png" alt="Google logo"> Sign in with Google`;
        } else {
            button.innerHTML = button.dataset.originalText;
        }
    }
}