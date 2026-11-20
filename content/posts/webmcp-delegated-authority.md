---
id: webmcp-delegated-authority
title: "WebMCP: Who can confirm on the user’s behalf?"
author: "Giovanni Filardo"
slug: webmcp-delegated-authority
date: "2026-10-31"
description: "From a broad user request to a specific commitment: how applications and banks scale confirmation across a two-axis risk framework."
tags:
  - WebMCP
  - AI
  - API_design
  - architecture
series:
  id: webmcp-agent-ready-web
  title: "WebMCP and the agent-ready web"
  part: 4
draft: true
---

> When an AI assistant encounters an €85 surge fare, can it confirm the purchase on the user's behalf? If an agent must stop and prompt the user for every tool call, autonomy dies of prompt fatigue. But if the website accepts an agent's conversational claim of approval, it invites prompt injection and unauthorized spending. The answer to who can confirm on the user's behalf is never "the agent because it felt like it." In sound architecture, **only three entities can legitimately confirm**: the user directly, the application backend via stored policy envelopes, or a formally authorized delegate presenting cryptographic proof.

“Get me a ride home” is a clear statement of a desired outcome. It tells an assistant where the user wants to end up, but it says nothing about spending €85, accepting a non-refundable cancellation fee, or selecting a premium vehicle.

In Part 3, we built a two-phase transaction architecture (`offerId`, `approvalId`, `attemptId`) to ensure the backend never commits a booking without a recorded approval for that specific offer. Yet checking that an approval record exists in the database only answers *whether* an offer was marked approved. When an assistant translates high-level intent into concrete commitments—spending money, signing contracts, or altering persistent data—the application faces a second fundamental trust boundary: **who holds the legitimate authority to confirm on the user’s behalf?**

## The short answer: an agent cannot merely assert authority

The short answer is that **an AI agent cannot confirm on the user's behalf simply by claiming it has permission.**

An incoming payload containing `approved: true` or a conversational assertion (*“The user told me to book it”*) is not an authorization credential. An LLM is a probabilistic reasoning engine, not a security principal. It is vulnerable to prompt injection from untrusted web pages, model hallucinations, and misinterpretations of user intent. A website cannot outsource its fiduciary or contractual responsibility to an external model's conversational claims.

In traditional web development, applications collapsed identity, permissions, and transaction consent into a single check. If an HTTP request carried a valid session cookie, the backend assumed a human was sitting in front of the browser, had reviewed the form, and intended to submit it. 

With WebMCP, that assumption collapses. An in-browser agent shares the user's authenticated session, but its actions represent programmatic interpretations. Reasoning about delegation safely requires separating three distinct questions:

```mermaid#wide Three distinct security questions: authentication, authorization, and transaction approval.
flowchart LR
    REQ[Request to book ride] --> AUTH[1. Authentication<br/>Who is the caller?]
    AUTH -->|Valid Identity| PERM[2. Authorization<br/>May this account book rides?]
    PERM -->|Allowed| TX[3. Transaction Approval<br/>Did user agree to this EUR 85 offer?]
    TX -->|Approved| COMMIT[Commit Booking]
    AUTH -.->|Invalid| REJ1[Reject: Unauthenticated]
    PERM -.->|Denied| REJ2[Reject: Forbidden]
    TX -.->|Missing| REJ3[Reject: Approval Required]
```

1. **Authentication** establishes *who* is operating the session (a valid account credential).
2. **Authorization** establishes *what* that identity is generally permitted to do (the account has an active card and is allowed to book rides).
3. **Transaction approval** establishes whether *this specific commitment*—with its exact price, version, and material conditions—was deliberately authorized.

As [OWASP’s Transaction Authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) emphasizes, transaction authorization is fundamentally distinct from login. A user may be securely logged in and authorized to hail rides, but neither fact establishes approval for an €85 transaction.

## Only three entities can legitimately confirm

If an AI agent cannot confirm by conversational assertion, who *can* confirm? 

In robust software architecture, **there are strictly three entities that can ever legitimately confirm a transaction**:

