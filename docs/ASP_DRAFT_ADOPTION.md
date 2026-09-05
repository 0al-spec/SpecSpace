# ASP draft adoption: local deployment contract

An opt-in executable experiment, not a production or full-conformance claim.
The ordinary Product Workspace deployment does not expose these endpoints.

- Transport: direct ASP HTTP semantics over TLS, loopback only, using the
  existing SpecSpace ViewerHandler. No MCP/WebMCP or new binding.
- Credentials: existing Compatibility Bearer Credential Profile, development
  only. App-issued credentials stay in the local runtime, not agent context.
  User/operator control credentials are separate and never given to runtime.
- Surface: proposal-only; one workspace-scoped read and one persisted proposal.
  No submit, intake execution, domain commit, compensation or export.
- Approval: base application-side opaque reference, bound to the exact input
  and invocation; not Approval Receipt v1. Grant consent is a separate decision.
- Storage: opt-in SQLite BEGIN IMMEDIATE transaction shared by ASP and native
  raw-idea save. Grant/session/approval/execution state and the draft commit
  together. Other SpecSpace collections keep their existing backend. Startup
  refuses implicit migration of an existing raw-idea JSON file or external
  state backend. This deployment uses a fresh synthetic state directory.
- Retry: return the original authorized result without altering the current
  draft, including after a native edit. Revocation/expiry still fence disclosure.
- Limits: bounded input, short-lived authority, bounded grants/sessions/drafts
  and execution records; exhaustion fails closed rather than discarding retry
  evidence. No background intake worker or production data in the experiment.

## Enablement

Use Python 3.12 with the repository requirements and OpenSSL 3.x on `PATH`.
On macOS this means the installed OpenSSL, not Apple's LibreSSL. This is not
a deployment recipe for shared/remote service or a hostile local agent.

Create a new, operator-owned directory with mode `0700`, containing only
synthetic state. Set up a TLS certificate whose SAN covers `127.0.0.1` and
explicitly trust that certificate in the client; do not disable verification.
Create an operator password file (32 or more characters) with mode `0600`.
The independent scenario driver in ASP generates and removes these test assets.

```sh
.venv/bin/python -B -m viewer.server \
  --host 127.0.0.1 --port 8443 --dialog-dir /private/run/dialogs \
  --specspace-state-dir /private/run/state \
  --enable-operator-auth \
  --operator-auth-password-file /private/run/operator-password \
  --operator-auth-allowed-origin https://127.0.0.1:8443 \
  --asp-draft-config /private/run/app-config.json
```

The configuration has exactly these keys (all paths are operator-controlled):

```json
{
  "tls_cert": "/private/run/tls.crt",
  "tls_key": "/private/run/tls.key",
  "issuer_public_key": "/private/run/issuer.pub",
  "identity_artifact": "/private/run/identity.json",
  "workspace_id": "asp-draft-demo",
  "runtime_id": "local-runtime",
  "agent_id": "local-agent"
}
```

Startup rejects external storage, enabled execution, non-loopback binding,
unprotected state and an existing raw-idea JSON collection. It does not migrate
production data. Restart requires the same origin, surface, user, workspace,
runtime and identity registration; it never resets a revoked Grant.
The configured workspace ID must already be in the native canonical form:
lowercase, hyphen-separated (`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`). Startup rejects
aliases such as `Workspace-A` and `workspace_a`; it does not silently rewrite the
authority binding. The published input/output schemas advertise this contract.

## Application boundary

The experiment permits only its `/asp/` routes, well-known discovery and the
existing operator-only `/api/v1/real-idea-entry-requests` GET/POST route. Static
files, intake, export and all other routes are unavailable in this deployment.
The Bearer credential does not authorize the native operator endpoint.

- Discovery: `/.well-known/agent-surface.json`; closed input/output schemas at
  `/asp/schemas/{read,propose}-{input,output}`.
- Runtime: `/asp/grant`, `/asp/sessions`, `/asp/actions` and the app-local
  `/asp/approval-request` bridge.
- Operator: `/asp/operator/consent`, `/asp/operator/grant`,
  `/asp/operator/approvals`, `/asp/operator/approve`, `/asp/operator/revoke`.

Runaway-guard pause fences every new session under the same Grant, including
after restart. Exact replay of the paused `session.start` remains an idempotent
transition and returns the interrupted state; a freshly issued Grant is required
to start again.

Issuance uses ASP's app-issued Model A and the existing compatibility Bearer
profile. The app-local consent bridge is not an OAuth server or a portable
new ASP issuance binding. Only the operator can consent to the exact pinned
user/runtime/agent/workspace/surface tuple. Operator credentials never enter
the runtime or agent channel. The short-lived Grant credential enters only
the trusted runtime channel. TLS does not make this Bearer sender-constrained.

