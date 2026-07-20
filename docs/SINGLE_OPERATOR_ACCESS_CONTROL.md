# Single-Operator Access Control

SpecSpace supports a bounded single-operator security profile for deployments
that need mutable workspace state or managed operations but do not yet need
user registration, organizations, or role management.

This profile is an interim production boundary:

```text
public visitor
-> public-safe read projections and published artifacts

authenticated operator
-> private SpecSpace state and allowlisted managed-operation requests
```

Authentication does not grant direct SpecGraph, Git, Ontology, or shell
authority. Managed execution remains restricted by the Platform operation
registry, workspace binding, deployment allowlist, and durable report
contracts.

## Configuration

Set the following variables on the SpecSpace API service:

```text
SPECSPACE_OPERATOR_AUTH_ENABLED=true
SPECSPACE_OPERATOR_AUTH_USERNAME=operator
SPECSPACE_OPERATOR_AUTH_PASSWORD=<random value with at least 32 characters>
SPECSPACE_OPERATOR_AUTH_ALLOWED_ORIGIN=https://specgraph.space
```

The password is a deployment secret. Do not place it in Compose, Git, image
layers, logs, command-line arguments, or public reports. A mounted password file
may be used outside Timeweb through:

```text
SPECSPACE_OPERATOR_AUTH_PASSWORD_FILE=/run/secrets/specspace-operator-password
```

Environment and file inputs are mutually exclusive.

When authentication is enabled:

- private routes use HTTP Basic authentication over HTTPS;
- passwords are compared through a constant-time SHA-256 verifier and are not
  stored on the runtime server object;
- private responses use `Cache-Control: no-store`;
- mutation requests require `application/json`;
- mutation requests require an exact `Origin` match;
- failed authentication is handled before a request body or private state is
  read.

Open `/api/v1/operator-session` in the browser to receive the native Basic Auth
prompt and establish the operator session, then return to the Product
Workspace. Other private API routes return `401` without triggering a browser
prompt, so background requests cannot trap an anonymous public visitor in a
login loop. The session endpoint returns no credential material.

## Access Matrix

Public routes are explicitly allowlisted in `viewer/routes.py`. New GET routes
default to operator-only, and every POST/DELETE route is operator-only.

Public examples:

- `GET /api/v1/health`;
- `GET /api/v1/workspaces`;
- `GET /api/v1/idea-to-spec-workspace`;
- published spec, artifact, metrics, and ontology projections.

The public Product Workspace projection omits the private
`root_intent_summary`. It may still expose public-safe presence, lifecycle, and
readiness telemetry.

Operator-only examples:

- every SpecSpace-owned raw state GET;
- raw idea entry requests;
- clarification answers and repair drafts;
- ontology decisions and approval intents;
- execution-request state;
- every managed-operation execute endpoint;
- all POST and DELETE routes;
- Agent Workbench conversation state.

The canonical route inventory and regression tests are the authority for the
full matrix.

## Fail-Closed Managed Mode

SpecSpace refuses startup when external mutable state, local Platform
execution, or hosted managed execution is enabled without operator
authentication.

Timeweb must pass the operator password as a value-less global environment
variable reference. Production smoke must prove:

1. public health and sanitized Product Workspace routes return `200`;
2. anonymous raw-state GET returns `401`;
3. anonymous mutable and managed POST requests return `401` before body
   validation;
4. `operator_access_control.status=single_operator`;
5. no credential value appears in generated deployment artifacts or reports.

## Limitations And Follow-Up

This profile has one shared operator identity. It does not provide:

- per-user sessions;
- workspace ownership or roles;
- revocation of one person without rotating the shared password;
- a durable security audit log;
- distributed rate limiting.

Before multi-user production, replace it with backend user sessions,
workspace-level authorization, CSRF/session policy, rate limiting, and a
security audit log. An identity-aware ingress such as Cloudflare Access may be
added in front, but backend route authorization remains required.
