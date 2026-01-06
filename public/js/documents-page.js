// public/js/documents-page.js
import { auth, db, storage } from "./firebase-common.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const authInfoEl = document.getElementById("auth-info");
const logoutBtn = document.getElementById("logout-btn");
const roleBadgeContainer = document.getElementById("role-badge-container");
const adminOnlyEls = document.getElementsByClassName("admin-only");

const docsList = document.getElementById("docs-list");
const docsEmptyEl = document.getElementById("docs-empty");

const addDocForm = document.getElementById("add-doc-form");
const docTitleInput = document.getElementById("doc-title");
const docUrlInput = document.getElementById("doc-url");
const docDescInput = document.getElementById("doc-desc");

const uploadDropzone = document.getElementById("upload-dropzone");
const uploadFileInput = document.getElementById("upload-file-input");
const uploadStatusEl = document.getElementById("upload-status");

let currentUser = null;
let currentIsAdmin = false;

function updateAdminUI() {
  for (let i = 0; i < adminOnlyEls.length; i++) {
    adminOnlyEls[i].style.display = currentIsAdmin ? "block" : "none";
  }
  if (currentUser) {
    authInfoEl.textContent = `Signed in as ${currentUser.email}`;
    roleBadgeContainer.innerHTML = `
      <span class="badge ${currentIsAdmin ? "admin" : ""}">
        ${currentIsAdmin ? "Admin" : "Viewer"}
      </span>`;
  }
}

async function handleAuth(user) {
  if (!user) {
    window.location.href = "/";
    return;
  }

  const infoRef = doc(db, "accountInfo", user.uid);
  const infoSnap = await getDoc(infoRef);

  if (!infoSnap.exists()) {
    window.location.href = "/under-review/";
    return;
  }

  const data = infoSnap.data();
  const role = data.authRole;

  if (role !== "admin" && role !== "viewer") {
    window.location.href = "/under-review/";
    return;
  }

  currentUser = user;
  currentIsAdmin = role === "admin";
  updateAdminUI();
  pageSpecificInit();
}

onAuthStateChanged(auth, handleAuth);

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/";
  });
}

function setUploadStatus(text, color = "#6b7280") {
  if (!uploadStatusEl) return;
  uploadStatusEl.textContent = text;
  uploadStatusEl.style.color = color;
  console.log("UPLOAD STATUS:", text);
}

async function uploadFileToStorage(file) {
  if (!file) return;

  const maxSizeBytes = 20 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    setUploadStatus("File too large (max 20 MB).", "#b91c1c");
    return;
  }

  try {
    setUploadStatus(`Uploading "${file.name}"...`);

    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
    const storageRef = ref(storage, `documents/${timestamp}_${cleanName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadStatus(`Uploading... ${progress.toFixed(0)}%`);
      },
      (error) => {
        console.error("UPLOAD ERROR:", error);
        setUploadStatus("Upload failed: " + error.message, "#b91c1c");
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadStatus(
            "Upload complete. Saving document record...",
            "#166534"
          );

          // Change "troopDocuments" here if you want a different collection name
          await addDoc(collection(db, "troopDocuments"), {
            title: file.name,
            url: downloadURL,
            description: "",
            createdAt: serverTimestamp(),
            uploadedBy: currentUser ? currentUser.uid : null
          });

          setUploadStatus("Document saved and added to list.", "#166534");
        } catch (err) {
          console.error("FIRESTORE SAVE ERROR:", err);
          setUploadStatus(
            "Saved to Storage but Firestore failed: " + err.message,
            "#b91c1c"
          );
        }
      }
    );
  } catch (err) {
    console.error("UPLOAD OUTER ERROR:", err);
    setUploadStatus("Upload error: " + err.message, "#b91c1c");
  }
}

function renderDocs(docs) {
  docsList.innerHTML = "";
  if (docs.length === 0) {
    docsEmptyEl.style.display = "block";
    return;
  }
  docsEmptyEl.style.display = "none";

  docs.forEach((snap) => {
    const data = snap.data();
    const li = document.createElement("li");
    li.className = "doc-item";

    const title = data.title || "Untitled Document";
    const url = data.url || "#";
    const desc = data.description || "";
    const createdAt = data.createdAt
      ? data.createdAt.toDate().toLocaleString()
      : "";

    li.innerHTML = `
      <div class="doc-title">${title}</div>
      <div><a href="${url}" target="_blank" rel="noopener noreferrer" class="doc-link">${url}</a></div>
      <div class="doc-meta">
        ${desc ? desc + " • " : ""}${createdAt ? "Added " + createdAt : ""}
      </div>
    `;

    if (currentIsAdmin) {
      const btn = document.createElement("button");
      btn.textContent = "Delete";
      btn.className = "small-btn";
      btn.onclick = async () => {
        if (confirm("Delete this document?")) {
          await deleteDoc(doc(db, "troopDocuments", snap.id));
        }
      };
      li.appendChild(btn);
    }

    docsList.appendChild(li);
  });
}

function pageSpecificInit() {
  // Live docs list
  const q = query(
    collection(db, "troopDocuments"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    renderDocs(snapshot.docs);
  });

  // Add doc by URL
  if (currentIsAdmin && addDocForm) {
    addDocForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = docTitleInput.value.trim();
      const url = docUrlInput.value.trim();
      const desc = docDescInput.value.trim();

      if (!title || !url) {
        alert("Please fill out title and URL.");
        return;
      }

      await addDoc(collection(db, "troopDocuments"), {
        title,
        url,
        description: desc,
        createdAt: serverTimestamp(),
        uploadedBy: currentUser ? currentUser.uid : null
      });

      docTitleInput.value = "";
      docUrlInput.value = "";
      docDescInput.value = "";
    });
  }

  // Drag & drop upload
  if (currentIsAdmin && uploadDropzone && uploadFileInput) {
    uploadDropzone.addEventListener("click", () => {
      uploadFileInput.click();
    });

    uploadFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) uploadFileToStorage(file);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.style.background = "#eef2ff";
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadDropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadDropzone.style.background = "#f9fafb";
      });
    });

    uploadDropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        uploadFileToStorage(file);
      }
    });
  }
}
