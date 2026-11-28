---
id: webmcp-agent-ready-transaction
title: "WebMCP: The two-phase approval pattern"
author: "Giovanni Filardo"
slug: webmcp-two-phase-approval-pattern
date: "2026-11-18"
description: "A two-phase quote, approval, and booking architecture that preserves user authority through execution."
tags:
  - WebMCP
  - AI
  - API_design
  - architecture
series:
  id: webmcp-agent-ready-web
  title: "WebMCP and the agent-ready web"
  part: 3
draft: true
---

In [Part 1](/posts/webmcp-people-and-agents/), we looked at the collaborative promise of an agent-ready web: an assistant handles the tedious work of searching, filtering, and staging a workflow inside the active browser tab, while the human interface remains the supervisory control plane. In [Part 2](/posts/webmcp-agent-shortcuts-and-unintentional-dark-patterns/), we saw how easily that collaboration breaks down when a developer compresses a multi-step checkout into a single function call, allowing the agent to commit an €85 surge fare without touching the warning screen designed for human eyes.

Restoring that collaborative model requires more than a better prompt or a client-side warning. To answer our first core question—*was this specific offer approved?*—an application must replace one-shot execution shortcuts with a two-phase `Draft → Commit` transaction model. In practice, building an agent-ready transaction requires three deliberate architectural investments: a **decoupled quote service** that issues versioned, short-lived offer records locking in material terms and expiry; a **transactional approval and idempotency store** that binds single-use approval records to the exact offer version alongside caller-scoped retry keys (`attemptId`); and a **synchronized in-page tool adapter** (`document.modelContext.registerTool`) that shares live viewmodel state with the visual UI while leaving enforcement to the backend.

## Start with the offer

A collaborative workflow begins by separating preparation from commitment. When an assistant searches for a ride, its first operation does not dispatch a car; it requests a structured quote containing the business facts required for an informed decision:

| Fact | Purpose |
| --- | --- |
| Offer identity | Connect subsequent approval and booking to the same offer |
| Journey and service | Establish what will be purchased |
| Total price and currency | Make the financial commitment explicit |
| Material cancellation conditions | Describe an important consequence |
| Expiry | Bound how long the offer remains usable |
| Offer version | Detect changes to the agreed conditions |

Both the visual interface and the agent's structured tool response should derive from this single quote record. At this boundary, the application must distinguish a binding quote from a rough estimate: if the final fare can vary, that variability and any applicable price cap belong inside the offer record itself so neither the user nor the assistant is operating on unstated assumptions.

## Establish approval through a trusted path

Once a quote is staged, the application needs a distinct path to record that the terms were accepted before commitment can proceed. For our initial first-party architecture, that confirmation flow is controlled by the application UI: the interface presents the €85 surge offer, collects the confirmation click, and writes a server-side approval record bound to the authenticated account and the exact offer version. Because the server creates and stores this record on a dedicated route, a booking tool cannot manufacture consent simply by passing `approved: true` in its request payload.

Be clear about what this initial boundary proves—and what it assumes. An application-controlled UI flow guarantees that the confirmation step was executed within the authenticated session before `book_ride` was called, which is the right starting assumption for designing our two-phase transaction state machine. It does not by itself prove that a human finger rather than in-page DOM automation clicked the button, nor does it cover standing delegation across external services—two trust boundaries we will address directly in Parts 4 and 5. Even within this first-party boundary, a bare reference to an approval record is never sufficient on its own: following OWASP’s [transaction-authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), the backend must verify at execution time that the approval record belongs to the authenticated user, matches the immutable offer data, and permits the requested operation.

## Put the approval prerequisite in the tool contract

When an application exposes a commit capability to an in-browser assistant, the tool contract should make its business prerequisites explicit rather than advertise an unconstrained purchase action. An offer identifier specifies *what* is being bought, while an approval reference specifies *which recorded decision* the backend should verify before moving money. Together with an idempotency token, the booking request needs only three identifiers to express that relationship:

