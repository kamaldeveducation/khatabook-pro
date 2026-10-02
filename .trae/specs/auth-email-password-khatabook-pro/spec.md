# spec.md — Email/Password + Google Login for KhataBook Pro

## Problem

The current KhataBook Pro authentication screen only supports **Continue with Google** (Google OAuth via `signInWithPopup`). Users who prefer or require Email/Password login cannot use the app. Kirana website and KhataBook Pro share the same Firebase project, so the same `users/{uid}` Firestore document and Firebase Auth UID must be safely reused across both apps and both sign-in providers without creating duplicate UIDs or duplicate user profiles.

## Users

- **End-user (Shopkeeper)** — registers/signs-in to manage customers, suppliers, and khatas.
- **End-user (Customer)** — registers/signs-in as a customer role.
- **Admin** — approves pending Shopkeeper signups (existing system, must not break).

## Goals

1. Support **two** authentication providers on the Login Screen:
   - Continue with Google (existing behaviour, preserved)
   - Login with Email & Password (new)
2. Provide a Sign Up flow that creates a new Email/Password Firebase Auth user and then triggers the existing `RoleSelectionScreen → selectRole() → users/{uid}` Firestore profile creation path without modifying the fields written there.
3. Provide a Forgot Password flow that sends the Firebase Password Reset email and clearly shows success/error states.
4. Never create a **second** Firebase Auth UID or second `users/{uid}` Firestore document for the same person. Same-email account linking behaviour where applicable must follow Firebase's documented semantics.
5. Everything else (roles, pending/approved, platforms, createdAt, pricing, approval, customers, suppliers, transactions, Admin panel, Kirana website) must remain logically unchanged and working exactly as today.

## Non-Goals

- NO change to Firestore collections / collection names / field names.
- NO change to the role assignment algorithm.
- NO change to Shopkeeper pending/approval logic.
- NO migration or writing to existing user documents to backfill "email".
- NO changes to pricing, subscription, or wholesale/retail logic.
- NO changes to the Kirana website code.
- NO UI redesign outside of Login/Sign Up/Forgot Password screens.
- NO SMS, WhatsApp, Magic Link, Phone OTP, or other providers in this step.

---

## Functional Requirements

### FR1. Login Screen

The existing `LoginScreen` must be extended to offer **both** of the following as clearly separated flows with a way to switch between them:

- **Continue with Google** — existing button, style, and behaviour preserved; calls the existing `login()` which uses `signInWithPopup(auth, new GoogleAuthProvider())`.
- **Login with Email & Password** — a form with:
  - `email` text input (type="email")
  - `password` input (type="password")
  - "Login" submit button
  - "Forgot Password?" tap-target that navigates to the Forgot Password flow
  - "Sign Up" tap-target (for first-time Email/Password users) that navigates to Sign Up screen

Both flows must reuse the same page (tabs / segmented control OR sequential toggle) so the user can switch between Login ↔ Sign Up ↔ Forgot Password without losing in-memory state unnecessarily.

### FR2. Sign Up Screen (Email/Password only)

Show when the user taps "Sign Up" from Login screen:

Fields:

- Full Name (text, required)
- Email ID (email, required + valid email)
- Mobile Number (tel, required + at least 10 digits, India/10-digit sensible validation consistent with existing role-screen mobile validator)
- Password (password, required)
- Confirm Password (password, required + must equal Password)
- **Role** (required, exactly two visual toggle options identical to the existing `RoleSelectionScreen` toggle UI: `Shopkeeper` | `Customer`)

Client-side validation before attempting Firebase Auth:

- Name is non-empty after trim.
- Email matches a sane email regex.
- Mobile passes `normalizeMobile + length >= 10` using the existing `normalizeMobile` helper.
- Password is non-empty.
- Confirm Password strictly equals Password.
- Role is explicitly set (one of shopkeeper / customer).

If validation fails: do NOT call Firebase Auth; show an inline/alert error and return focus to the first bad field.

If validation passes:

1. Call `createUserWithEmailAndPassword(auth, email.trim(), password)`.
2. On success: immediately await `updateProfile(userCredential.user, { displayName: fullName.trim() })` so `tempUser.displayName` is populated.
3. Then immediately call the EXISTING `selectRole(role, mobile)` auth-context function with the role and mobile the user already submitted in this form. `selectRole` already contains the single source of truth for:
   - `role` (forced to shopkeeper for the admin email override, else preserved as user selected)
   - `status` (pending for shopkeeper, approved for customer, admin bypass)
   - `createdAt: serverTimestamp()`
   - `platforms: ['khatabook']`
   - conditional `email` field from the authenticated Firebase user
   - Firestore `setDoc(doc(db, "users", tempUser.uid), newUser)`
   - plus `setUser(newUser)` and `setNeedsRole(false)`

Because `selectRole` is invoked directly in step 3, the Email/Password Sign Up flow must NOT show the user the redundant `RoleSelectionScreen` a second time. The expected lifecycle is:

