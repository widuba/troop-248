<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
  import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

  // ✅ your config here
  const firebaseConfig = {
    apiKey: "AIzaSyD5qUHa2JuQ3iI7U3DrX7JDyhx76PGzhxM",
  authDomain: "troop-248.firebaseapp.com",
  projectId: "troop-248",
  storageBucket: "troop-248.firebasestorage.app",
  messagingSenderId: "925363875752",
  appId: "1:925363875752:web:0b001c1a7a09fb8232f79d",
  measurementId: "G-NY75GX5TBH"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // 🔐 admin UIDs
  export const ADMIN_UIDS = [
    "l1TlAvSdW0hpZUPU5eA0XBWD2OA3"
  ];

  export let currentUser = null;
  export let currentIsAdmin = false;

  export function gatePage() {
    const overlay = document.getElementById("auth-overlay");
    const appShell = document.getElementById("app-shell");
    const authInfo = document.getElementById("auth-info");
    const roleBadge = document.getElementById("role-badge-container");
    const adminEls = document.getElementsByClassName("admin-only");

    function render() {
      for (let el of adminEls) {
        el.style.display = currentIsAdmin ? "block" : "none";
      }

      if (currentUser) {
        overlay.style.display = "none";
        appShell.style.display = "block";

        authInfo.textContent = `Signed in as ${currentUser.email}`;
        roleBadge.innerHTML = `
          <span class="badge ${currentIsAdmin ? "admin" : ""}">
            ${currentIsAdmin ? "Admin" : "Viewer"}
          </span>`;
      } else {
        overlay.style.display = "flex";
        appShell.style.display = "none";
      }
    }

    onAuthStateChanged(auth, async user => {
      currentUser = user;
      currentIsAdmin = !!(user && ADMIN_UIDS.includes(user.uid));
      render();
    });

    document.getElementById("login-btn").onclick = async () => {
      const email = document.getElementById("email-input").value.trim();
      const pass = document.getElementById("password-input").value.trim();
      if (!email || !pass) return alert("Enter email + password");
      await signInWithEmailAndPassword(auth, email, pass);
    };

    document.getElementById("signup-btn").onclick = async () => {
      const email = document.getElementById("email-input").value.trim();
      const pass = document.getElementById("password-input").value.trim();
      await createUserWithEmailAndPassword(auth, email, pass);
      alert("Account created — viewer by default.");
    };

    document.getElementById("logout-btn").onclick = async () => {
      await signOut(auth);
    };
  }
</script>