- **Offer identity (`offerId`):** Connects the commitment to the specific price, version, and cancellation conditions.
- **Approval reference (`approvalId`):** Identifies the recorded decision accepting that exact offer.
- **Attempt identity (`attemptId`):** Scopes the logical booking attempt so network retries never create a duplicate purchase.

The page registers this capability using WebMCP’s [`registerTool()`](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) API, declaring all three parameters in its schema:

```javascript
await document.modelContext.registerTool({
  name: "book_ride",
  description: "Commits a ride with prior recorded approval. Never creates approval.",
  annotations: { readOnlyHint: false, consequentialHint: true },
  inputSchema: {
    type: "object",
    properties: {
      offerId: { type: "string", description: "The quoted ride offer to book" },
      approvalId: { type: "string", description: "Reference to the recorded fare approval" },
      attemptId: { type: "string", description: "Idempotency key for safe retries" }
    },
    required: ["offerId", "approvalId", "attemptId"],
    additionalProperties: false
  },
  execute: async ({ offerId, approvalId, attemptId }) => {
    return await api("/api/bookings", { offerId, approvalId, attemptId });
  }
});
```

Declaring these fields alongside `consequentialHint: true` makes the workflow's prerequisites legible to the agent host. Of course, a JSON schema only shapes the request; the server must still verify the approval record independently, including when a caller bypasses the WebMCP adapter altogether.

In practice, teams can expose two complementary tool contracts depending on how the assistant interacts with the page session:

- **Contract A — Explicit capability binding (`book_ride({ offerId, approvalId, attemptId })`):** Shown above. Requiring `approvalId` in `inputSchema` makes the prerequisite self-documenting to the model and supports workflows where the agent reads the active quote state—including its recorded `approvalId` once the user clicks accept—via a companion read tool or receives an explicit delegation token.
- **Contract B — Same-session server lookup (`book_ride({ offerId, attemptId })`):** Designed for in-page assistants operating within a single authenticated tab. The tool accepts `offerId` and `attemptId`, and the backend queries its store for an unexpired, unconsumed approval record matching the current user and that exact `offerId` version. Its tool description and structured error response (`APPROVAL_REQUIRED`) still enforce fare acceptance while keeping the tool signature minimal.

Neither contract treats a conversational claim or a client-supplied boolean (`approved: true`) as evidence. Both resolve against the same authoritative server-side record.

## Keep the screen and the action in sync

Sharing a browser tab only helps if the human interface and the registered WebMCP tools read from the same live application state. When an assistant prepares or commits an offer, it must act on the current viewmodel selection rather than a stale copy captured when the page first loaded. The same principle applies to search constraints: if the user filters the screen to show specific ride classes or departure windows, any tool advertised as acting on the current view should inherit those filters—or state explicitly in its contract that it searches the full catalog.

In our ride-booking flow, this means maintaining a single active offer in shared page state. If dynamic pricing replaces the quote with a new version, both the visual components and the WebMCP tool adapters immediately see the updated `offerId` and version, and any approval granted for the previous quote ceases to apply. Shared frontend state eliminates UI drift between the human and the assistant, while the backend remains the final arbiter—reloading the offer and approval at commit time to catch any state changes that occurred while the request was in flight.

## Enforce the conditions when booking

When the booking request reaches the server, the domain service first checks whether the caller's `attemptId` already matches a recorded outcome for that account. Only a new attempt proceeds to the fresh offer and approval check—verifying that both records match, remain within their time-to-live (TTL) window, have not already been consumed by a prior booking, and belong to the authenticated user.

