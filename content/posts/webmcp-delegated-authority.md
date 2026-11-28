---
id: webmcp-delegated-authority
title: "WebMCP: Who can confirm on the user’s behalf?"
author: "Giovanni Filardo"
slug: webmcp-delegated-authority
date: "2026-11-19"
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

*“Get me a ride home”* is a clear statement of a desired outcome. It tells an assistant where the user wants to end up, but it says nothing about spending €85 during a sudden price surge, accepting a non-refundable cancellation fee, or selecting a premium vehicle class.

In Part 3, we built a two-phase transaction architecture (`offerId`, `approvalId`, `attemptId`) so the backend never commits a booking without a recorded approval for that specific offer version. Yet verifying that an approval record exists in the database only answers *whether* an offer was marked approved. When an assistant translates high-level intent into concrete financial or operational commitments, the system confronts a second trust boundary: **who holds the legitimate authority to confirm on the user’s behalf?**

If an assistant had to pause and prompt the user for every minor action, useful autonomy would quickly collapse into prompt fatigue. Conversely, if a website simply accepted an agent's conversational claim that the user agreed, it would expose itself to prompt injection, model misinterpretation, and unauthorized spending. Scaling autonomy safely requires a clear model of delegated authority.

## An agent cannot merely assert authority

The starting rule of agentic authorization is simple: **an AI agent cannot confirm a transaction on the user's behalf merely by claiming it has permission.**

An incoming payload carrying `approved: true` or a conversational assertion (*“The user told me to book it”*) is not an authorization credential. A language model is a probabilistic reasoning engine, not a security principal; it can misread context, over-generalize a casual instruction, or be steered by untrusted page content. A service cannot outsource its regulatory or contractual responsibility to an assistant's prose.

In traditional web applications, developers could comfortably collapse identity, permissions, and transaction consent into a single session check. When an HTTP POST arrived carrying a valid session cookie, the backend reasonably assumed a person was sitting in front of the screen, had read the form, and intended to submit it. Once WebMCP invites an assistant into that active tab, the session is shared between two very different actors. Reasoning about confirmation requires separating three distinct security questions:

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

**Authentication** establishes *who* owns the active session, while **authorization** establishes *what* that account is generally permitted to do (such as holding an active payment method and hailing rides). **Transaction approval** answers a much narrower question: whether *this specific commitment*—with its exact price, version, and material terms—was legitimately authorized. As [OWASP’s Transaction Authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) emphasizes, being logged in and eligible to book rides does not establish consent for an €85 charge.

## Three trust anchors for transaction confirmation

If an assistant cannot manufacture consent by conversational assertion, where can valid confirmation come from? Across distributed and financial systems, legitimate transaction confirmation traces back to **three trust anchors**:

1. **The application backend via stored policy envelopes:** The service confirms on the user's behalf by evaluating the proposed offer against pre-configured, user-chosen bounds stored on the server (for example, *"Auto-approve rides home up to €40; escalate anything higher"*). The assistant does not approve the transaction; it proposes an offer that the backend policy engine validates against rules the user established in advance.
2. **A formally authorized delegate presenting cryptographic proof:** An external agent or cross-service coordinator confirms by presenting a verifiable capability grant minted by an authorization server—such as a signed **JWT access token ([RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068))** carrying **OAuth 2.0 Rich Authorization Requests ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396))** `authorization_details`. The receiving service verifies the cryptographic signature and enforces the explicit budget and time bounds embedded in the token, never the agent's narrative claims.
3. **The user directly:** The person confirms the specific offer themselves without delegation. Depending on the trust boundary of the client environment, direct human confirmation takes one of two forms: an in-page UI confirmation within a trusted application flow, or a hardware-backed cryptographic signature via **WebAuthn and Passkeys** when the browser DOM itself cannot be trusted.

Notice how these three trust anchors map onto four operational patterns: the backend policy anchor governs routine first-party automation, the delegated token anchor governs cross-service automation, and the direct user anchor splits into in-page confirmation and hardware-signed confirmation depending on whether we trust the browser UI.

