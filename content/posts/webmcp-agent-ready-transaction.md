---
id: webmcp-agent-ready-transaction
title: "WebMCP: Building an agent-ready transaction"
author: "Giovanni Filardo"
slug: webmcp-agent-ready-transaction
date: "2026-11-01"
description: "A proposed quote, approval, and booking architecture that preserves user authority through execution."
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

> Fixing the unintentional dark pattern from the previous article requires more than a frontend prompt. To answer our first core question—*“Was this specific offer approved?”*—an agent-ready transaction requires three deliberate architectural investments:
> - **A decoupled quote service:** Versioned, short-lived offer records that lock in explicit material terms, cancellation conditions, and a strict time-to-live (TTL).
> - **A transactional approval and idempotency store:** Single-use approval records bound to the offer version, paired with caller-scoped idempotency keys (`attemptId`) in an atomic commit state machine.
> - **A synchronized in-page tool adapter:** Dual-surface WebMCP tool declarations (`document.modelContext.registerTool`) that share live viewmodel state with the human UI while delegating final enforcement to the backend.

A useful way to explore WebMCP is to take one consequential workflow and make its assumptions explicit.

For this example, the workflow is the ride booking from Part 2. The user receives an €85 surge offer, approves it through an application-controlled path, and asks the assistant to complete the booking.

The design below is a reference application architecture. WebMCP exposes the in-browser capabilities; the backend service remains authoritative for offers, approval lifecycle, and idempotent execution.

## Start with the offer

The first operation creates a quote containing the facts needed for a decision:

| Fact | Purpose |
| --- | --- |
| Offer identity | Connect subsequent approval and booking to the same offer |
| Journey and service | Establish what will be purchased |
| Total price and currency | Make the financial commitment explicit |
| Material cancellation conditions | Describe an important consequence |
| Expiry | Bound how long the offer remains usable |
| Offer version | Detect changes to the agreed conditions |

The application must distinguish a binding quote from an estimate. If the final price can vary, that variability and any applicable cap belong in the offer.

Both the human view and the agent result should derive from these business facts.

## Establish approval through a trusted path

For the initial implementation, use a confirmation flow controlled by the application.

It presents the offer, collects approval, and records which user approved which version. The server establishes the approval record; the booking caller cannot manufacture one by supplying a boolean.

This design deliberately starts with transaction-specific approval. Supporting external delegated authority would require another explicit design: who issues it, how it is verified, which conditions it covers, and how it is revoked.

A reference to an approval record is not sufficient by itself. The backend must also check its relationship to the authenticated user, the offer, and the permitted operation. This applies OWASP’s [transaction-authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html): enforce authorization server-side and protect the significant transaction data against modification.

## Put the approval prerequisite in the tool contract

An offer identity says what to buy. An approval reference says which recorded decision the application should verify. The tool contract should carry both rather than expose an unexplained commit operation.

The booking request needs only three identifiers to express that relationship:

- **Offer identity (`offerId`):** Connects the commitment to the specific price and conditions.
- **Approval reference (`approvalId`):** Identifies the recorded decision to accept that offer.
- **Attempt identity (`attemptId`):** Scopes this booking request, so retrying it does not create another purchase.

The page registers this capability using WebMCP’s [`registerTool()`](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) API, declaring all three as required parameters:

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

The schema and the `consequentialHint` annotation make the prerequisites visible to the agent host. A required input schema cannot prove that the supplied approval is genuine or valid; the server must verify the record independently, including when a caller bypasses the tool altogether.

In practice, applications can expose two intentional, complementary tool contracts depending on how the agent interacts with the session:

- **Contract A — Explicit capability binding (`book_ride({ offerId, approvalId, attemptId })`):** Shown above. Requiring `approvalId` directly in `inputSchema` makes the prerequisite self-documenting to the model and supports workflows where the agent reads the approval token from shared state or receives an explicit delegation reference.
- **Contract B — Same-session server lookup (`book_ride({ offerId, attemptId })`):** Designed for in-page agents operating strictly within an active authenticated session. The tool accepts `offerId` and `attemptId`, and the backend queries its store for an unexpired, unconsumed approval record matching the authenticated user and that exact `offerId` version. Its tool description and structured error response (`APPROVAL_REQUIRED`) still enforce fare acceptance, while keeping the tool signature minimal.

