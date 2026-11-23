---
id: decentralized-timestamps-pt1
title: "Decentralized timestamps: proving existence and authorship"
author: "Giovanni Filardo"
slug: proving-existence-and-authorship-on-decentralized-ledgers
date: "2026-11-23"
description: "A first-principles guide to proving when a digital document existed and who created it, decoupling identity from crypto wallets, and evaluating ledger longevity."
tags:
  - architecture
  - cryptography
  - bitcoin
  - blockchain
  - software
series:
  id: decentralized-timestamps
  title: "Decentralized timestamps"
  part: 1
featured: true
---

Whenever you publish an original technical specification, release open-source research, or record a digital commitment, you encounter an old and persistent problem in computer science: **how to prove priority**.

Specifically, if a dispute arises over prior art, copyright, or chronological precedence, you must be able to prove two distinct properties to an untrusted third party:

1. **Anteriority (Proof of prior existence)**: That a specific set of bytes existed at or before a verifiable point in time.
2. **Attribution (Proof of commitment and identity)**: That a specific identity created or endorsed those bytes, rather than merely observing and redistributing them after the fact.

In an era where digital content is easily replicated, scraped, and ingested into automated models within minutes of publication, relying on informal conventions of priority is no longer sufficient. Establishing verifiable, mathematical prior art has become a practical necessity.

Yet the methods most engineers instinctively reach for—Git commit history, server logs, or centralized timestamping services—fail under basic adversarial scrutiny.

This article explores the cryptographic principles required to prove existence and authorship independently, examines why embedding documents directly into blockchain transactions introduces severe operational flaws, and evaluates which decentralized networks can reliably preserve verification across decades.

---

## Why conventional timestamps fail

Digital systems are mutable by default. Almost all conventional mechanisms for establishing time and origin can be forged, manipulated, or erased without leaving a trace:

* **The Git commit fallacy**: Committing code or prose to a Git repository does not prove when it was written. Git metadata fields are unauthenticated strings. Setting `GIT_COMMITTER_DATE="2018-01-01 12:00:00" git commit --amend` retroactively rewrites history in seconds. Rebasing, squashing, or force-pushing can alter an entire project timeline without violating Git's internal integrity checks.
* **Server logs and filesystem metadata**: Filesystem timestamps (`mtime`, `ctime`) and web server access logs are entirely under the control of the host machine's administrator. They carry zero evidentiary weight in a formal priority dispute.
* **Centralized Timestamping Authorities (RFC 3161)**: Traditional digital timestamping relies on a trusted third party (a Timestamping Authority, or TSA) signing a document digest with an X.509 certificate. However, this model introduces vendor lock-in and temporal fragility. Certificates expire, TSAs go out of business, and their root authorities can be compromised or revoked.
* **Web archives**: Public archival caches such as the Wayback Machine provide useful historical convenience, but they are not cryptographic trust anchors. Domain owners can retroactively suppress or remove historical snapshots by updating a `robots.txt` exclusion rule, and centralized repositories remain vulnerable to administrative redaction and infrastructure failure.

Proving that a digital artifact existed at a specific moment requires anchoring its cryptographic digest into a medium that no single entity—including the author—can manipulate retroactively.

---

## Two models: wallet-bound versus decoupled timestamps

Public blockchains solve this by acting as decentralized, append-only ledgers: once a block is confirmed by network consensus, no single participant can alter its historical contents. To anchor a document's fingerprint to such a ledger, two architectural approaches have emerged: directly writing transaction records from a cryptocurrency wallet, or aggregating hashes off-chain and anchoring a single Merkle root—a master "hash of hashes" summarizing thousands of independent digests—to a blockchain.

### 1. The direct blockchain model (wallet-bound)

The standard approach in many blockchain implementations is to compute a SHA-256 hash of a file and embed it directly into a transaction—for example, using an `OP_RETURN` script (a standard transaction output instruction that records a small data payload without creating spendable coins) or a smart contract call.

```mermaid#narrow The direct blockchain model: on-chain hashing and wallet-bound transactions.
flowchart TD
    subgraph AUTHOR["Author Environment"]
        DOC["Digital Document"] --> HASH["Compute SHA-256"]
        WALLET["Funded Crypto Wallet"]
    end

    subgraph TX_LAYER["Transaction Layer"]
        WALLET -->|Signs TX & Pays Gas Fee| TX["L1 Transaction<br/>(OP_RETURN / Contract Call)"]
        HASH --> TX
    end

    subgraph L1["Public Blockchain"]
        TX --> BLOCK["Mined Block<br/>(L1 Consensus Timestamp)"]
    end
```