Email/Password Sign Up form → `createUserWithEmailAndPassword` → `updateProfile(displayName)` → `selectRole(role, mobile)` → Firestore profile doc created once → user goes to Pending Approval (if shopkeeper) or Dashboard (if customer).

If Firebase throws (email-already-in-use, weak-password, invalid-email, etc.), translate errors into simple user-facing Hindi/English messages without leaking sensitive info; never silently swallow.

### FR3. Firebase Account-Linking & Anti-Duplication Behaviour

Implement using Firebase's standard provider semantics. **Rules:**

1. Before Email/Password sign-up, do NOT silently create a brand-new Firebase user if the email already exists in Firebase under Google provider (Firebase will throw `auth/email-already-in-use`). Catch this and tell the user "This email is already registered; please sign in with Google or use Forgot Password."
2. Before Email/Password login, if Firebase throws `auth/account-exists-with-different-credential` or similar linking errors, tell the user to sign in with their original provider (Google) first; we will NOT attempt to auto-link providers in this spec to avoid UID changes. (Linking-on-sign-in may be added later with user-explicit action; not in scope here.)
3. Google login uses the existing `signInWithPopup` unchanged. If that Google email already has an Email/Password account, Firebase will throw `auth/account-exists-with-different-credential` — catch this and prompt the user to sign-in with Email/Password.
4. In **all** success paths, the post-auth `tempUser.uid` MUST be the single, same UID Firebase returned; code that already writes `doc(db, "users", tempUser.uid)` MUST continue to be the single place where a user document is created; never call `setDoc` with an alternate UID.

### FR4. Forgot Password Flow

A dedicated sub-view reachable from Login Screen "Forgot Password?":

- One field: Email ID (valid email)
- Submit button: "Send Reset Email"
- On submit: call `sendPasswordResetEmail(auth, email)`.
- **Success** path — show a clear confirmation message, e.g. "Password reset email sent. Please check your inbox." plus a "Back to Login" button that returns to the Login Email/Password tab. Do NOT reveal whether the email actually has a Firebase account (security best-practice).
- **Error** path — if Firebase returns an error that is NOT `auth/user-not-found`, show a simple error; if it IS `auth/user-not-found`, STILL show the generic success message (leak nothing).

### FR5. Role-Capture Behaviour Per Provider — MUST Remain Intact

**Google Login (unchanged per spec rule):**
Google `signInWithPopup` → `onAuthStateChanged` fires → if Firestore `users/{uid}` doc does NOT exist → `needsRole = true` → the existing `RoleSelectionScreen` is shown → user picks Shopkeeper/Customer + mobile → existing `selectRole(role, mobile)` writes the Firestore profile doc once exactly as today. This existing post-Google flow is preserved verbatim and must not be bypassed or rewritten.

**Email/Password Sign Up (new flow):**
Role and mobile are captured directly inside the Sign Up form BEFORE any Firebase Auth call. Flow:
`validate → createUserWithEmailAndPassword → updateProfile(displayName) → await selectRole(role, mobile)`

The `selectRole` function is the **single source of truth** that writes the Firestore profile document in BOTH flows (Google post-auth, Email/Password post-signup). It must continue to enforce the following rules exactly as today — NO behavioural regressions:

- Shopkeeper (non-admin email) → `status: "pending"`.
- Admin email `kamaldevjobs@gmail.com` → force `role: shopkeeper` + `status: approved`.
- Customer role → `status: "approved"`.
- Firestore doc includes: `uid, name, mobile, role, status, shopName, smsFormat, createdAt (serverTimestamp()), platforms: ['khatabook'], email (if truthy)`.
- `onAuthStateChanged` path where user doc already exists: reads existing doc, runs `arrayUnion('khatabook')` on platforms if missing, writes NO other fields (preserves Kirana-originated `email`, `createdAt`, etc.). All of this stays.

### FR6. UI Requirements

- Use the **existing** KhataBook Pro theme tokens (indigo-600 accent, slate-900/slate-50 surfaces, rounded-2xl/3xl, max-w-sm + p-6 center layout, `motion.div` entrance animations matching the existing LoginScreen at lines 1191).
- Mobile-first responsive; inputs with the same classes as existing inputs (`bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500`).
- Clearly labelled mode switcher(s): "Already have an account? Login" / "New? Sign Up" / "Back to Login".
- Loading/disabled state on submit buttons during Firebase round-trips so the user cannot double-submit.

---

## Non-Functional Requirements

NFR1. **Bundle size:** import ONLY needed functions from `firebase/auth` (no wildcard imports). Add required imports beside existing ones (already `signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser` — add `createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile`).

NFR2. **TypeScript strictness:** all new state typed; no `any` except where AppUser already uses it (keep existing AppUser typing pattern parity).

NFR3. **No side-effect on existing flows:** Google login from LoginScreen must still call exactly `login()` which does `signInWithPopup` — do not wrap it with new logic.

NFR4. **Error handling:** every Firebase Auth call wrapped in try/catch; every catch calls `alert(message)` matching the existing style used in RoleSelection (or toast-like inline alerts, keep simple — no new toaster library).

