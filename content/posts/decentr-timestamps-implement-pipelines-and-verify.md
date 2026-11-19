---
id: decentralized-timestamps-pt2
title: "Implementing decentralized timestamps: pipelines, state machines, and verification"
author: "Giovanni Filardo"
slug: implementing-decentralized-timestamps-pipelines-and-verification
date: "2026-11-09"
description: "How to engineer an automated, zero-cost OpenTimestamps pipeline: solving canonicalization, managing asynchronous state, and enabling offline verification."
tags:
  - architecture
  - software
  - git
  - blockchain
  - bitcoin
  - web-development
series:
  id: decentralized-timestamps
  title: "Decentralized timestamps"
  part: 2
draft: true
---

In the first part of this series (*Proving existence and authorship*), we established the theoretical principles of decentralized timestamps: anchoring document hashes into the Bitcoin blockchain using OpenTimestamps (OTS) Merkle aggregation. We also established that for written essays, database records, and technical specifications, managing detached private key signatures introduces an unnecessary two-step verification penalty—and depends on fragile keys that can be lost or stolen. Instead, embedding the author's identity directly into the payload (such as validated frontmatter, `author: Giovanni Filardo`) and anchoring the exact raw bytes provides durable evidence of priority and prior-art protection with friction-free, single-step verification.

Moving from cryptographic theory to a functioning software pipeline, however, exposes a fundamental systems engineering challenge: **an impedance mismatch in time**.

Modern build tools, compilation scripts, and continuous deployment systems run in seconds. They are designed to be fast, deterministic, and repeatable. In contrast, distributed blockchain consensus is fundamentally asynchronous: public calendar servers aggregate Merkle trees over several hours, and Bitcoin block confirmations arrive at variable intervals governed by Poisson processes.

If you attempt to bridge these two systems naively, your build process will quickly suffer from hanging pipelines, non-deterministic outputs, and brittle cryptographic proofs.

While the principles explored here apply to any automated document or storage pipeline—whether articles stored in a relational database, software release digests, legal document workflows, or regulatory archives—this article uses a static website generator as a concrete, end-to-end case study. We examine how to build an automated, zero-cost stamping pipeline that maintains clean separation of concerns.

---

## The CI/CD anti-pattern

When automating timestamp generation, a common initial instinct is to insert the stamping command directly into a continuous integration (CI/CD) deployment pipeline:

```mermaid#wide The CI/CD anti-pattern versus decoupled local state tracking.
flowchart TD
    subgraph BAD["Anti-Pattern: In-Pipeline Stamping"]
        direction TB
        GIT_PUSH["Push Commit to Main"] --> CI["CI Runner Starts"]
        CI --> BUILD_STEP["Compile Artifacts / Pages"]
        BUILD_STEP --> OTS_WAIT["Execute 'ots stamp' in CI"]
        OTS_WAIT -.->|Waiting for Calendar & Bitcoin (2 to 6 hours)| TIMEOUT["❌ CI Timeout / Flaky Build Failure"]
    end

    subgraph GOOD["Decoupled Out-of-Band Stamping"]
        direction TB
        LOCAL_AUTHOR["Authoring / Modification"] --> LOCAL_STAMP["Local Stamp Cycle (Instant Pending Receipt)"]
        LOCAL_STAMP --> COMMIT["Commit Source + .ots Proof + Manifest"]
        COMMIT --> REPO["Push to Central Repository"]
        REPO --> PURE_CI["Deterministic Read-Only CI Build (Seconds)"]
        PURE_CI --> DEPLOY["Instant Deployment"]
    end
```

Running stamping operations inside CI/CD creates three severe failure modes:

1. **The latency trap**: When a file is stamped (`ots stamp document.txt`), the calendar server returns an *incomplete* proof receipt within seconds. However, that proof is not fully anchored until the calendar's Merkle root is mined into a Bitcoin block—a process that takes between two and six hours. A build runner cannot hang indefinitely waiting for L1 settlement.
2. **Network dependencies and rate limits**: Calling external calendar servers during every CI execution introduces external network dependencies into what should be an isolated compilation step. Temporary network partitions or calendar server rate limits will cause deployment builds to fail intermittently.
3. **Loss of build determinism**: If an automated build queries an external API or injects variable blockchain timestamps during compilation, identical source commits will produce different binary outputs. This breaks reproducible builds.