The proposal input is exactly `workspace_id`, `request_id`, `idea_text` and
`snapshot_hash`. The snapshot is an application-defined hash of selected native
state, not an ASP preview token, reservation or new RFC precondition object.
It prevents native changes between read/approval and create-only save from
being ignored. Native save remains an upsert under the operator's own authority.

`status` is always `draft` and actor attribution is derived from the authenticated
operator Grant. The adapter calls the existing `save_request`; it does not
implement a second draft writer. Text that native save would trim or clean is
rejected, not silently transformed after approval. JSON hashing implements the
integer/string subset used by these schemas; floating-point JSON, duplicate
keys, negative zero, invalid Unicode and unsafe integers fail closed. This is
not a general JSON Schema or JCS SDK.

Approval is an app-owned record of the exact invocation (including input hash,
session, generation, Grant and execution/idempotency identifiers). It is not
Approval Receipt v1, which does not cover `propose`. Changing that tuple requires
a new approval. Grant consent and action approval are separate operator decisions.

The SQLite transaction covers current identity/Grant/session checks, approval,
snapshot/create-only checks, native save, immutable result, execution identity
and the proposal counter. Native save starts the same transaction *before* its
process-local lock. Independent processes serialize through SQLite. Recovery
rolls back a process that dies before commit; a lost response after commit can
be retried without another save. A later native edit does not rewrite the stored
original result. Revocation and expiry are checked before returning it.

`runaway_guard` pause stops new work and allows only completed exact proposal
replay or control query/cancel under current authority. Automatic resume is
unavailable; this experiment's policy requires fresh consent instead. It does
not implement runtime-budget accounting or a complete conformance profile.

## Local identity profile

This deployment selects the RFC's generic Agent Identity Evidence envelope,
not an unsigned placeholder or an opaque `agent_id` exemption. Concrete local
profile identifiers use the prefix
`https://github.com/0al-spec/SpecSpace/experiments/asp-draft/v1/`.
These identifiers describe this experiment, not new normative RFC features.

| Suffix | Exact local contract |
| --- | --- |
| `identity-format` | Closed JSON artifact with `statement` and base64 `signature`. The closed statement has `issuer`, `subject`, integer `issued_at`/`expires_at`, and base64 Ed25519 SubjectPublicKeyInfo DER `public_key_der`. |
| `identity-artifact-jcs-sha256` | SHA-256 of canonical complete artifact JSON, encoded as unpadded `sha-256:` base64url. |
| `identity-ed25519-pinned-issuer` | Ed25519 over ASCII `specspace-asp-draft-identity-v1` + NUL + canonical statement. Only the operator-pinned issuer public key and literal issuer `specspace-local-experiment` are accepted. No network resolution/fallback. |
| `subject-spki-sha256` | SHA-256 of the exact verified subject SPKI DER, not the issuer key. |
| `identity-current-transaction` | No clock skew allowance; issue time ≤ current time < expiry; artifact lifetime ≤ 3600 seconds. Verify on every admission, with fresh DB status in the same transaction. |
| `identity-app-status` | One app-local, issuer/artifact/key-bound registration with stable `registered-demo-agent` reference and durable state/revision. Missing, non-active or unavailable status fails closed. No stale-success fallback. |

The application re-verifies the signature independently of the runtime. The
runtime additionally challenges the local test agent's subject key. This proves
key possession, **not** executable identity, sandbox isolation or truthful claims.
Rotation changes the evidence binding and requires a fresh deployment directory
and consent. Local filesystem and process ownership remain trusted; same-UID
hostile-code isolation and arbitrary trust-policy/issuer rotation are out of scope.

## Bounds and evidence

Limits per disposable state directory: 32 Grant records, 32 session records,
64 approval records; 8 new proposals per Grant; Grant lifetime ≤ 600 seconds;
approval lifetime 120 seconds; request body ≤ 64 KiB; idea text ≤ 8000 characters.
State/results are never pruned while a credential could replay them. Exhaustion
fails closed. The operator removes the synthetic directory after all Grants
end. Native operator writes are intentionally not charged to agent quotas.

Tests cover signature tampering, hash vectors, TLS/route/auth guards, native
save/rollback, cross-process concurrency/crash, approval/input/state conflicts,
restart and revocation/expiry before replay. The independent ASP driver also
exercises real HTTPS response loss and a separate runtime/agent process.
Automated approval is explicitly reported as `synthetic`. A manual run prompts
separately for `GRANT` and `APPROVE`; only such a run is human-consent evidence.

No RFC/card maturity is raised. This is not the entire Mediated Proposal bundle,
an interoperability certification, production storage migration, public SDK,
remote-runtime implementation or an adoption-time benchmark.
