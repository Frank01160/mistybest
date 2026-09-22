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
}/* One-shot flag so repeated calls don't stack document listeners. */
let _idleWatchStarted = false;

function startIdleWatch() {
  if (_idleWatchStarted) return;
  _idleWatchStarted = true;
  ["mousedown", "keydown", "touchstart", "scroll"].forEach((evt) => {
    document.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

function requireAuth(allowedRoles) {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      // One-shot: detach immediately so reload cycles can't stack listeners.
      unsub();

      if (!user) {
        window.location.href = pathToIndex();
        return;
      }

      let profile = null;
      try {
        profile = await fetchUserRole(user.uid);
      } catch (err) {
        // DO NOT redirect on a read error — that turns a transient failure
        // into an infinite redirect loop with index.js's auto-redirect.
        console.error("[auth] role lookup failed:", err);
        showToast("Couldn't verify your account. Check your connection and reload.", "danger");
        return;
      }

      // Normalise: trim whitespace + lowercase, so "Manager" / " manager"
      // / "manager " all match ["seller","manager"].
      const role = profile && profile.role
        ? String(profile.role).trim().toLowerCase()
        : "";

      if (!profile || !allowedRoles.includes(role)) {
        console.warn("[auth] access denied. profile =", profile, " role =", JSON.stringify(role), " allowed =", allowedRoles);
        showToast("You don't have access to that page.", "danger");

        // Sign out FIRST so index.js's onAuthStateChanged sees user === null
        // and does NOT bounce the user straight back to POS.
        auth.signOut().then(() => {
          window.location.href = pathToIndex();
        });
        return;
      }

      currentUserRole = role;
      currentUserName = profile.displayName || (role === "manager" ? "Main" : "Seller");

      const roleBadge = document.getElementById("roleBadge");
      const userName = document.getElementById("userName");
      if (roleBadge) {
        roleBadge.textContent = role === "manager" ? "Manager" : "Seller";
        roleBadge.className = role === "manager" ? "badge badge-manager" : "badge badge-seller";
      }
      if (userName) userName.textContent = currentUserName;

      document.querySelectorAll(".manager-only").forEach((el) => {
        el.classList.toggle("hidden", role !== "manager");
      });

      startIdleWatch();
      loadAndApplyLogo();
      wireLogoutButton();

      resolve({ uid: user.uid, role: role, displayName: currentUserName });
    });
  });
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