The architectural rule is straightforward: **Stamping and upgrading are asynchronous, out-of-band operational cycles; the build and compilation pipeline must remain strictly synchronous, offline, and read-only.**

---

## The canonicalization trap vs. exact byte hashing

Before hashing any digital document, you must answer a deceptively simple question: **exactly what bytes are being stamped?**

A common instinct in publishing systems is to attempt "smart" normalization:
1. Stripping YAML/JSON frontmatter so that taxonomy or tag changes don't alter the body hash.
2. Stripping trailing whitespace from lines.
3. Converting line endings (`\r\n` to `\n`).

While intuitive, this normalization introduces **the canonicalization trap**:

* **Markdown syntax corruption**: In standard Markdown, two trailing spaces at the end of a line indicate a hard line break (`<br>`). Stripping trailing whitespace mutates the formatting and semantics of the document.
* **Verification brittleness**: If you normalize with an ad-hoc regular expression, anyone who wishes to verify the proof offline in the future must execute that exact same regex logic. If their script strips whitespace slightly differently, the computed SHA-256 hash will fail to match the `.ots` proof.
* **Loss of metadata integrity**: The publication date, series tags, and article title in the frontmatter are themselves substantive claims of the published work. Normalizing them away removes them from cryptographic protection.

```mermaid#wide The exact byte hashing pipeline versus fragile normalization.
flowchart LR
    subgraph FRAGILE["Fragile Approach: Ad-Hoc Canonicalization"]
        direction TB
        RAW1["Raw Markdown File"] --> REGEX["Ad-hoc Regex Normalizer<br/>(Strip frontmatter, trim spaces)"]
        REGEX --> HASH_FRAG["Normalized Hash"]
        HASH_FRAG -.-> FAIL["❌ Verification requires matching regex code"]
    end

    subgraph ROBUST["Robust Approach: Exact Byte Immutability"]
        direction TB
        RAW2["Exact Source File / Git Blob"] --> SHA["SHA-256 (Raw Bytes)"]
        SHA --> OTS["OpenTimestamps (.ots)"]
        OTS -.-> PASS["✔ Verifiable via standard 'sha256sum'"]
    end
```

The robust solution is **exact byte hashing**:
* Hash the source file exactly as committed.
* If you correct a typo or update frontmatter tags three months later, that change constitutes a legitimate **new revision**.
* Rather than pretending the revised document is identical to the original, the pipeline generates a new `.ots` receipt for the new version while preserving the historical proof for the previous version. The original proof remains 100% valid for the original bytes forever.

---

## The local manifest state machine

To bridge the gap between instant local edits and multi-hour blockchain confirmation, the repository maintains a lightweight local index via a JSON file: `static/proofs/manifest.json`.

```mermaid#wide State transition lifecycle of an artifact in the manifest.
stateDiagram-v2
    [*] --> UNTRACKED: Author creates new document
    UNTRACKED --> PENDING: 'ots stamp' executed (Initial receipt created)
    PENDING --> PENDING: 'ots upgrade' attempted (Block not yet confirmed)
    PENDING --> CONFIRMED: 'ots upgrade' succeeds (Merkle root confirmed on Bitcoin L1)
    CONFIRMED --> REVISED: Content modified (New SHA-256 digest)
    REVISED --> PENDING: New stamp generated (Prior version retained in history)
```

### The manifest schema
The manifest tracks the content hash, versioned proof path, Git commit, and confirmation status for every document:

```json
{
  "version": 1,
  "articles": {
    "decentralized-timestamps-pt1": {
      "currentPath": "content/posts/decentr-timestamps-proving-existence-and-authorship.md",
      "versions": [
        {
          "version": 1,
          "path": "content/posts/decentr-timestamps-proving-existence-and-authorship.md",
          "fileHash": "16efa7abadaf4f86969bacbf0f7db2acce22d88927760d01d82b13e71903281b",
          "proofFile": "static/proofs/decentralized-timestamps-pt1/v1.ots",
          "otsUrl": "/proofs/decentralized-timestamps-pt1/v1.ots",
          "stampedAt": "2026-11-11T11:29:29.299Z",
          "status": "anchored",
          "gitCommit": "0d2100d2b8a2e80451d52c07c89e47289f687663",
          "bitcoinBlock": 975431,
          "bitcoinBlockTime": null
        }
      ]
    }
  }
}
```

### The four operational states:

1. **`UNTRACKED`**: A newly authored document. The manifest has no record for this identifier.
2. **`PENDING`**: The initial stamp has been created. The file `static/proofs/<id>/v<version>.ots` contains the calendar server's cryptographic receipt, but the Merkle root has not yet been confirmed in a Bitcoin block.
3. **`CONFIRMED` (`anchored`)**: An upgrade operation has fetched the final Merkle branch connecting the file's hash to a confirmed Bitcoin block header. The `.ots` file is now self-contained for Merkle path verification.
4. **`REVISED` (`MODIFIED`)**: When an author updates the content, the file hash changes. The manifest preserves the old hash and `.ots` proof in the append-only `versions` array (retaining verifiable prior art for the original version) and transitions the new version (`v2`, `v3`) into a fresh `PENDING` cycle.

---

## Operational workflow and tooling

Rather than burdening deployment runners, provenance is managed locally through a dedicated CLI pipeline in `scripts/timestamp.mjs`.

> [!NOTE] Zero financial cost and zero credentials
> OpenTimestamps requires no cryptocurrency wallet, no API tokens, and zero payment. Public calendar servers aggregate hashes into massive Merkle trees and pay the single Bitcoin transaction fee on authors' behalf. The only operational requirement is network access to submit the 32-byte hash and upgrade the proof once the batch confirms on-chain.

### 1. The stamping cycle
Before committing or pushing a new or revised document, run the local stamp command:

```bash
npm run timestamp:stamp -- --all
# or target a single article:
node scripts/timestamp.mjs stamp decentralized-timestamps-pt1
```

Under the hood, `stampArticle` in `scripts/timestamp.mjs` computes the raw SHA-256 digest, skips any file whose hash already matches its latest manifest version, and submits new digests to the OpenTimestamps calendar pool:

```javascript
const rawBuffer = await readFile(target.filePath);
const rawHashBytes = createHash('sha256').update(rawBuffer).digest();
const hexHash = rawHashBytes.toString('hex');

const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
  new OpenTimestamps.Ops.OpSHA256(),
  rawBuffer
);
await OpenTimestamps.stamp(detached, { calendars: DEFAULT_CALENDARS, m: 1 });
const proofBuffer = Buffer.from(detached.serializeToBytes());

await writeFile(proofAbsPath, proofBuffer);
entry.versions.push({
  version: newVersion,
  path: target.relPath,
  fileHash: hexHash,
  proofFile: proofRelPath,
  stampedAt: new Date().toISOString(),
  status: 'pending',
  gitCommit: getGitCommit(root, target.filePath),
  bitcoinBlock: null
});
```

### 2. The upgrade and inspection cycle
A few hours later—once the calendar servers have anchored their batch into a mined Bitcoin block—run the upgrade command:

```bash
npm run timestamp:upgrade
```

The `upgradeProofs` function deserializes each pending `.ots` receipt, fetches the completed Merkle branch from the calendar server, and extracts the confirmed `BitcoinBlockHeaderAttestation` height into the manifest:

```javascript
const detached = OpenTimestamps.DetachedTimestampFile.deserialize(proofBuf);
const changed = await OpenTimestamps.upgrade(detached);

if (changed) {
  await writeFile(proofAbsPath, Buffer.from(detached.serializeToBytes()));
  const attestations = Array.from(detached.timestamp.allAttestations().values());
  const btc = attestations.find(
    a => a instanceof OpenTimestamps.Notary.BitcoinBlockHeaderAttestation
  );
  if (btc) {
    v.status = 'anchored';
    v.bitcoinBlock = btc.height;
  }
}
```

To inspect the serialized Merkle operations of any proof directly from the repository, `getProofInfo` wraps `OpenTimestamps.info(detached)`:

```bash
npm run timestamp:info -- decentralized-timestamps-pt1
```

Once upgraded, commit the finalized proof and manifest:

```bash
git add content/ static/proofs/
git commit -m "docs: anchor architecture spec to Bitcoin block #975431"
```

---

## Repository hygiene and storage footprint

A practical concern when incorporating cryptographic proofs into software repositories is **repository bloat**. Many decentralized implementations store bulky transaction receipts, binary blocks, or runtime dependencies that inflate repository size over time.

OpenTimestamps avoids this entirely:

* **Detached proof storage**: Proof receipts live in a separate `static/proofs/` directory rather than being concatenated into source files.
* **Microscopic storage footprint**: A finalized `.ots` proof file is approximately **400 to 700 bytes** in size. Stamping an entire library of 1,000 comprehensive specifications or essays adds **between 400 and 700 kilobytes** of binary data to your repository—smaller than a single uncompressed screenshot.
* **Git line-ending byte stability (`core.autocrlf`)**: Because OpenTimestamps hashes the exact raw bytes of a file, Git's `core.autocrlf` conversion on cross-platform checkouts can silently rewrite Unix `LF` into Windows `CRLF`, mutating the file hash and breaking verification against `.ots` proofs. Enforce deterministic `LF` line endings for all text and Markdown content alongside binary rules for `.ots` files in `.gitattributes`:
  ```gitattributes
  * text=auto eol=lf
  *.md text eol=lf
  static/proofs/**/*.ots binary
  ```

---

## The verification protocol

The defining strength of this architecture is that once a proof is upgraded, its Merkle path is completely self-contained. Anyone can verify the chronological priority of a document without an account or API key—needing only a trusted view of Bitcoin block headers rather than trusting the author or the calendar servers that aggregated the batch.

When you execute `ots verify`, the client evaluates the proof through two distinct stages:

```mermaid#wide The two-stage verification path: from document hash to Bitcoin block header.
flowchart LR
    subgraph STAGE1["Stage 1: Off-Chain Merkle Path"]
        direction TB
        DOC["Local Document"] -->|SHA-256| LEAF["Document Hash"]
        LEAF --> TREE["Calendar Merkle Tree<br/>(Traversing sibling hashes in .ots)"]
        TREE --> ROOT["Calendar Merkle Root"]
    end

    subgraph STAGE2["Stage 2: On-Chain Bitcoin Proof"]
        direction TB
        ROOT --> TX["Bitcoin Transaction<br/>(OP_RETURN payload)"]
        TX --> BLOCK_TREE["Bitcoin Block Transaction Tree"]
        BLOCK_TREE --> HEADER["80-Byte Block Header<br/>(Verified Proof-of-Work)"]
    end

    STAGE1 --> STAGE2
```

1. **Stage 1 (Off-Chain Merkle Path)**: The `.ots` file contains a serialized recipe of operations (sibling hashes and concatenation rules). The verifier computes the SHA-256 digest of your local document, combines it step-by-step with intermediate sibling hashes from the receipt, and calculates the calendar server's aggregated Merkle root. If a single byte of the document was modified, the calculated root will fail to match.
2. **Stage 2 (On-Chain Bitcoin Proof)**: The upgraded receipt continues the cryptographic path into Bitcoin. It proves how the calendar Merkle root was embedded into a transaction's `OP_RETURN` script, and how that transaction connects through the block's internal transaction tree to the `merkle_root` recorded in the **80-byte Bitcoin block header**.
3. **The Proof-of-Work Check**: The client verifies that the block header meets Bitcoin's Proof-of-Work difficulty target and belongs to the valid blockchain. Because Bitcoin headers are compact (roughly 78 MB for the entire chain of ~975,000 blocks since 2009), this check can be performed completely offline on a local machine.

### Reproducible verification: from raw bytes to block explorer

To understand how an auditor verifies your proof, it helps to walk through the journey step-by-step. Once a proof is anchored on-chain, an auditor does not have to trust the author, the hosting server, or the OpenTimestamps calendar servers that aggregated the tree.

#### 1. Compute the local file hash
The auditor begins by calculating the SHA-256 digest of the downloaded document:

```bash
shasum -a 256 my-document.md
# Example output:
# 16efa7abadaf4f86969bacbf0f7db2acce22d88927760d01d82b13e71903281b
```

#### 2. Inspect the Merkle audit path
The `.ots` file is a serialized recipe of cryptographic operations (concatenations and hashes) rather than a simple digital signature. Using the OpenTimestamps CLI:

```bash
npx --package=opentimestamps ots-cli.js info v1.ots
```

The output reveals the entire path connecting the document to Bitcoin consensus:

```text
File sha256 hash: 16efa7abadaf4f86969bacbf0f7db2acce22d88927760d01d82b13e71903281b
Timestamp:
append 432c9ad4330a567a
sha256
prepend c81dd1e2e31c1f8487185dc055accd5c0fe38a368ddb8978b664fb789ec08ed5
sha256
...
# transaction id 8a45961925c0a76f953fa9c4c741bfdf3d46074341a94d129c87ebfc6e28254f
...
verify BitcoinBlockHeaderAttestation(975431)
# Bitcoin block merkle root affcd985cdea192f1fba9fa3cfb3be5b00b8ac359552aa91685ebff7882fbb72
```