NFR5. **Security:** Never print user emails/hashes/stack traces to user-facing errors.

---

## Constraints & Dependencies

- Same Firebase Auth instance imported from the existing `firebase` module (no new Firebase project, no new config).
- Existing `AuthContext` with `{user, loading, login, logout, needsRole, selectRole, updateUser}` must continue to work; a new `signUpEmail`, `loginEmail`, `forgotPassword` MAY be exposed through the existing AuthContext or defined locally inside the screen components, whichever minimises change surface.
- No npm installs allowed (no new packages).
- Existing `normalizeMobile` helper must be reused for mobile validation.

## Assumptions

- Existing Google login is scoped to `profile email` by default Google provider so `tempUser.email` is always populated on Google success (already true today).
- For Email/Password sign-up, the email Firebase returns in `userCredential.user.email` is the same email the user typed (assumed).
- The standard "Login with Email & Password" tab is the default Email/Password landing; Sign Up is a child tab of the same composite screen.

## Open Questions

None. All scope decisions are explicit above.

---

## Acceptance Criteria

### AC1 (rule) — Google Login Button Still Works
A click on "Continue with Google" invokes exactly the existing `signInWithPopup(GoogleAuthProvider)` path and no new wrapping logic.  
Evidence: grep for `signInWithPopup` — exactly one call site, same as before, and LoginScreen Google button `onClick` still calls `login()` from AuthContext.

### AC2 (rule) — Email/Password Login Tab Present
LoginScreen contains Email/Password login form fields (email, password, submit, Forgot Password anchor, Sign Up anchor).  
Evidence: LoginScreen source code render output.

### AC3 (rule) — Sign Up Tab Present With Role Selection & Validation
Sign Up form has 6 required sections (Name, Email, Mobile, Password, Confirm Password, Role toggle with Shopkeeper / Customer options). Submit is blocked with an alert if any field or role fails validation.  
Evidence: Source of Sign Up submit handler + conditional validation, plus Role toggle JSX in Sign Up sub-view.

### AC4 (rule) — Successful Email/Password Sign Up → Role passed into selectRole() → Firestore Profile With All Existing Fields
After `createUserWithEmailAndPassword` succeeds:
- Firebase user `displayName` is set from the Name field via `updateProfile()`;
- `selectRole(role, mobile)` is called synchronously in the same success chain with the role and mobile already captured in the Sign Up form;
- Firestore `users/{uid}` doc is created once inside `selectRole` (no new `setDoc` path added for signup);
- The doc contains `email`, `name`, `mobile`, `role`, `status (pending for shopkeeper)`, `createdAt (Timestamp)`, `platforms: ['khatabook']`;
- Email/Password Sign Up flow never shows `RoleSelectionScreen` for the same submit (single-shot profile write via selectRole).
Evidence: `selectRole` code unchanged + `updateProfile` call present + SignUp submit handler chains to `selectRole` without showing RoleSelectionScreen.

### AC5 (rule) — No Second Auth Account / UID Created For Same Email
`createUserWithEmailAndPassword` is the **only** call that creates a brand-new Auth account for Email/Password. If email already exists → alert shown; no second UID. Google sign-in for same-email-different-provider errors are caught and user-directed to sign-in.  
Evidence: error handlers for `auth/email-already-in-use` and `auth/account-exists-with-different-credential` in auth call sites.

### AC6 (rule) — Forgot Password Sends Reset Email + Shows Generic Success
Forgot submit calls `sendPasswordResetEmail`. Both success AND user-not-found show the same success message. Back to Login button exists.  
Evidence: Forgot Password submit handler.

### AC7 (rule) — Shopkeeper → status pending (NOT auto approved) After Sign Up
New shopkeeper via Email/Password writes Firestore doc with `status: "pending"`. Admin email bypass still works.  
Evidence: `initialStatus` logic in selectRole unchanged.

### AC8 (rule) — Customer → status approved After Sign Up
New customer via Email/Password writes Firestore doc with `status: "approved"` (no change).  
Evidence: unchanged `initialStatus` for customer branch.

### AC9 (rule) — platforms Array Still Safe
New KhataBook sign-ups still write `platforms: ['khatabook']`. Existing cross-app users (e.g. Kirana first) still get `arrayUnion('khatabook')` in onAuthStateChanged.  
Evidence: `selectRole` + `onAuthStateChanged` blocks unchanged.

### AC10 (rubric) — UI Fidelity & Mobile UX
Scale: 0–2.  
`2` = Looks consistent with existing LoginScreen theme (indigo/slate, same spacing, rounded inputs, max-w-sm, motion animations) and works correctly on 375px-wide mobile viewport without horizontal scroll.  
`1` = Functional but small visual mismatch from existing theme in ≤1 area.  
`0` = Visuals inconsistent or layout breaks on mobile.  
Pass threshold: ≥1.

### AC11 (rule) — TypeScript Clean
`tsc --noEmit` exits 0 with no errors.  
Evidence: `npm run lint` exit code 0.