1. **The User Themselves (Direct Human Gating):**  
   The human confirms the transaction directly through an application-controlled channel—either an in-page UI action or a hardware-backed biometric prompt via **WebAuthn and Passkeys**. Here, strictly speaking, *no delegation takes place*: the human provides fresh, non-delegated proof of physical presence.
2. **The Application Backend (Pre-Delegated Policy Engine):**  
   The application itself confirms on the user's behalf, but only by evaluating the agent's request against **stored, user-defined policy envelopes** (e.g., *"Auto-approve rides home up to €40; escalate anything higher"*). The agent does not approve the ride; it merely proposes an offer that the backend validates against pre-authorized rules.
3. **A Formally Authorized Delegate (Cryptographic Proof, Not Assertion):**  
   An external agent *can* confirm on the user's behalf, but only if it presents a cryptographically signed capability grant minted by a trusted authorization server (such as **OAuth 2.0 Rich Authorization Requests / [RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396)**). The receiving service trusts the cryptographic signature and the explicit parameter bounds embedded in the token—never the agent's prose.

**There is no fourth option.** An AI assistant cannot manufacture authority on the fly, and a backend cannot accept conversational claims of consent. Every safe delegation architecture maps back to one of these three trust anchors.

## Risk is not only the amount: how banks already reason

Before choosing a confirmation mechanism, an application needs to evaluate how much risk an operation carries. It is tempting to reduce risk to a single number—a euro threshold—but financial systems never evaluate amount in isolation.

In banking, Transaction Risk Analysis looks across four explicit criteria before deciding whether a request can proceed silently or demands fresh customer confirmation:

- **Amount:** The direct financial exposure of the operation.
- **Reversibility of the operation:** Whether the action can be easily undone without loss (like staging a draft or adding an item to a cart) or is final once executed (like an instant wire transfer or a non-refundable ticket).
- **Novelty:** Whether the counterparty or context has been seen before—for example, a recurring commute or a whitelisted trusted beneficiary versus a payee or merchant never seen before.
- **Criticality of the changed state:** Whether the operation modifies sensitive state such as identity records, authentication credentials, standing policy limits, or personal data exports.

A €30 transfer to a utility company the user pays every month sits in a completely different risk class from a €30 transfer to a newly added foreign account, or an operation that changes the account's recovery email. Scaling confirmation to risk is how banks already keep daily payments frictionless without leaving the vault open.

## The confirmation quadrant: four patterns across two axes

When systems designers translate the three confirming entities into concrete architectures, the resulting patterns are often presented as a flat list. In reality, they sit along **two orthogonal axes**, forming four progressive levels from lightest to strongest:

1. **When the user decides (driven by transaction risk):** Does the user pre-authorize a bounded rule in advance so the agent can commit autonomously, or must the human explicitly confirm this single transaction at commit time?
2. **How authority is proven (driven by the trust boundary):** Is approval verified through internal application state (a database rule or an in-page UI click within one trusted app), or through a cryptographic signature that holds across untrusted boundaries?

```mermaid#wide The two-axis confirmation quadrant: transaction risk moves left to right; trust boundaries move bottom to top.
flowchart BT
    subgraph LEFT["Standing Pre-Authorization (Autonomous at Commit)"]
        direction BT
        P1["1. Standing Threshold<br/>(App Backend Rule: ≤ EUR 40)"] -->|"Cross-service / federated boundary"| P3["3. Delegated Token<br/>(Cryptographic OAuth RAR: ≤ EUR 100/wk)"]
    end

    subgraph RIGHT["Per-Transaction Confirmation (Human at Commit)"]
        direction BT
        P2["2. Draft and Confirm — Art. 3<br/>(App UI Click: 'Accept EUR 85 fare')"] -->|"Zero-Trust UI / DOM bypass risk"| P4["4. Transaction Signing — Art. 5<br/>(Hardware WebAuthn + Dynamic Linking)"]
    end

    P1 ==>|"Risk exceeds envelope<br/>(Amount, Novelty, Irreversibility, Criticality)"| P2
    P3 ==>|"Risk exceeds token bounds"| P4
```

::: wide

