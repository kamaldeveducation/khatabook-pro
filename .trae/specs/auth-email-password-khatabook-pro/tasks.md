# tasks.md — Email/Password + Google Login for KhataBook Pro

Map: every Acceptance Criterion in `spec.md` → one or more implementation tasks below.

## Task 1: Add Firebase Auth imports for Email/Password & Forgot Password

**ACs covered:** AC2, AC3, AC4, AC5, AC6

**Description:**
In the existing `firebase/auth` import block at the top of `src/App.tsx` (lines 12-18), append the following named imports alongside the existing ones (no removals):

- `createUserWithEmailAndPassword`
- `signInWithEmailAndPassword`
- `sendPasswordResetEmail`
- `updateProfile`

Existing imports (`onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser`) must remain exactly as-is.

**Test Requirements:**
- TR 1.1 (rule): `from 'firebase/auth'` import statement contains all 9 names (the 5 existing + the 4 new).
  - Evidence: `grep -n "from 'firebase/auth'" src/App.tsx` lines.
- TR 1.2 (rule): `tsc --noEmit` passes after the imports are added (no unused-symbol errors).
  - Evidence: `npm run lint` exit 0.

**Dependencies:** none.
**Priority:** high.
**Status:** pending.
**Blocked By:** —
**Unblock Condition:** —
**Completion Evidence:** —

---

## Task 2: Add AuthContext methods (loginEmail, signUpEmail, forgotPasswordEmail) + expose via provider value

**ACs covered:** AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9

**Description:**
Inside `AuthProvider` in `src/App.tsx`:

1. Add three new async functions **below** the existing `login` / `logout` / `selectRole` / `updateUser` functions.

   a. `loginEmail(email: string, password: string): Promise<void>`
      - calls `signInWithEmailAndPassword(auth, email.trim(), password)`.
      - wraps in try/catch; on error translates Firebase code:
        - `auth/user-not-found` → alert("Invalid email or password.")
        - `auth/wrong-password` → alert("Invalid email or password.")
        - `auth/account-exists-with-different-credential` → alert("This email is registered with a different sign-in method. Please sign in with Google instead.")
        - `auth/invalid-email` → alert("Please enter a valid email.")
        - other → alert("Sign in failed. Please try again.")
      - return value is Promise void; onAuthStateChanged will pick up the user as usual.

   b. `signUpEmail(fullName: string, email: string, password: string): Promise<boolean>`
      - Preconditions are validated by the UI form (per Task 3), but also defensively re-check: `!fullName.trim() || !email || !password` → alert + return false.
      - calls `createUserWithEmailAndPassword(auth, email.trim(), password)`.
      - On success: awaits `updateProfile(userCredential.user, { displayName: fullName.trim() })` so that `tempUser.displayName` is set before `selectRole` writes the Firestore profile.
      - Returns `true` on success so that the calling Sign Up form can then directly invoke `selectRole(role, mobile)` with the already-captured role+mobile.
      - wraps in try/catch; on error translates:
        - `auth/email-already-in-use` → alert("This email is already registered. Please sign in with Google or use Forgot Password.") → return false
        - `auth/weak-password` → alert("Password should be at least 6 characters.") → return false
        - `auth/invalid-email` → alert("Please enter a valid email.") → return false
        - `auth/account-exists-with-different-credential` → alert("This email is registered with a different sign-in method. Please sign in with Google instead.") → return false
        - other → alert("Sign up failed. Please try again.") → return false
      - IMPORTANT: this function does NOT call `selectRole` itself; it returns control to the caller (LoginScreen Sign Up handler) so that role+mobile can flow through the standard selectRole() — one single place writes the Firestore profile.

   c. `forgotPasswordEmail(email: string): Promise<{ ok: boolean; message: string }>`
      - calls `sendPasswordResetEmail(auth, email.trim())`.
      - wraps in try/catch.
      - If OK: returns `{ ok: true, message: "Password reset email sent. Please check your inbox." }`.
      - If `auth/user-not-found`: returns the SAME success message (leak nothing).
      - If `auth/invalid-email`: returns `{ ok: false, message: "Please enter a valid email." }`.
      - Any other Firebase error: returns `{ ok: true, message: "Password reset email sent. Please check your inbox." }` (generic) to avoid leaking info.

2. Add these three methods to the `AuthContext.Provider value={...}` so they can be consumed in LoginScreen via `useAuth()`.

3. Keep the existing `value` entries exactly as they are; only APPEND new keys.

**Test Requirements:**
- TR 2.1 (rule): All three functions are callable via `useAuth()` (appear in Provider value).
  - Evidence: grep for `loginEmail|signUpEmail|forgotPasswordEmail` in Provider value.
- TR 2.2 (rule): `signUpEmail` success path ALWAYS calls `updateProfile` with `displayName: fullName` before returning true.
  - Evidence: function source code.
- TR 2.3 (rule): `signUpEmail` does NOT call `selectRole` internally (it returns true; caller must chain selectRole).
  - Evidence: function source code (no call to selectRole inside signUpEmail body).