## Risk is not only the amount: how banks already reason

Choosing which confirmation pattern to require begins with assessing the risk of the operation. It is tempting to reduce transaction risk to a single number—a euro threshold—but financial architectures never evaluate price in isolation.

Inspired by how banks combine payment risk analysis, trusted-beneficiary exemptions, and account security controls, we can evaluate an application operation across four practical risk dimensions before deciding whether it can proceed silently or demands fresh customer confirmation:

- **Amount:** The direct financial exposure of the commitment.
- **Reversibility of the operation:** Whether the action can be easily undone without loss (like staging a draft order or adding an item to a cart) or is final once executed (like an instant wire transfer or a non-refundable booking).
- **Novelty:** Whether the counterparty, destination, or context has been seen before—contrasting a recurring daily commute or a whitelisted beneficiary against a merchant or recipient encountered for the first time.
- **Criticality of the changed state:** Whether the operation modifies sensitive account state such as identity records, authentication credentials, standing policy thresholds, or personal data exports.

A €30 payment to a utility company the customer pays every month sits in a very different risk class from a €30 transfer to a newly added foreign account, or an action that alters the account's recovery address. Evaluating risk across all four dimensions is how financial institutions keep everyday operations effortless without leaving the account exposed.

## The confirmation quadrant: four patterns across two axes

When we combine our three trust anchors with multi-dimensional risk analysis, the resulting confirmation mechanisms organize naturally along **two orthogonal axes**:

1. **When the user decides (driven by transaction risk):** Does the user pre-authorize a bounded rule in advance so the assistant can commit autonomously, or must the human confirm this specific transaction at the moment of commitment?
2. **How authority is proven (driven by the trust boundary):** Is approval verified through internal application state within a trusted first-party session, or through a cryptographic signature that holds across untrusted boundaries?

```mermaid#wide The two-axis confirmation quadrant: transaction risk moves left to right; trust boundaries move bottom to top.
flowchart BT
    subgraph LEFT["Standing Pre-Authorization (Autonomous at Commit)"]
        direction BT
        P1["1. Standing Threshold<br/>(App Backend Rule: ≤ EUR 40)"] -->|"Cross-service / federated boundary"| P3["3. Delegated Token<br/>(Signed JWT + OAuth RAR: ≤ EUR 100/wk)"]
    end

    subgraph RIGHT["Per-Transaction Confirmation (Human at Commit)"]
        direction BT
        P2["2. Draft and Confirm — Art. 3<br/>(App UI Click: 'Accept EUR 85 fare')"] -->|"Zero-Trust UI / DOM bypass risk"| P4["4. Transaction Signing — Art. 5<br/>(Hardware WebAuthn + Dynamic Linking)"]
    end

    P1 ==>|"Risk exceeds envelope<br/>(Amount, Novelty, Irreversibility, Criticality)"| P2
    P3 ==>|"Risk exceeds token bounds"| P4
```

::: wide

| ▲ **How authority is proven** \ **When user decides** ► | **Standing pre-authorization**<br>*(Low transaction risk: within bounds, known payee, reversible)* | **Per-transaction confirmation**<br>*(High transaction risk: high amount, novel payee, irreversible, critical state)* |
| :--- | :--- | :--- |
| **Cryptographic proof**<br>*(Zero-trust boundary: cross-service or untrusted client DOM)* | **3. Delegated token**<br>*Anchor:* Authorized delegate ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396) RAR + [RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068) JWT)<br>*Friction:* Low (granted once per budget window)<br>*Fit:* Multi-service workflows within a portable weekly or trip budget | **4. Transaction signing**<br>*Anchor:* User via hardware keypair (WebAuthn + dynamic linking)<br>*Friction:* Medium (biometric or passkey touch per action)<br>*Fit:* High-value charges, novel payees, identity edits, untrusted DOM |
| **Application state**<br>*(Trusted first-party boundary: single app & session)* | **1. Standing threshold**<br>*Anchor:* Application backend policy engine<br>*Friction:* Zero (interruption-free within bounds)<br>*Fit:* Routine, low-value actions with known counterparties (≤ €40 commute) | **2. Draft and confirm (`Draft → Commit`)**<br>*Anchor:* User via in-page application UI<br>*Friction:* Low (single click in the active tab)<br>*Fit:* Medium-value actions where the agent respects the UI boundary |