In this model, the transaction itself serves as both timestamp and signature:
- **Anteriority** is established by the timestamp of the confirmed block.
- **Attribution** is bound directly to the cryptocurrency wallet that broadcasts the transaction. Because every blockchain transaction must be cryptographically signed by the private key controlling that address, nobody else can broadcast an `OP_RETURN` from your wallet. If your wallet address is publicly recognized as yours, impersonation is natively prevented.

While conceptually straightforward, using your cryptocurrency wallet as your signing identity introduces serious practical drawbacks:
1. **Financial friction**: Every document timestamp or revision incurs an on-chain transaction fee. If network fees spike, publishing or updating a document becomes suddenly expensive.
2. **Key management overhead**: Authors must maintain funded cryptocurrency wallets, manage seed phrases, and choose between exposing a hot-wallet private key to automated publishing scripts or manually signing a financial transaction on a hardware/air-gapped wallet for every revision.
3. **Loss of privacy**: The author's personal or corporate identity becomes permanently linked on a public ledger to a specific financial address, exposing wallet balances and transaction history to public block explorers.
4. **State bloat**: Writing individual document hashes directly onto an L1 chain forces every full node worldwide to permanently store personal metadata in their global state.

### 2. The OpenTimestamps model (decoupled and aggregated)

The alternative architecture—standardized by **OpenTimestamps (OTS)**, designed by Peter Todd—solves these problems by cleanly decoupling the proof of identity from the proof of anteriority.

```mermaid#narrow The OpenTimestamps model: off-chain Merkle aggregation anchored to a public blockchain.
flowchart TD
    subgraph LOCAL["Author Environment (Zero Fees)"]
        DOC["Original Document"] --> BUNDLE["Payload + Author Attribution"]
        BUNDLE --> HASH["Initial Leaf Hash"]
    end

    subgraph CALENDAR["Calendar Servers (Off-Chain)"]
        HASH --> TREE["Off-Chain Merkle Tree"]
        OTHERS["Other Users' Hashes"] --> TREE
        TREE --> ROOT["Aggregated Merkle Root"]
    end

    subgraph CHAIN["Blockchain Consensus"]
        ROOT --> TX["Single L1 Transaction<br/>(Funded by Calendar)"]
        TX --> BLOCK["Confirmed Block<br/>(Consensus Timestamp)"]
    end

    subgraph PROOF["Verifiable Proof"]
        BLOCK -.-> RECEIPT["Detached .ots Receipt<br/>(< 1 KB Merkle Path)"]
    end
```

Rather than submitting transactions directly from a crypto wallet, the process separates into three distinct components:

1. **Off-chain attribution inside the hashed payload**: Instead of using a cryptocurrency wallet as an identity, the author includes attribution directly in the payload being hashed—either by embedding the author's name and metadata inside the document itself, or (when non-repudiation is needed) bundling a detached digital signature:
   ```text
   Initial Hash = SHA-256(document payload)
   ```
2. **Scalable aggregation via Merkle trees**: The author submits the initial hash to a federated OpenTimestamps calendar server. The calendar server collects thousands of independent hashes from other users and structures them into an off-chain Merkle tree. Intermediate hashes are iteratively combined until a single root hash is produced.
3. **Anchoring to a public blockchain**: The calendar server commits this single Merkle root into a public blockchain via an ordinary transaction.

This produces a clean separation of concerns:
* **Anteriority** is derived from the confirmed block header that seals the Merkle root. Because block header timestamps are governed by network consensus rules, the block serves as an immutable proof of prior existence with an approximate reference time, rather than a precision atomic clock.
* **Attribution** lives entirely off-chain inside the hashed leaf payload—either as an embedded author statement in the document itself or an optional off-chain signature—without touching a cryptocurrency wallet.

Crucially, keeping attribution in the off-chain leaf payload is necessary **specifically because of aggregation**. In OpenTimestamps, the single on-chain transaction is funded and signed by the calendar server operator, not by your personal wallet. Because the blockchain transaction no longer carries your wallet signature, the ledger proves that the Merkle root existed by that block while keeping your financial identity, storage medium, and publishing workflow completely decoupled from the blockchain.

### The zero-fee economics: why authors pay nothing

Anchoring proofs to a public blockchain immediately raises a practical question: *Does this require a crypto wallet, and who pays the transaction fees?*

In OpenTimestamps, the financial cost to the submitter is **zero**:

* **Zero cryptocurrency or wallets**: Authors never purchase tokens, handle private keys with funds, or manage seed phrases.
* **Zero account overhead**: There are no API keys, accounts, or credit card subscriptions. Stamping is simply an unauthenticated HTTP `POST` sending 32 binary bytes to public calendar pools (`a.pool.opentimestamps.org`, `b.pool.opentimestamps.org`, etc.).
* **Batching subsidizes the blockchain fee**: The calendar servers combine incoming digests into off-chain Merkle trees. Every few hours, the calendar operator broadcasts a single on-chain transaction carrying the Merkle root in an `OP_RETURN` output.
* **Public good infrastructure**: OpenTimestamps is free to the submitter because calendar operators (such as Peter Todd and fellow infrastructure maintainers) bear the on-chain transaction fees of committing aggregate Merkle roots to the blockchain. Funded as public infrastructure, a single transaction fee is amortized across hundreds of thousands of documents, reducing the marginal cost per submission to effectively zero.

This model introduces two practical trade-offs:
* **Batching latency**: Instead of paying transaction fees for immediate next-block inclusion, authors receive an instant "pending" receipt, and the proof anchors permanently a few hours later when the calendar's batch transaction is confirmed.
* **Calendar concentration at submission time**: The public OpenTimestamps calendar pool is operated by a small number of maintainers, which introduces a degree of centralization during the stamping and upgrading window. Crucially, however, this dependency is limited to **service availability (liveness), not cryptographic trust**: calendar servers cannot forge or backdate a timestamp, and once a receipt is upgraded with its completed Merkle path (`.ots`, typically under 1 KB), the calendar servers drop out of the verification equation entirely. Even if every calendar server went offline permanently tomorrow, all existing upgraded proofs would remain verifiable forever against the blockchain headers alone.

### Is anteriority alone enough? Why not just put your name in the text?

A practical question immediately arises: *If I embed my name and website directly into the document metadata (e.g. `author: Giovanni Filardo`) and anchor the raw payload's SHA-256 into a blockchain, doesn't that prove both existence and authorship? If a plagiarist steals my content, they can never produce an earlier block. Why bother with asymmetric signatures at all?*

For real-world copyright disputes and prior-art claims, **putting your name directly in the payload and timestamping it is not only sufficient—it has higher long-term value than a private key signature.**

Consider what an adversary faces:
* If an attacker downloads your document and its `.ots` receipt to claim priority, they are holding a cryptographic receipt that seals a payload which literally names you as the author.
* If the attacker edits the payload to change your name to theirs, the SHA-256 hash changes completely, and your existing `.ots` proof immediately fails verification.
* If the attacker creates a *new* `.ots` proof with their name on it, their block confirmation will be recorded hours, days, or years **after** yours. The blockchain mathematically proves who was first.

Even more importantly, ask yourself: **what happens if someone steals your private key, or you lose it?** A private key is a fragile external secret. If a key is lost, rotated, or compromised, a signature adds no advantage over having the author name inside the timestamped bytes. Furthermore, embedding attribution inside the payload is completely agnostic to how the information is stored: it works identically for a Markdown file on disk, a serialized article record in a database, or an archived PDF.

In most publishing and engineering workflows, a detached private key signature can be overkill. Embedding the author name directly into the source payload achieves the evidentiary goal of prior-art protection without requiring authors or readers to maintain cryptographic keyrings or depend on external code-hosting platforms.

### The two-step verification penalty

There is an even more compelling architectural reason to prefer embedded authorship over detached signatures: **verification friction**.

If you require a detached cryptographic signature (`SIG(doc, pk)`), verification becomes a cumbersome two-step ceremony:
1. **Key and signature audit**: The verifier must locate your public key, establish trust in that key (often relying on third-party key servers, DNS records, or web archives that may decay over time), and run GPG or OpenSSH verification commands.
2. **Blockchain audit**: The verifier must then run the OpenTimestamps client to verify the cryptographic path connecting the signature to a confirmed block.

In long-term digital preservation, complexity is the enemy of permanence. The more ceremony and external tooling required to verify a claim thirty years from now, the less likely anyone is to audit it.

In contrast, when the author identity is embedded directly into the payload and timestamped as raw bytes, verification collapses into a single, friction-free operation:

```bash
ots verify document.md.ots -f document.md
```

Any reader on any consumer operating system can verify the text, metadata, and author attribution in a single command, without managing keys, importing certificates, or relying on external identity directories.

### Claiming versus rejecting authorship: where signatures actually matter

If embedding your name in an anchored document defeats plagiarism, when does an asymmetric signature (`SIG(doc, pk)`) actually matter?

The answer depends on the **direction of the dispute**—whether you are *claiming* authorship or *rejecting* it—and whether you are available to confirm your own work:

My willingness to stand behind an article suffices when someone can ask me directly. A signature earns its keep when a reader needs to verify an endorsement independently—for example, if someone publishes a fake release under my name, or if I am unavailable to confirm which version I actually endorsed.

