# KeyLedger — Collaborator Sharing Guide

KeyLedger allows you to delegate live 2FA verification codes to teammates by email **without ever exposing your raw Base32 secret seed**.

---

## 1. Share a TOTP Key Record (Owner)

1. Sign in to your KeyLedger dashboard (`/`).
2. Locate the **Personal** TOTP record you want to share and click **DOSSIER**.
3. Scroll to the **DELEGATE COLLABORATOR ACCESS** section inside the Dossier drawer.
4. Enter the collaborator's **email address** (e.g., `teammate@company.com`).
5. *(Optional)* Check **Grant metadata edit clearance** if you want the collaborator to be able to edit the record's name, issuer, or TOTP parameters. Leave it unchecked for **read-only** code access.
6. Click **GRANT CLEARANCE**.
   - The collaborator will appear under **ACTIVE COLLABORATORS** with `[READ]` or `[EDIT]`.

> **Pending Shares:** If the collaborator has not signed in to KeyLedger yet, the share is saved as pending and automatically links to their account the first time they sign in with that email address.

---

## 2. Access a Shared Key (Collaborator)

1. Sign in to KeyLedger using the email address the key was shared with.
2. In the **LEDGER** view, select the **SHARED** filter tab to view all keys delegated to you.
3. Click or tap the 6-digit passcode to copy the live TOTP code to your clipboard.
   - **Zero-Leak Guarantee:** Collaborators can generate and copy live verification codes, but they can never view, export, or download the underlying Base32 secret seed.

---

## 3. Revoke Collaborator Access

- **As the Key Owner:** Open the record's **DOSSIER** drawer, locate the collaborator under **ACTIVE COLLABORATORS**, and click **REVOKE**.
- **As an Administrator:** Open the **AUDIT** tab (`02 AUDIT`) to review all active shares across the workspace and click **REVOKE** on any delegation record.
