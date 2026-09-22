/* ==========================================================================
   AUTH.JS
   --------------------------------------------------------------------------
   Handles: role lookup after sign-in, page guarding (redirect to login if
   not authenticated or wrong role), idle auto-logout, and the shared
   logout button wiring used on pos/manager/reports pages.
   ========================================================================== */

const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes of no interaction -> auto logout
let idleTimer = null;
let currentUserRole = null;
let currentUserName = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    showToast("Signed out after being idle. Sign in again to continue.", "warning");
    auth.signOut().then(() => {
      window.location.href = pathToIndex();
    });
  }, IDLE_TIMEOUT_MS);
}

function startIdleWatch() {
  ["mousedown", "keydown", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

function pathToIndex() {
  // Pages live in /pages/, index.html lives one level up.
  return window.location.pathname.includes("/pages/") ? "../index.html" : "index.html";
}

/* Looks up the signed-in user's role from Firestore users/{uid}.
   Resolves to null if no matching doc (shouldn't normally happen since
   accounts are provisioned manually alongside their role doc). */
function fetchUserRole(uid) {
  return db
    .collection("users")
    .doc(uid)
    .get()
    .then((doc) => (doc.exists ? doc.data() : null));
}

/* Call at the top of pos.js / manager.js / reports.js.
   allowedRoles: array like ["seller","manager"] or ["manager"].
   Returns a Promise resolving with { uid, role, displayName } once
   confirmed, or redirects and never resolves (page unloads). */
function requireAuth(allowedRoles) {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = pathToIndex();
        return;
      }
      const profile = await fetchUserRole(user.uid);
      if (!profile || !allowedRoles.includes(profile.role)) {
        showToast("You don't have access to that page.", "danger");
        window.location.href = pathToIndex();
        return;
      }
      currentUserRole = profile.role;
      currentUserName = profile.displayName || (profile.role === "manager" ? "Main" : "Seller");

      // Populate the standard header chip if present on this page.
      const roleBadge = document.getElementById("roleBadge");
      const userName = document.getElementById("userName");
      if (roleBadge) {
        roleBadge.textContent = profile.role === "manager" ? "Manager" : "Seller";
        roleBadge.className = profile.role === "manager" ? "badge badge-manager" : "badge badge-seller";
      }
      if (userName) userName.textContent = currentUserName;

      // Show/hide manager-only nav links.
      document.querySelectorAll(".manager-only").forEach((el) => {
        el.classList.toggle("hidden", profile.role !== "manager");
      });

      startIdleWatch();
      loadAndApplyLogo();
      wireLogoutButton();

      resolve({ uid: user.uid, role: profile.role, displayName: currentUserName });
    });
  });
}

function wireLogoutButton() {
  const btn = document.getElementById("logoutBtn");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "true";
  btn.addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = pathToIndex();
    });
  });
}