```mermaid#wide Application-controlled approval is a demo assumption, not attestation of human presence.
sequenceDiagram
    participant A as Agent via page tool
    participant V as Shared page state
    participant UI as Application approval UI
    participant U as User
    participant S as Domain service
    A->>S: Request quote
    S-->>A: Offer, price, conditions and expiry
    A->>V: Sync selected offer (offerId, version)
    U->>UI: Review and approve offer
    UI->>S: Record approval for this offer
    S-->>UI: Approval reference (approvalId)
    UI->>V: Update shared state with approvalId
    V-->>A: Read synchronized offerId and approvalId
    A->>S: Book with offerId, approvalId and attemptId
    alt Existing matching attemptId
        S-->>A: Return recorded booking result
    else New attempt with valid, unconsumed offer and approval
        S->>S: Mark approval consumed, record attemptId and commit atomically
        S-->>A: Booking result
    else Expired, changed, consumed by another attempt or unauthorized
        S-->>A: Reject with a specific reason
    end
```

Notice how the visual UI and the programmatic tool coordinate around the shared viewmodel (`Shared page state`). After the assistant stages the €85 quote, the user reviews the surge warning in the page and clicks **Accept this fare**. The approval component records that decision with the server and writes the returned `approvalId` into the shared page state; the agent then reads the synchronized `offerId` and `approvalId` from that state (via a read tool or viewmodel binding) before invoking `book_ride`.

On the server, each approval record follows a tight lifecycle:

- **Short time-to-live (TTL):** Both the quote and its approval expire after a brief window (for example, two minutes), ensuring an approval granted during a temporary surge cannot linger indefinitely.
- **Single-use consumption (`approval.consumed = true`):** When the booking commits, the backend marks the approval record as consumed inside the same atomic transition so a valid `approvalId` can never be replayed to book a second car.
- **Version binding:** If a material condition changes or a new quote replaces the current one, the service rejects the stale reference and requires fresh approval for the new offer version.

These checks must hold atomically at the point of commitment. Verifying a price in one query and dispatching the ride against independently mutating state a moment later leaves a race window between verification and execution.

## Treat retries as normal

Network drops and client timeouts are routine in browser environments, especially when an assistant coordinates multiple steps. If an agent calls `book_ride`, the backend commits the ride, and the HTTP response is lost in transit, the agent will naturally retry—and repeating that call must never dispatch a second car.

```mermaid A retry returns the recorded outcome without creating another ride.
sequenceDiagram
    participant A as Agent via page tool
    participant S as Booking service
    participant D as Transaction store
    A->>S: Book using attempt K
    S->>D: Commit booking and record K atomically
    D-->>S: Booking B recorded
    S--xA: Response lost
    A->>S: Retry with attempt K and identical inputs
    S->>D: Look up account and attempt K
    D-->>S: Existing booking B
    S-->>A: Return booking B
    Note over S,D: No second booking is created
```

To make retries safe, the backend scopes each idempotency key (`attemptId`) to the authenticated account and the logical booking attempt. As Amazon’s [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) details, a retry carrying the same `attemptId` and identical parameters returns the stored outcome, while any attempt to reuse an existing key with different transaction parameters is rejected outright. When commitment depends on an external dispatch provider rather than a single local database transaction, approval consumption and booking state should be coordinated through a durable state machine so that an uncertain upstream response surfaces as an inspectable pending state rather than an invitation to start a new purchase.

## Give the agent useful outcomes and stateful cancellation

When a tool call fails or pauses, the agent needs structured domain outcomes—distinguishing cleanly between an expired offer, missing approval, an already-consumed approval, changed conditions, a pending booking, and a completed commitment. Clear machine-readable states allow the assistant to recover intelligently and explain the situation to the user without guessing or leaking internal account data.

Cancellation requires the same state-machine discipline because aborting an in-flight WebMCP tool call in the browser does not roll back work that has already crossed the server's commit boundary:

- **Pre-commit abandonment:** If the user or agent aborts while the offer is still staged (before `book_ride` commits), the server revokes the unconsumed `approvalId` or lets its short TTL expire.
- **In-flight or pending reconciliation:** If an external dispatch provider times out or partially fills a request, the booking enters an explicit `PENDING_CONFIRMATION` or `CANCELLATION_REQUESTED` state rather than resetting silently—preventing a retry loop from dispatching a duplicate vehicle.
- **Post-commit cancellation:** Once a booking commits, stopping the browser agent cannot undo it. The application must expose an inspectable booking record and a dedicated cancellation operation governed by the offer's disclosed cancellation terms.

## Keep WebMCP’s role clear

Throughout this architecture, WebMCP tools act as in-browser adapters to the domain workflow. Their declarations follow the specification’s [`ModelContextTool` dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [`registerTool()` operation](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool), describing whether a capability stages a quote or commits a booking and attaching metadata such as `readOnlyHint`, `untrustedContentHint`, and `consequentialHint` (see the [WebMCP tool annotations](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) and [Chrome’s security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)). Those annotations help the agent host reason about side effects, while the backend service enforces the offer and approval rules uniformly across human, agent, and API entry points alike.

## Demonstrate the boundaries

A transaction architecture proves its worth by handling edge cases and failure modes as predictably as the happy path:

- An unchanged, approved offer produces exactly one booking.
- A changed price or replaced quote version requires fresh approval.
- An expired offer or expired approval is rejected at commit time.
- An approval record belonging to another account is rejected.
- A retried request with the same `attemptId` returns the original booking outcome.
- A lost response reconciles cleanly without triggering a duplicate purchase.

None of these invariants are exotic; they are established transaction-design principles applied to a dual-audience interface. WebMCP makes application capabilities effortless for an in-browser assistant to invoke, while a two-phase transaction model preserves user authority from the initial quote through to the final commitment.

## Explore the working example

The first example in the [companion repository](https://github.com/gfilardo/gf-notebook-examples)—***WebMCP: The two-phase approval pattern***—puts this architecture into a runnable ride-booking application. Two side-by-side lanes compare the human confirmation step with the agent’s programmatic booking flow, and a toggle switches between the naive service from Part 2 and the two-phase approval store built here—complete with controls to test fare changes, TTL expiry, revocation, and idempotent retries.

The repository’s README includes setup instructions, the full WebMCP tool definitions, and automated verification checks. All transactions are simulated locally without external AI models or payment rails. Notice one important boundary in the prototype: recording approval through an in-page endpoint enforces our business invariants, but it does not by itself prove that a human—rather than browser automation—clicked the confirmation button. Request-origin defenses address cross-site forgery (see [OWASP’s CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)), whereas verifying *who* approved the transaction requires examining delegation and hardware presence directly.

## Looking ahead: approved by whom?

This two-phase architecture answers our first question: **was this specific offer approved?** By binding commitment to a versioned `offerId`, a single-use `approvalId`, and an idempotent `attemptId`, the backend closes the accidental shortcut from Part 2.

Yet verifying that an approval record exists in the database immediately raises our second question: **approved by whom?** If a passenger had to pause and manually click **Accept this fare** for every routine €25 commute, an assistant would quickly become a chore. Conversely, for an €85 surge fare or an irreversible wire transfer, what stops an overly eager browser agent from scripting the DOM to click that approval button itself?

In Part 4, we examine **who can confirm on the user’s behalf**—and how financial systems scale confirmation across a multi-dimensional risk framework from standing thresholds and delegated tokens up to hardware-backed transaction signing.

## References and further reading

- [WebMCP tool definition](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [registration API](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) — the browser adapter contract.
- [WebMCP annotation dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) — exact metadata fields; consult browser implementation support separately.
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — annotation guidance and restrictions on tool exposure.
- [OWASP: Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to transaction data.
- [Amazon Builders’ Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — caller request identifiers, atomicity and changed-input handling.
- [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — what request-origin defenses address, distinct from proof of user approval.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation and agent-host behavior should be checked separately.*