* **Claiming authorship (prior art and anti-plagiarism)**: Suppose a plagiarist claims they wrote your article. To make that case, they must explain why the earliest anchored document on the blockchain already contains *your* name inside the hashed bytes, while no earlier timestamp exists with theirs. The timestamp is what establishes the order of the versions and preserves your byline; signing it would only add an independent way for third parties to authenticate your endorsement without asking you.
* **Rejecting authorship (non-repudiation and binding commitments)**: Now flip the dispute. Suppose a party signs a contract, an order, or a security advisory, and later tries to disown it: *"I never agreed to that—anybody could have typed my name into a file and timestamped it."* Because anyone can type someone else's name into a plain-text document, an embedded name cannot bind someone who tries to repudiate a commitment, nor can it stop an imposter from publishing a fake advisory under your name. This is where cryptographic signatures are genuinely valuable: proving affirmative endorsement so a signer cannot credibly claim *"anybody could have done it."*
* **What a signature still cannot prove (the plausible deniability trap)**: Even with a signing key, the *absence* of your signature on an anonymous or defamatory document does not prove you didn't write it. An accuser can always argue: *"You signed your official releases, and then authored this unsigned piece specifically to preserve plausible deniability."*

Cryptography only attests to operations performed with a key; it cannot prove a negative about what a human did without one.

In the direct blockchain model, your on-chain wallet signature binds the transaction natively, but at the cost of gas fees and wallet-signing friction. In OpenTimestamps, the calendar operator signs the on-chain transaction to keep the service free and private. An optional off-chain signature is only needed when you require non-repudiation or an authenticated release channel—whereas for claiming authorship and priority, the author name embedded directly inside the timestamped bytes is the primary, enduring proof.

| Dimension | Embedded Name + Timestamp (OTS) | Asymmetric Signature (SSH / GPG) |
| :--- | :--- | :--- |
| **Dispute Direction** | **Claiming authorship**: You want to prove the work is yours and you were first. | **Rejecting authorship (Non-repudiation)**: Holding a signer to a commitment they want to disown, or authenticating an official channel. |
| **Why It Works** | A plagiarist cannot explain why your name is sealed in the earliest confirmed block with no prior record under their name. | Nobody without the private key can produce the signature, defeating the *"anybody could have typed my name"* excuse. |
| **Inherent Limitation** | Anyone can type someone else's name into a new file, so a plain-text name cannot force non-repudiation. | Keys can be lost or stolen, and the absence of a signature cannot prove you didn't write an unsigned document. |

### The temporal protection of key compromise

A common anxiety with private keys is: *What happens if my key is stolen? Does an attacker gain the ability to forge all my past writings?*

First, when you rely on your author attribution embedded directly inside the timestamped document rather than a private key, there is no key to steal. Your historical proofs cannot be compromised by a credential leak because they depend solely on SHA-256 and blockchain consensus.

Second, even in workflows that do combine asymmetric signatures with blockchain timestamps (such as signed software binaries), past timestamps remain immune to future key compromise. If an attacker compromises a machine and steals a signing key today, they can produce signatures from today onward, but they cannot backdate their theft. To forge historical records, the attacker would have to insert their new hash into blocks confirmed months or years in the past—which is computationally infeasible once settled under network consensus. The blockchain timestamp acts as a strict cryptographic cutoff date.

---

## The 30-year ledger longevity test

Up to this point, the decoupled Merkle-aggregation architecture is ledger-agnostic: in principle, a calendar server can anchor its root hash into any public blockchain. However, a timestamp is only as dependable as the network that preserves it. If you need to verify a document thirty years from now, the verification process must not depend on fragile token economics, pruning nodes, or centralized storage services.

When evaluated against multi-decade permanence, most decentralized architectures fall short:

| Network / Approach | Consensus / Storage Model | Longevity Risk |
| :--- | :--- | :--- |
| **Kaspa (KAS)** | High-throughput GHOSTDAG / blockDAG | Standard Kaspa nodes prune historical block data aggressively to maintain high block rates. Historical proofs become unverifiable to ordinary users unless they locate and query rare, dedicated archival nodes. Proposal KIP6 aims to address this problem. |
| **Ravencoin (RVN)** | Native asset layer (32-byte metadata payload) | While RVN natively supports attaching arbitrary metadata to tokens, its long-term economic security and hash-rate viability present severe risks of 51% reorganizations or chain abandonment. |
| **Ethereum / EVM** | Smart contract storage (`SSTORE`) | Ethereum storage incurs high L1 gas fees. Layer-2 rollups introduce centralized sequencers, contract upgradeability keys, and multi-signature bridge assumptions that complicate multi-decade verification. |
| **Solana** | High-speed monolithic consensus | Extreme state generation forces validators to purge transaction history, offloading raw blocks to external cloud storage (BigQuery) or decentralized bridges. It cannot support lightweight, self-contained offline verification. |
| **IPFS / Filecoin** | Decentralized content addressing | IPFS is an addressable storage protocol, not an immutable clock. To keep content accessible, you must continuously pay monthly fees to pinning services or run an always-on daemon. If pinning lapses, the content disappears. |
| **Bitcoin (via OpenTimestamps)** | Proof-of-Work Nakamoto Consensus | The most secure, energy-dense, and conservative computational network on Earth. By embedding only the 32-byte Merkle root into an `OP_RETURN`, it leverages Bitcoin's multi-decade immutability with zero state bloat. |

Bitcoin is the only public ledger with nearly two decades of continuous, unbroken Proof-of-Work history. Its block header timestamps are strictly bounded by consensus rules (each block's timestamp must exceed the median time of the previous 11 blocks and cannot exceed network-adjusted time by more than two hours), and an upgraded OpenTimestamps proof requires only the 80-byte Bitcoin block headers to verify the Merkle path. 

To verify a document thirty years from now, a future reader needs to retain only three artifacts:
1. **The original bytes**: The unedited payload (whether preserved as a file, a serialized database record, or a local archive).
2. **The detached proof (`.ots`)**: The cryptographic receipt containing the Merkle path connecting your payload's digest to the Bitcoin block header.
3. **A trusted view of Bitcoin block headers**: At 80 bytes per header across roughly 975,000 blocks, the entire chain of Bitcoin headers since the genesis block occupies approximately 78 MB. A verifier can check the proof completely offline on a standard laptop without querying third-party APIs or running a multi-hundred-gigabyte archival node.

### The quantum horizon: why hash-only timestamps endure

Evaluating multi-decade permanence also requires accounting for cryptographically relevant quantum computers.

In quantum computing theory, cryptographic primitives face two very different threat profiles:

* **Asymmetric cryptography (public keys)**: Algorithms based on prime factorization or discrete logarithms—such as RSA, ECDSA, and Ed25519—are fundamentally vulnerable to Shor's algorithm. When large-scale quantum computers emerge, public-key digital signatures can theoretically be forged.
* **Cryptographic hash functions**: Unkeyed hash functions like SHA-256 are subject only to Grover's algorithm, which provides a quadratic speedup for brute-force search. Against SHA-256, this merely reduces effective preimage security from 256 bits to 128 bits. In practical terms, $2^{128}$ operations remains physically impossible to brute-force under known physics, requiring more energy than the lifetime output of multiple stars.

This distinction provides a decisive architectural advantage for OpenTimestamps: **an OpenTimestamps proof is built entirely on hash functions.**

There are no elliptic curves, no RSA keys, and no public-key signatures inside the timestamp proof. From the leaf document digest, through the intermediate calendar Merkle nodes, to the Bitcoin transaction Merkle tree and the final block header Proof-of-Work, every single cryptographic link is pure SHA-256.

Even if quantum computers break wallet private keys in twenty years, they cannot retroactively rewrite historical OpenTimestamps records. To forge an earlier timestamp, an attacker would have to compute a SHA-256 collision or preimage—a task that remains quantum-resistant.

This also reinforces the architectural elegance of embedding the author's identity directly into the payload's text (whether in file frontmatter or a database record) rather than relying on detached digital signatures: both the content and the author attribution are sealed into a single, **100% hash-based artifact that naturally inherits post-quantum permanence**.

---

## Universal principles in practice

The combination of embedded attribution, Merkle aggregation, and Proof-of-Work anchoring provides a universal, storage-agnostic framework for proving digital priority:

```text
Provable Record = Payload + Embedded Author ──(SHA-256)──> Merkle Root ──(anchored in)──> Bitcoin Block
```

This framework applies universally across domains:
* **Legal and corporate contracts**: Establishing execution dates without relying on proprietary, fee-charging e-signature platforms.
* **Software releases and security advisories**: Providing cryptographic proof that a security patch or binary release existed prior to a specific vulnerability disclosure.
* **Academic and technical writing**: Securing immutable prior art for research papers, patent disclosures, and engineering essays.

In the next part of this series (*Implementing decentralized timestamps*), we move from theoretical principles to practical software engineering. Using static site generation as a real-world case study, we examine how to automate this pipeline: resolving the canonicalization trap, designing an asynchronous local manifest state machine, and verifying proofs deterministically.