Neither contract treats a caller’s conversational claim or a boolean flag (`approved: true`) as evidence. Both resolve against the same server-side approval record.

## Keep the screen and the action in sync

The visible quote and the tool’s offer should come from the same application data, identified by the offer and its version. When the agent acts, it should use the current selection rather than an old copy retained when the page first loaded.

The same applies to constraints: if the page shows a filtered selection, a tool advertised as acting on that selection should use the same filters. If it deliberately searches more broadly, its contract should say so. Sharing the page does not automatically keep those selections aligned.

For the ride, that means a single selected offer shared by the screen and agent action. If a new offer replaces it, both paths must use the new selection. An approval for the old offer must not silently move across to the new one.

Shared frontend state prevents one kind of drift. The backend remains authoritative: it reloads the offer and approval and checks their current validity at commitment. A perfectly synchronized screen can still become stale before its request reaches the service.

## Enforce the conditions when booking

The booking service loads the authoritative offer and approval. It verifies that they match, remain within their time-to-live (TTL) window, have not already been consumed, and cover the requested action.

```mermaid Application-controlled approval is a demo assumption, not attestation of human presence.
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
    alt Offer and approval remain valid and unconsumed
        S->>S: Mark approval consumed and commit atomically
        S-->>A: Booking result
    else Expired, changed, consumed or unauthorized
        S-->>A: Reject with a specific reason
    end
```

Notice how the UI and the agent stay coordinated: when the user approves the €85 quote in the page, the approval component writes the returned `approvalId` into the shared frontend viewmodel (`Shared page state`). The in-page WebMCP tool reads the current `offerId` and `approvalId` from that shared state before calling the booking endpoint.

On the server, each approval record follows a strict lifecycle:

- **Short time-to-live (TTL):** Both the quote and its approval expire after a tight window (for example, 2 minutes), ensuring an approval granted during a brief surge cannot linger indefinitely.
- **Single-use consumption (`approval.consumed = true`):** When the booking commits, the backend marks the approval record as consumed inside the same atomic transition. A valid `approvalId` can never be replayed to book a second ride.
- **Version binding:** If a material condition changes or a new quote replaces the current one, the service rejects the stale reference and requires fresh approval for the new offer version.

The check must hold at the point of commitment. Checking a price and then booking against independently changing state would leave a race between verification and execution. The implementation needs an atomic transition or an equivalent guarantee from the booking provider.

## Treat retries as normal
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


An agent calls the booking tool. The booking succeeds, but the response is lost.

Repeating the request must not create a second ride.

Use an idempotency mechanism scoped to the authenticated account and logical booking attempt. The same request returns the established outcome; reuse with different transaction details is rejected. Amazon’s [Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) explains caller-scoped request identifiers, equivalent retry responses and rejection when a caller reuses an identifier with different parameters.

Approval consumption and booking state also need to be coordinated. With an external provider, the workflow may require a durable state machine and reconciliation rather than one database transaction.

An uncertain response should produce an inspectable pending state, not an invitation to start another purchase.

## Give the agent useful outcomes and stateful cancellation

The tool should distinguish between an expired offer, missing approval, already-consumed approval, changed conditions, a pending booking, and a completed booking.

These outcomes tell the agent what the application actually knows. They should also support a human-readable explanation without exposing unnecessary personal information.

Cancellation needs an explicit state machine of its own. Aborting an in-flight WebMCP tool call in the browser does not roll back work that has already crossed the server's commit boundary:

- **Pre-commit abandonment:** If the user or agent cancels while the offer is still staged (before `book_ride` commits), the server simply revokes the unconsumed `approvalId` or lets its TTL expire.
- **In-flight or pending reconciliation:** If an external dispatch provider times out or partially fills a request, the booking enters an explicit `PENDING_CONFIRMATION` or `CANCELLATION_REQUESTED` state rather than silently resetting—preventing the agent from assuming the booking failed and dispatching a duplicate car.
- **Post-commit cancellation:** Once a booking is committed, stopping the agent cannot undo it. The application must expose an inspectable booking record and a dedicated cancellation operation subject to the offer's disclosed cancellation terms.

## Keep WebMCP’s role clear

The browser-facing tools are adapters to the application workflow. Their declarations follow the draft’s [`ModelContextTool` dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [`registerTool()` operation](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool). These API definitions do not supply the application’s offer or approval model.

They should describe whether a capability retrieves an offer or commits a booking, expose material results, and use appropriate annotations. The domain service should enforce the same rules for human, agent, and other supported entry points.

The annotations help an agent reason about a capability. They do not replace the approval record or execution checks. The draft defines `readOnlyHint`, `untrustedContentHint`, `consequentialHint` and `debugging` under `annotations`. See the [WebMCP tool annotations](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) and [Chrome’s security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools).

## Demonstrate the boundaries

A small prototype becomes persuasive when it shows failure cases as clearly as the successful path:

- An unchanged approved offer produces one booking.
- A changed price requires the applicable fresh approval.
- An expired offer cannot be booked.
- Approval belonging to another account is rejected.
- A retried request returns the original outcome.
- A lost response can be reconciled without another purchase.

These are established transaction-design concerns applied to a new interaction model.

WebMCP makes application capabilities easier for agents to invoke. An agent-ready architecture makes the meaning and authority behind those invocations explicit—and preserves them through to the final commitment.

## Explore the working example

An [accompanying working example](https://github.com/gfilardo/gf-notebook-examples) puts this architecture into a small ride-booking application. Two lanes compare the human acceptance step with the agent’s direct booking request. A switch selects a flawed service that assumes approval or a corrected one that checks it. Additional controls demonstrate changed fares, expiry, revocation and safe retries.

The repository’s README links to the example, full source and setup instructions. The implementation includes the complete WebMCP tool definitions and automated checks, so the article can keep the code brief. All bookings are fictional; no real payment or AI model is involved. Native browser-agent compatibility remains a separate manual check.

The example records approval in the application, but that does not prove that a human rather than browser automation created it. Request-origin checks address a different problem, as described in [OWASP’s CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). A deployment that needs stronger assurance must establish a trustworthy approval mechanism as well as enforce its records.

## Looking ahead: approved by whom?

This two-phase architecture answers our first fundamental question: **was this specific offer approved?** By binding commitment to a versioned `offerId`, a single-use `approvalId`, and an idempotent `attemptId`, the backend eliminates the accidental shortcut from Part 2.

Yet verifying that an approval record exists in the database immediately raises a second question: **approved by whom?**

If a passenger had to pause and manually click **Accept this fare** for every routine €25 commute, an autonomous assistant would quickly become a chore. Conversely, for an €85 surge fare or an irreversible wire transfer, what stops an aggressive browser agent from simply scripting the DOM to click that approval button itself?

In the next article, we examine **who can legitimately confirm on the user’s behalf**—and how banks scale confirmation from standing thresholds and delegated tokens up to hardware-backed transaction signing.

## References and further reading

- [WebMCP tool definition](https://webmachinelearning.github.io/webmcp/#dictdef-modelcontexttool) and [registration API](https://webmachinelearning.github.io/webmcp/#dom-modelcontext-registertool) — the browser adapter contract.
- [WebMCP annotation dictionary](https://webmachinelearning.github.io/webmcp/#dictdef-toolannotations) — exact metadata fields; consult browser implementation support separately.
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — annotation guidance and restrictions on tool exposure.
- [OWASP: Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html) — server-side enforcement and binding approval to transaction data.
- [Amazon Builders’ Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) — caller request identifiers, atomicity and changed-input handling.
- [OWASP: CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) — what request-origin defenses address, distinct from proof of user approval.

*Documentation checked on 30 October 2026. WebMCP is evolving; specification text, browser implementation and agent-host behavior should be checked separately.*