| ▲ **How Authority Is Proven** \ **When User Decides** ► | **Standing Pre-Authorization**<br>*(Low transaction risk: within bounds, known payee, reversible)* | **Per-Transaction Confirmation**<br>*(High transaction risk: high amount, novel payee, irreversible, critical state)* |
| :--- | :--- | :--- |
| **Cryptographic Proof**<br>*(Zero-trust boundary: cross-service or untrusted client DOM)* | **3. Delegated Token**<br>OAuth 2.0 RAR ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396)) & Token Exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693))<br>*User grants limited, verifiable authority (e.g., "up to €100, this week only") portable across services.* | **4. Transaction Signing**<br>WebAuthn Passkey + Dynamic Linking<br>*User signs the exact canonical offer hash via hardware authenticator; reserved for real money, identity, or irreversible actions.* |
| **Application State**<br>*(Trusted first-party boundary: single app & session)* | **1. Standing Threshold**<br>Backend policy engine<br>*Small amounts and reversible operations; the backend approves on its own using a rule the user chose (e.g., up to €40).* | **2. Draft and Confirm (`Draft → Commit`)**<br>Two-phase staging<br>*The agent prepares the draft offer; the user reviews and approves once directly in the page.* |

:::

Let’s examine each of the four patterns from lightest to strongest:

### 1. Standing threshold (Bounded pre-approval)
For small amounts, known counterparties, and reversible operations, the user configures an explicit rule in their account profile (for example, *"Auto-approve rides home up to €40"*). When the agent submits a booking request, the backend approves on its own by evaluating the offer against that stored rule. A €32 regular commute proceeds autonomously without interrupting the user; an €85 surge fare—or a ride to an unfamiliar destination—exceeds the envelope and triggers an immediate `APPROVAL_REQUIRED` rejection, forcing escalation across the quadrant. This enforces [least privilege](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#enforce-least-privileges) in server-side business logic.

### 2. Draft and confirm (Two-phase `Draft → Commit`)
When an operation exceeds the standing threshold, the agent exercises full autonomy during search, filtering, and quote preparation, but its capability remains strictly non-committal. As we built in Part 3, the backend creates a versioned draft (`offerId`) and hands the final decision back to the human for a single confirmation in the page (`approvalId`). This eliminates routine search friction while keeping the user in control of the final commitment.

### 3. Delegated token (OAuth RAR & Token Exchange)
When an agent operates across independent services—for example, coordinating flights, hotels, and ground transport across separate vendors—applications cannot rely on internal database thresholds. Instead, the user grants the agent a limited, cryptographically verifiable authority (such as *"up to €100, this week only"*), issued by an authorization server using **OAuth 2.0 Rich Authorization Requests ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396))** and **Token Exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693))**. The token embeds explicit structured constraints (`type: "ride_booking"`, `max_amount: 100.00`, `currency: "EUR"`, `expiry`). Each receiving service independently verifies the token's signature and enforces its bounds without trusting the agent's prose.

### 4. Transaction signing (WebAuthn with dynamic linking)
For real money, identity changes, or irreversible operations—or whenever the browser DOM itself cannot be trusted against automated UI scripting—an in-page button click is no longer enough. The backend computes a canonical hash of the exact offer terms (offer ID, price, currency, payee, expiry) and issues a single-use cryptographic challenge bound to that hash. The user confirms via **WebAuthn** (Touch ID, Face ID, Windows Hello, or a hardware security key). The device's secure element signs the challenge with a private key that never leaves the hardware, and the backend verifies the signature before committing.

---

### Architectural Trade-Off Matrix

::: wide

| Pattern | Who Confirms | Trust Anchor | User Friction | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Standing Threshold** | Application Backend | Backend policy engine & user-chosen rules | **Zero** (Interruption-free within bounds) | Small amounts, known payees, reversible routine actions (≤ €40 commutes) |
| **2. Draft and Confirm** | User | In-page application UI (`Draft → Commit`) | **Low** (1 click in the page) | Medium-value actions within a trusted first-party interface |
| **3. Delegated Token** | Authorized Delegate | Authorization server (OAuth RAR / [RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396)) | **Low** (Granted once per time/budget window) | Multi-service workflows within a bounded weekly/session budget |
| **4. Transaction Signing** | User via Hardware | Asymmetric hardware keypair (WebAuthn + Dynamic Linking) | **Medium** (Biometric / passkey touch per action) | Real money above thresholds, novel payees, identity, irreversible actions |