- TR 2.4 (rule): Every auth call is try/catch wrapped and no error is silently swallowed.
  - Evidence: function source code.
- TR 2.5 (rule): `forgotPasswordEmail` for user-not-found returns `ok: true` (leak nothing).
  - Evidence: function source code error-branch check.
- TR 2.6 (rule): `tsc --noEmit` passes.
  - Evidence: `npm run lint` exit 0.

**Dependencies:** Task 1.
**Priority:** high.
**Status:** pending.
**Blocked By:** —
**Unblock Condition:** —
**Completion Evidence:** —

---

## Task 3: Rework LoginScreen into a 3-mode screen (Login / SignUp / ForgotPassword) with Google + Email/Password + full Validation

**ACs covered:** AC1, AC2, AC3, AC4, AC6, AC10, AC11

**Description:**
Rework the existing `LoginScreen` (currently lines 1187-1219) to be a composite component. Keep the EXACT outer shell:

- Same indigo `FileText` logo card (w-20 h-20 bg-indigo-600 rounded-2xl shadow-xl)
- Same "KhataBook Pro" heading + subtitle
- Same Hindi explanation banner card (bg-white p-8 rounded-3xl shadow-sm border)

Inside the banner card:

- Use a **local state `mode: 'login' | 'signup' | 'forgot'`** with default `'login'`.
- Render a **Mode segmented toggle** at the top of the card OR "Continue with Google" first, then a divider, then Email/Password form below. Suggested order (simple UX):
  1. Google button (unchanged text, style, onClick=login()) — "गूगल से लॉगिन करें" / "Continue with Google" labelled clearly; keep exactly the current button look for continuity.
  2. `<hr className="border-slate-100 my-6"/>` with "OR Login with Email & Password" label
  3. Render the Email/Password sub-form based on `mode`.

**Login sub-mode:**
- email input (type="email", same classes as role-screen input: `w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500`)
- password input (type="password", same classes)
- submit button: `Login` (calls loginEmail(email,password); button should be `disabled={loading || !email || !password}`; also add local `loading` boolean state set true while awaiting the call, then reset)
- Link row: "Forgot Password?" → set mode='forgot' ; "New user? Sign Up" → set mode='signup'

**SignUp sub-mode:**
- Full Name (text) — required
- Email ID (type="email") — required + client-side email regex check
- Mobile Number (type="tel") — required, re-use `normalizeMobile` + length >= 10 check
- Password (type="password") — required
- Confirm Password (type="password") — required + must equal password
- **Role toggle (required)** — exact same visual widget as RoleSelectionScreen:
  ```tsx
  <div className="flex gap-3">
    <button type="button" onClick={() => setRole('shopkeeper')} ...>
      <FileText size={24}/>
      <span className="text-xs font-bold uppercase tracking-wider">Shopkeeper</span>
    </button>
    <button type="button" onClick={() => setRole('customer')} ...>
      <UserIcon size={24}/>
      <span className="text-xs font-bold uppercase tracking-wider">Customer</span>
    </button>
  </div>
  ```
  with the same className composition (cn(border-indigo-600 bg-indigo-50 text-indigo-700 when active, else border-slate-100 text-slate-400)).
- submit button: "Sign Up" → (a) run client-side validations; if any bad → alert with first bad field msg + return. (b) setLoading(true) (c) `const signUpOk = await signUpEmail(name,email,password)` (d) if `signUpOk === true`, THEN immediately call `await selectRole(role, mobile)` with the captured role and mobile (to write the Firestore profile via the single canonical function in one shot). (e) setLoading(false).
- Link row: "Already have an account? Login" → set mode='login'

Validation regex (no new deps, same style):
- email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- mobile: `normalizeMobile(mobile).length >= 10`
- confirm: `password === confirmPassword`
- role: `role === 'shopkeeper' || role === 'customer'`

**Forgot sub-mode:**
- Email ID input
- Submit: "Send Reset Email" → call `forgotPasswordEmail(email)`. On resolve → show `message` inline (under input) with a green/amber text line + show a "Back to Login" button that sets mode='login'.
- Link: "Back to Login" → set mode='login'

**Loading state:**
- Local `const [loading, setLoading] = useState(false)` around every submit call; prevent double-click via button `disabled={loading}` + spinner or "Please wait..." label.

