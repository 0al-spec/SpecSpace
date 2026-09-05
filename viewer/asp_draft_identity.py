"""Local, pinned Ed25519 identity verifier for the opt-in experiment.

No discovery, arbitrary URL retrieval, trust federation or executable attestation.
The operator registers an issuer public key and one signed subject statement.
"""
from __future__ import annotations

import base64
import os
import stat
import subprocess
import tempfile
from pathlib import Path

from viewer.asp_draft_wire import ASP, LOCAL, canonical, closed, digest, loads, require

SIGNING_PREFIX = b"specspace-asp-draft-identity-v1\0"


def verify(artifact_path: Path, issuer_key: Path, now: int):
    for path in (artifact_path, issuer_key):
        metadata = path.lstat()
        require(stat.S_ISREG(metadata.st_mode) and metadata.st_uid == os.getuid()
                and not metadata.st_mode & 0o022, "identity_evidence_invalid", 403)
    require(artifact_path.stat().st_size <= 16384, "identity_evidence_invalid", 403)
    require(issuer_key.stat().st_size <= 4096, "identity_evidence_invalid", 403)
    artifact = loads(artifact_path.read_bytes())
    closed(artifact, ("statement", "signature"))
    statement = closed(artifact["statement"], ("issuer", "subject", "issued_at", "expires_at", "public_key_der"))
    require(statement["issuer"] == "specspace-local-experiment", "identity_evidence_invalid", 403)
    require(isinstance(statement["subject"], str) and 0 < len(statement["subject"]) <= 128)
    require(type(statement["issued_at"]) is int and type(statement["expires_at"]) is int)
    require(statement["issued_at"] <= now < statement["expires_at"] <= statement["issued_at"] + 3600,
            "identity_evidence_invalid", 403)
    try:
        signature = base64.b64decode(artifact["signature"], validate=True)
        subject_key = base64.b64decode(statement["public_key_der"], validate=True)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid local identity encoding") from exc
    # RFC 8410 SubjectPublicKeyInfo, Ed25519, exactly one 32-byte subject key.
    require(len(subject_key) == 44 and subject_key[:12] == bytes.fromhex("302a300506032b6570032100"))
    require(len(signature) == 64)
    with tempfile.TemporaryDirectory(prefix="specspace-identity-") as directory:
        data = Path(directory) / "statement"
        sig = Path(directory) / "signature"
        data.write_bytes(SIGNING_PREFIX + canonical(statement))
        sig.write_bytes(signature)
        public = subprocess.run(["openssl", "pkey", "-pubin", "-in", str(issuer_key), "-outform", "DER"],
                                capture_output=True, timeout=5, check=False)
        require(public.returncode == 0 and len(public.stdout) == 44
                and public.stdout[:12] == bytes.fromhex("302a300506032b6570032100"), "identity_evidence_invalid", 403)
        result = subprocess.run(
            ["openssl", "pkeyutl", "-verify", "-rawin", "-pubin", "-inkey", str(issuer_key),
             "-in", str(data), "-sigfile", str(sig)], capture_output=True, timeout=5, check=False,
        )
    require(result.returncode == 0, "identity_evidence_invalid", 403)
    evidence = {
        "profile": ASP + "profiles/agent-identity-evidence/v1",
        "format_profile": LOCAL + "identity-format",
        "artifact_digest": {"profile": LOCAL + "identity-artifact-jcs-sha256", "value": digest(canonical(artifact))},
        "issuer": statement["issuer"], "subject": statement["subject"],
        "verification_profile": LOCAL + "identity-ed25519-pinned-issuer",
        "key_binding": {"profile": LOCAL + "subject-spki-sha256", "value": digest(subject_key)},
        "lifecycle": {"freshness_profile": LOCAL + "identity-current-transaction",
                      "status_profile": LOCAL + "identity-app-status",
                      "status_ref": "registered-demo-agent"},
    }
    return evidence, statement["expires_at"]