:::

Let’s walk through how each pattern operates in practice as risk and trust requirements escalate:

### 1. Standing threshold (bounded pre-approval)

For low-value, routine actions involving familiar counterparties, the user configures an explicit policy in their account settings—for example, *"Auto-approve rides home up to €40."* When the browser assistant invokes `book_ride`, the backend policy engine evaluates the staged quote against that stored envelope. A regular €25 commute commits without interrupting the user. When surge pricing pushes the quote to €85—or when the destination is unfamiliar—the request breaches the envelope, the server returns `APPROVAL_REQUIRED`, and the workflow escalates to the right side of the quadrant. This applies [least privilege](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html#enforce-least-privileges) directly in domain logic, delivering zero-friction autonomy where risk is low.

### 2. Draft and confirm (two-phase `Draft → Commit`)

Once a request exceeds the user's standing threshold inside a first-party web application, the assistant shifts from autonomous execution to collaborative staging. It retains full autonomy to search, compare options, and prepare a versioned draft quote (`offerId`), then yields the commit decision to the person via the in-page confirmation flow we built in Part 3 (`approvalId`). The user experiences minimal friction—a single deliberate click on screen—while remaining in control of the financial commitment.

### 3. Delegated token (OAuth RAR and signed JWTs)

Internal database thresholds work well inside a single application, but agentic workflows frequently span independent services—for example, an assistant coordinating flights, hotel bookings, and ground transfers across separate merchants, or an external orchestrator passing a budget grant into a partner site's WebMCP tool. Across service boundaries, the user can grant a limited, portable authority (such as *"up to €100 on ground transport this week"*) issued by an authorization server. Using **OAuth 2.0 Rich Authorization Requests ([RFC 9396](https://datatracker.ietf.org/doc/html/rfc9396))** encoded inside a cryptographically signed **JWT access token ([RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068))**, the grant carries structured `authorization_details` (`type: "ride_booking"`, `max_amount: 100.00`, `currency: "EUR"`, `expiry`). Because a stateless JWT cannot by itself tell Merchant B how much of that €100 weekly budget was already spent at Merchant A, multi-merchant workflows pair RAR with **Token Exchange ([RFC 8693](https://datatracker.ietf.org/doc/html/rfc8693))**—allowing the authorization server to track cumulative spend centrally and mint down-scoped, merchant-specific tokens for each leg—or settle against a shared spend ledger. Each participating backend then verifies its token's signature and enforces the allocated cap without relying on the assistant's claims.

### 4. Transaction signing (WebAuthn with dynamic linking)

For high-value payments, novel beneficiaries, identity or credential edits, or any environment where an autonomous browser agent might bypass WebMCP tools and script the DOM directly, an in-page HTML click is no longer sufficient evidence of human consent. Instead, the backend computes a canonical digest of the exact offer terms (offer ID, price, currency, payee, and expiry) and issues a single-use cryptographic challenge bound to that digest. The user confirms via **WebAuthn** (Touch ID, Face ID, Windows Hello, or a hardware security key), producing a cryptographic signature from an authenticator whose private key—whether hardware-bound or stored in an OS passkey vault—never enters the browser's JavaScript runtime.

In production systems, these four technical confirmation patterns work alongside operational risk backstops—velocity limits, temporary settlement holds, and dispute workflows—which help contain financial exposure when credentials or devices are compromised, but never replace upfront confirmation architecture.

## Terminology: transaction signing, not step-up authentication

In security discussions, confirming a high-risk action is frequently conflated with **step-up authentication**. In an agent-operated browser, keeping the two distinct is essential.

**Step-up authentication** elevates the session itself to a higher privilege tier, where it remains elevated for some time window (a pattern also formalized in OAuth step-up flows). **Transaction signing** (or transaction authentication), by contrast, authorizes a single specific operation and terminates immediately, leaving the surrounding session privileges unchanged. Under the European Union's **PSD2** Strong Customer Authentication (SCA) rules, cryptographically binding that one-time signature to the specific transaction amount and payee is known as **dynamic linking**.

When an AI assistant shares the user's active browser tab, **an elevated session in an agent's hands is the exact hazard we want to avoid.** If approving an €85 ride elevated the session's privilege level for the next fifteen minutes, a confused or prompt-injected agent could piggyback on that window to execute additional high-value actions without interruption. Transaction signing with dynamic linking authorizes one immutable offer and nothing else.

Banks already run this mechanism in production every day. What changes with WebMCP is the context: in an agent-operated browser, programmatic shortcuts and DOM automation introduce execution paths that can bypass visual confirmation unless we bring transaction signing directly into the web application architecture.

## Consent must have an object

Regardless of which quadrant pattern an application uses, confirmation cannot exist as an abstract permission floating free of transaction state. Every approval must bind to an immutable, versioned **object**:

- **Offer identity and version:** Approval binds to a specific quote record. If dynamic pricing shifts a fare from €85 to €95 while the user is deciding, prior acceptance never carries over to the new price.
- **Explicit material terms:** Price caps, service classes, currency, payee identity, and cancellation penalties must be enumerated in the record being approved.
- **Short temporal expiry:** Approvals carry a brief time-to-live (TTL) so consent granted at 18:00 cannot be redeemed hours later under different conditions.
- **Immediate revocability:** Standing policy thresholds and delegated tokens must provide a clear server-side revocation path whenever the user withdraws authority.

As [OWASP’s transaction-authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) emphasizes, binding authorization to immutable transaction parameters is the primary defense against parameter tampering between preparation and commit.

## Looking ahead: the zero-trust UI

Deciding who can confirm on the user's behalf is simultaneously an architectural and a product design choice. Require biometric confirmation for every €15 errand, and users will abandon the assistant; infer broad authority on high-risk actions, and the platform invites accidental dark patterns and unauthorized charges.

In Part 3, we implemented **Pattern 2 (Draft and confirm)** using WebMCP's `document.modelContext.registerTool()` API, typed schemas (`offerId`, `approvalId`, `attemptId`), and an idempotent backend store. That design works smoothly as long as the assistant respects the declared tool contract and leaves the confirmation button in the page to the human.

What happens, however, when an autonomous browser agent—or a vision-language model driving the page—falls back to DOM automation and clicks the **Accept this fare** button itself?

In Part 5, the final article of this series, we confront the **Zero-Trust UI**: how to establish a clear operational boundary between declared WebMCP tools and raw DOM scripting, and how to build **Pattern 4 (Transaction signing with WebAuthn and dynamic linking)** in a local Node.js implementation where the signing key stays isolated outside the browser's JavaScript runtime.

## References and further reading

- [OWASP: Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to significant transaction data.
- [OWASP: Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) — least privilege and request-time validation.
- [RFC 9396: OAuth 2.0 Rich Authorization Requests (RAR)](https://datatracker.ietf.org/doc/html/rfc9396) — fine-grained, structured `authorization_details` for delegated capabilities.
- [RFC 9068: JSON Web Token (JWT) Profile for OAuth 2.0 Access Tokens](https://datatracker.ietf.org/doc/html/rfc9068) — cryptographically verifiable access tokens for resource servers.
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693) — delegating and scoping security tokens across autonomous services.
- [W3C Web Authentication (WebAuthn Level 3)](https://www.w3.org/TR/webauthn-3/) — cryptographic proof of user presence and user verification.
- [WebMCP Specification: Agent Baseline Capabilities](https://webmachinelearning.github.io/webmcp/#agent-baseline-capabilities) — session inheritance and security boundaries.
- [Chrome: Secure WebMCP Tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — security guidelines for exposing tools to browser agents.
- [Working Example Repository](https://github.com/gfilardo/gf-notebook-examples) — runnable code contrasting naive tool shortcuts against verified transaction approval.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation, and agent-host behavior should be checked separately.*