**IMPORTANT — AC1 guard:** the existing Google button `onClick` MUST still call `login()` — the SAME `login()` from context that wraps `signInWithPopup`. Do NOT introduce a new `login` function or rename the existing one (it's already in the context).

**Theme fidelity (AC10):**
- Keep `max-w-sm` + `space-y-*` padding scales identical to the current LoginScreen.
- Use `motion.div` animation wrapper exactly as today (initial opacity 0 y-20, animate opacity 1 y-0).

**Test Requirements:**
- TR 3.1 (rule): Google button onClick === `login()` (unchanged).
  - Evidence: LoginScreen JSX source.
- TR 3.2 (rule): Sign Up submit short-circuits with an alert BEFORE calling Firebase when any of (name, email-format, mobile-10-digits, password-match, role-set) fails.
  - Evidence: SignUp submit handler source.
- TR 3.3 (rule): Sign Up submit on success chains `signUpEmail` → then `selectRole(role, mobile)` inside the SAME handler; RoleSelectionScreen is NOT shown for Email/Password signup path.
  - Evidence: SignUp submit handler source showing `if (await signUpEmail(...)) await selectRole(role, mobile);` and no extra navigation to needsRole state.
- TR 3.4 (rule): Sign Up submit handler destructures `selectRole` from existing useAuth() context (no new Firestore setDoc path added in the screen).
  - Evidence: SignUp submit handler source.
- TR 3.5 (rule): Role toggle renders both Shopkeeper/Customer options exactly using the same flex gap-3 / cn() class pattern as RoleSelectionScreen.
  - Evidence: LoginScreen SignUp sub-view JSX source.
- TR 3.6 (rule): Forgot Password submit calls forgotPasswordEmail exactly once per submit and shows both error and success inline messages per spec generic-success rule.
  - Evidence: Forgot sub-view handler source.
- TR 3.7 (rule): Login submit calls loginEmail, loading state toggled true/false around call.
  - Evidence: Login submit handler source.
- TR 3.8 (rubric): UI theme fidelity (AC10 scale).
  - Scale 0–2, threshold ≥1.
  - Rationale: compare with existing LoginScreen theme tokens.
  - Evidence: LoginScreen source diff.
- TR 3.9 (rule): `tsc --noEmit` passes.
  - Evidence: `npm run lint` exit 0.

**Dependencies:** Task 2 (context methods must exist first).
**Priority:** high.
**Status:** pending.
**Blocked By:** —
**Unblock Condition:** —
**Completion Evidence:** —

---

## Task 4: Regression verify Google login existing RoleSelection + platforms/email/createdAt flow untouched

**ACs covered:** AC4, AC7, AC8, AC9

**Description:**
No new code here — purely a CODE REVIEW task (read-only check):

1. Confirm `onAuthStateChanged` still:
   - reads existing userDoc; if missing → sets `needsRole = true` → RoleSelectionScreen shown
   - if exists → runs `arrayUnion('khatabook')` if missing, no other field overwrite (preserves Kirana fields)
2. Confirm `selectRole` still writes exact doc structure including:
   - `initialStatus` branch for shopkeeper=pending / customer=approved / admin bypass
   - `createdAt: serverTimestamp()`
   - `platforms: ['khatabook']`
   - `email: tempUser.email` via conditional spread
3. Confirm LoginScreen Google button still calls existing `login()` → signInWithPopup.

If any of 1/2/3 differ due to Task 1/2/3 edits → fix in place during this task.

**Test Requirements:**
- TR 4.1 (rule): selectRole still writes `createdAt: serverTimestamp()`.
  - Evidence: source lines 588-599.
- TR 4.2 (rule): shopkeeper (non-admin) via ANY auth method writes `status: pending`.
  - Evidence: initialStatus branch logic unchanged.
- TR 4.3 (rule): login() = signInWithPopup.
  - Evidence: AuthContext login function source.

**Dependencies:** Task 1, Task 2, Task 3.
**Priority:** high.
**Status:** pending.
**Blocked By:** —
**Unblock Condition:** —
**Completion Evidence:** —

---

## Task 5: TypeScript lint clean + diagnostics

**ACs covered:** AC11

**Description:**
Run `npm run lint` and VS Code `GetDiagnostics`; both must pass cleanly. Any type errors from Tasks 1-4 must be fixed in-situ in this task. Reminder: do NOT add any new npm packages in this task.

**Test Requirements:**
- TR 5.1 (rule): `npm run lint` exit 0.
  - Evidence: terminal log.
- TR 5.2 (rule): VS Code diagnostics === [].
  - Evidence: GetDiagnostics output.

**Dependencies:** Task 1, 2, 3, 4.
**Priority:** medium.
**Status:** pending.
**Blocked By:** —
**Unblock Condition:** —
**Completion Evidence:** —

---

## Summary: AC Coverage

| AC | Tasks |
|---|---|
| AC1 — Google still works | Task 3 (TR 3.1), Task 4 (TR 4.3) |
| AC2 — Email/Password login tab | Task 1, Task 2, Task 3 |
| AC3 — Sign Up + validation tab | Task 2, Task 3 (TR 3.2) |
| AC4 — Full profile fields after signup → role-selection | Task 2 (TR 2.2), Task 3, Task 4 (TR 4.1) |
| AC5 — No duplicate auth UIDs for same email | Task 2 (error translations for duplicate-email, account-exists-different-credential) |
| AC6 — Forgot Password generic success | Task 2 (TR 2.4), Task 3 (TR 3.3) |
| AC7 — Shopkeeper pending | Task 4 (TR 4.2) |
| AC8 — Customer approved | Task 4 (initialStatus for customer branch) |
| AC9 — platforms array preserved/union | Task 4 (onAuthStateChanged arrayUnion block) |
| AC10 — UI fidelity | Task 3 (TR 3.5) |
| AC11 — TypeScript clean | Task 1 (TR 1.2), Task 5 |
