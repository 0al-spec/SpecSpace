from pathlib import Path
import base64
import subprocess
import tempfile
import unittest

from viewer.asp_draft_identity import SIGNING_PREFIX, verify
from viewer.asp_draft_wire import Reject, canonical, loads, object_hash


class IdentityTests(unittest.TestCase):
    def test_real_signature_tampering_expiry_and_trust_fail_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def ssl(*args):
                return subprocess.run(["openssl", *map(str, args)], capture_output=True, timeout=5, check=True).stdout
            for name in ("issuer", "subject", "other"):
                ssl("genpkey", "-algorithm", "ED25519", "-out", root / (name + ".key"))
                ssl("pkey", "-in", root / (name + ".key"), "-pubout", "-out", root / (name + ".pub"))
            public = ssl("pkey", "-in", root / "subject.key", "-pubout", "-outform", "DER")
            statement = {"issuer": "specspace-local-experiment", "subject": "synthetic-agent",
                         "issued_at": 100, "expires_at": 200, "public_key_der": base64.b64encode(public).decode()}
            (root / "statement").write_bytes(SIGNING_PREFIX + canonical(statement))
            signature = ssl("pkeyutl", "-sign", "-rawin", "-inkey", root / "issuer.key", "-in", root / "statement")
            artifact = {"statement": statement, "signature": base64.b64encode(signature).decode()}
            path = root / "artifact.json"
            path.write_bytes(canonical(artifact))
            evidence, expiry = verify(path, root / "issuer.pub", 101)
            self.assertEqual(expiry, 200)
            self.assertEqual(evidence["subject"], "synthetic-agent")
            with self.assertRaises(Reject):
                verify(path, root / "issuer.pub", 200)
            with self.assertRaises(Reject):
                verify(path, root / "other.pub", 101)
            statement["subject"] = "substituted"
            path.write_bytes(canonical(artifact))
            with self.assertRaises(Reject):
                verify(path, root / "issuer.pub", 101)

    def test_hash_vectors_and_closed_integer_json(self):
        self.assertEqual(object_hash("grant", {"grant_id": "grant_123", "scopes": ["read"]}),
                         "sha-256:Xbq37_fP9PBiWI3Bv7Ch0t8TV5ikJGm55MxncSeA38Y")
        self.assertEqual(object_hash("manifest", {"z": 1, "surface_hash": "ignored", "a": "x"}),
                         "sha-256:Mckhl9gi8ePkXnuOJtPFNE1pe9LhilOGu1OgzxsXb8A")
        for raw in ('{"a":1,"a":2}', '-0', '1e400', 'NaN', '1.5', '"\\ud800"', '"\\uffff"', '9007199254740992'):
            with self.subTest(raw=raw), self.assertRaises(Reject):
                loads(raw)
        # JCS sorts by UTF-16 code units, not by Unicode scalar value.
        self.assertEqual(canonical({"\ue000": 1, "\U0001f600": 2}), '{"😀":2,"\ue000":1}'.encode())