*(Note: Technical authorization is paired in production with operational risk backstops—velocity limits, temporary holds, and chargeback workflows. Those buffers contain financial loss, but they do not replace confirmation architecture.)*

:::

## Terminology: transaction signing, not step-up authentication

In security discussions, single-operation confirmation is frequently confused with **step-up authentication**. In an agentic architecture, the distinction between the two is critical:

- **Step-up authentication** raises the session itself to a higher privilege level, where it remains more powerful for some duration (a pattern also formalized in OAuth).
- **Transaction signing (or transaction authentication)** confirms a single operation and ends right there, without granting the session any broader privileges. In the European Union's **PSD2** Strong Customer Authentication (SCA), cryptographically binding that signature to the exact amount and payee is called **dynamic linking**.

When an AI agent shares the user's browser session, **an elevated session in an agent's hands is the exact risk to avoid.** If confirming an €85 ride raised the session's privilege level for the next fifteen minutes, a malfunctioning or prompt-injected agent could piggyback on that elevated session to execute further high-value actions. Transaction signing with dynamic linking authorizes one exact offer and nothing else.

The mechanism itself is not new; banks already run it in production every day. What changes with WebMCP is the problem: in an agent-operated browser, programmatic shortcuts and DOM automation create paths that can skip confirmation unless we bring transaction signing into the agent world.

## Consent must have an object

Whichever pattern an application adopts, delegation cannot exist as a floating abstraction. Approval must bind to an immutable, versioned **object**:

- **Offer Identity & Version:** Approval binds to a specific quote record. If network delays or dynamic pricing shift the fare from €85 to €95, prior approval cannot silently transfer to the higher price.
- **Explicit Material Terms:** Price caps, service classes, currency, and cancellation penalties must be explicitly enumerated.
- **Strict Temporal Expiry:** Approvals must carry a short time-to-live (TTL). Acceptance granted at 18:00 must not remain usable at 22:00.
- **Revocability:** A standing delegation or capability token must have an instant revocation path on the server.

As [OWASP transaction guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) notes, binding authorization to immutable transaction data is the only reliable defense against parameter manipulation.

## Looking ahead: the zero-trust UI

Deciding who can confirm on the user's behalf is both an architectural and a product decision. Add too much friction to low-risk actions, and the assistant becomes an annoying toy. Infer too much authority on high-risk actions, and the application creates accidental dark patterns and unauthorized commitments.

In Part 3, we implemented **Pattern 2 (Draft and confirm)** using WebMCP's `document.modelContext.registerTool()` API, typed schemas (`offerId`, `approvalId`, `attemptId`), and an idempotent backend. That design holds as long as the agent respects the declared tool boundary and leaves the approval button in the page to the human.

But what happens when an autonomous browser agent—or a vision-language model driving the tab—simply clicks the **Accept this fare** DOM button itself?

In the final article of this series, we confront the **Zero-Trust UI**: how to draw a clear responsibility line between declared WebMCP tools and raw DOM automation, and how to implement **Pattern 4 (Transaction signing with WebAuthn and dynamic linking)** in a working local Node.js example where the private key never leaves the user's device.

## References and further reading

- [OWASP: Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to significant transaction data.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — least privilege and request-time validation.
- [RFC 9396: OAuth 2.0 Rich Authorization Requests (RAR)](https://datatracker.ietf.org/doc/html/rfc9396) — fine-grained, structured authorization for delegated capabilities.
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) — delegating and transforming security tokens across autonomous systems.
- [W3C Web Authentication (WebAuthn Level 3)](https://www.w3.org/TR/webauthn-3/) — cryptographic proof of user presence and user verification.
- [WebMCP Specification: Agent Baseline Capabilities](https://webmachinelearning.github.io/webmcp/#agent-baseline-capabilities) — session inheritance and security boundaries.
- [Chrome: Secure WebMCP Tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — security guidelines for exposing tools to browser agents.
- [Working Example Repository](https://github.com/gfilardo/gf-notebook-examples) — runnable code contrasting naive tool shortcuts against verified transaction approval.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation, and agent-host behavior should be checked separately.*