Notice the key anchor points in this recipe:
* **The file hash**: Matches the digest calculated in Step 1.
* **The operations**: Each `append` and `prepend` provides the "sibling hash" needed to climb up the calendar's Merkle tree without needing to download anyone else's documents.
* **The transaction ID**: Identifies the Bitcoin transaction containing the calendar's commitment.
* **The Bitcoin block header**: Confirms the block height (`#975431`) and the block's transaction Merkle root.

#### 3. Why inclusion in the Merkle root cannot be faked
A natural question is: *How does an auditor know their specific hash was truly included in that Bitcoin transaction root?*

The answer lies in the collision and pre-image resistance of SHA-256:
* The verifier starts with the document hash $H_0$ and applies each operation in sequence:
  $$H_1 = \text{SHA256}(H_0 \mathbin{\Vert} \text{sibling}_1)$$
  $$H_2 = \text{SHA256}(\text{sibling}_2 \mathbin{\Vert} H_1)$$
* If an attacker changed even a single byte or punctuation mark in the document, the initial hash would completely change (the avalanche effect). Every subsequent intermediate hash would diverge, and the computed root would fail to match the Bitcoin transaction.
* Because SHA-256 cannot be reversed, it is computationally impossible (requiring on the order of $2^{128}$ to $2^{256}$ operations) to find any other document that evaluates to the same root through that operation sequence.

#### 4. Audit on an independent block explorer
To verify without any specialized OpenTimestamps tools, open any independent public Bitcoin explorer (such as [mempool.space](https://mempool.space) or [blockstream.info](https://blockstream.info)):

1. Search for the transaction ID from the proof:
   `https://mempool.space/tx/8a45961925c0a76f953fa9c4c741bfdf3d46074341a94d129c87ebfc6e28254f`
2. Inspect the outputs: an `OP_RETURN` script contains the exact 32-byte Merkle root output by your proof's calendar branch.
3. Open the block header for that transaction:
   `https://mempool.space/block/975431`
4. Verify that the block's `Merkle Root` matches the final hash computed by the proof (`affcd985cdea...`).

#### 5. Automated verification against a local node
To perform this entire verification in one automated step without relying on any third-party block explorer, point the verifier at your own local Bitcoin full node (`bitcoind`):

```bash
npx --package=opentimestamps ots-cli.js verify \
  -b http://user:pass@127.0.0.1:8332 \
  v1.ots -f my-document.md
```

Alternatively, for convenience when a local Bitcoin node is not running, anyone can drag-and-drop the markdown file and `.ots` proof into the web verifier at [opentimestamps.org](https://opentimestamps.org), which evaluates the Merkle branch in the browser and queries public block explorers as semi-trusted header oracles.

Crucially, because the author's identity is declared directly in the payload (`author: Giovanni Filardo`) and committed into the raw hashed bytes, **verification requires only a single command**. The auditor does not need to retrieve a public key from an external keyserver, import an X.509 certificate, or run a detached signature check. The text, metadata, and author attribution are all verified simultaneously against Bitcoin consensus.

The auditor does not need to trust the author, the host web server, or any commercial certificate authority. The proof is anchored directly to the energy and consensus of the Bitcoin network.

---

## Conclusion

By treating decentralized timestamps as generic cryptographic anchors, we achieve a reliable, low-overhead method for proving digital priority:

1. **Embed attribution directly in the hashed payload**: Include author metadata directly inside the raw bytes you timestamp (whether a file or a serialized database record), avoiding cryptocurrency wallets, gas fees, and fragile private key ceremonies.
2. **Isolate build systems from asynchronous latency**: Handle stamping and upgrading as out-of-band operational cycles, keeping build pipelines deterministic, fast, and offline.
3. **Anchor exact bytes and version revisions**: Enforce deterministic byte representation (such as `eol=lf` for text files), stamp exact immutable payloads to avoid fragile normalization, and preserve historical proofs across revisions.
4. **Enable independent verification**: Provide detached proofs that any third party can verify independently using open-source tools and a trusted view of Bitcoin headers.
