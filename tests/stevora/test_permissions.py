"""Runtime permission projection tests without requiring a running HA server."""
import copy
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[2] / "custom_components/stevora/permissions.py"


class _Permissions:
    def __init__(self, readable=(), controllable=()):
        self.readable = set(readable)
        self.controllable = set(controllable)

    def check_entity(self, entity_id, policy):
        return entity_id in (self.readable if policy == "read" else self.controllable)


class _User:
    def __init__(self, admin=False, readable=(), controllable=(), user_id="test-user"):
        self.id = user_id
        self.is_admin = admin
        self.permissions = _Permissions(readable, controllable)


def _load_permissions():
    modules = {
        name: types.ModuleType(name)
        for name in ("homeassistant", "homeassistant.auth", "homeassistant.auth.permissions")
    }
    policy = types.ModuleType("homeassistant.auth.permissions.const")
    policy.POLICY_READ = "read"
    policy.POLICY_CONTROL = "control"
    modules[policy.__name__] = policy
    with patch.dict(sys.modules, modules):
        spec = importlib.util.spec_from_file_location("stevora_test_permissions", SOURCE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module.project_manifest_for_user


class PermissionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.project = staticmethod(_load_permissions())

    def setUp(self):
        self.manifest = {
            "schema_version": "1.0",
            "installation_id": "home-test",
            "revision": 100,
            "rooms": [{"id": "k", "name": "Kitchen"}, {"id": "b", "name": "Bedroom"}],
            "entities": [
                {"entity_id": "light.kitchen", "area_id": "k", "domain": "light"},
                {"entity_id": "climate.bedroom", "area_id": "b", "domain": "climate"},
            ],
            "mappings": {"k": ["light.kitchen"], "b": ["climate.bedroom"]},
            "domain_mappings": {"lighting": ["light.kitchen"], "climate": ["climate.bedroom"]},
            "capabilities": {"lighting": True, "climate": True, "voice": False},
            "configuration": {"auto_discovery": True},
            "discovery_diagnostics": {
                "counts": {"unassigned": 1},
                "excluded_sample": [{"entity_id": "sensor.secret", "reason": "unassigned"}],
            },
        }

    def test_admin_gets_entire_inventory_and_control_rights(self):
        result = self.project(self.manifest, _User(admin=True))
        self.assertEqual(len(result["entities"]), 2)
        self.assertIn("discovery_diagnostics", result)
        self.assertEqual(len(result["rooms"]), 2)
        self.assertEqual(result["controllable_entities"], ["climate.bedroom", "light.kitchen"])

    def test_read_only_user_sees_entity_but_not_controls(self):
        user = _User(readable={"light.kitchen"})
        result = self.project(self.manifest, user)
        self.assertEqual([item["entity_id"] for item in result["entities"]], ["light.kitchen"])
        self.assertEqual(result["rooms"], [{"id": "k", "name": "Kitchen"}])
        self.assertEqual(result["mappings"], {"k": ["light.kitchen"]})
        self.assertEqual(result["domain_mappings"]["climate"], [])
        self.assertFalse(result["capabilities"]["climate"])
        self.assertEqual(result["controllable_entities"], [])
        self.assertNotIn("discovery_diagnostics", result)

    def test_control_only_requires_read_permission_as_well(self):
        user = _User(readable={"light.kitchen"}, controllable={"climate.bedroom"})
        result = self.project(self.manifest, user)
        self.assertEqual(result["controllable_entities"], [])

    def test_control_allowed_for_visible_entity(self):
        user = _User(readable={"light.kitchen"}, controllable={"light.kitchen"})
        result = self.project(self.manifest, user)
        self.assertEqual(result["controllable_entities"], ["light.kitchen"])

    def test_no_permissions_fail_closed(self):
        result = self.project(self.manifest, _User())
        self.assertEqual(result["rooms"], [])
        self.assertEqual(result["entities"], [])
        self.assertEqual(result["mappings"], {})
        self.assertEqual(result["controllable_entities"], [])

    def test_projection_does_not_mutate_source_and_revisions_differ(self):
        original = copy.deepcopy(self.manifest)
        admin = self.project(self.manifest, _User(admin=True))
        read_only = self.project(self.manifest, _User(readable={"light.kitchen"}))
        self.assertEqual(self.manifest, original)
        self.assertNotEqual(admin["revision"], read_only["revision"])


    def test_per_user_audience_is_stricter_than_ha_permissions(self):
        self.manifest["entities"][0]["user_ids"] = ["allowed"]
        self.manifest["entities"][1]["user_ids"] = []
        readable = {"light.kitchen", "climate.bedroom"}
        allowed = self.project(self.manifest, _User(
            readable=readable, controllable=readable, user_id="allowed",
        ))
        blocked = self.project(self.manifest, _User(
            readable=readable, controllable=readable, user_id="blocked",
        ))
        self.assertEqual(
            {entry["entity_id"] for entry in allowed["entities"]},
            {"light.kitchen", "climate.bedroom"},
        )
        self.assertEqual(
            {entry["entity_id"] for entry in blocked["entities"]},
            {"climate.bedroom"},
        )
        self.assertEqual(blocked["mappings"]["b"], ["climate.bedroom"])
        self.assertEqual(blocked["controllable_entities"], ["climate.bedroom"])
        self.assertEqual(blocked["domain_mappings"]["lighting"], [])
        self.assertNotIn("discovery_diagnostics", blocked)
        self.assertTrue(all("user_ids" not in x for x in blocked["entities"]))
        self.assertNotEqual(allowed["revision"], blocked["revision"])

    def test_mapping_cannot_inject_unreadable_entity(self):
        self.manifest["mappings"]["k"].append("lock.private")
        self.manifest["domain_mappings"]["lighting"].append("lock.private")
        user = _User(readable={"light.kitchen"}, controllable={"light.kitchen"})
        projected = self.project(self.manifest, user)
        self.assertNotIn("lock.private", projected["mappings"]["k"])
        self.assertNotIn("lock.private", projected["domain_mappings"]["lighting"])
        self.assertNotIn("lock.private", projected["controllable_entities"])

    def test_source_manifest_revision_invalidates_scoped_revision(self):
        user = _User(readable={"light.kitchen"})
        before = self.project(self.manifest, user)
        self.manifest["revision"] += 1
        after = self.project(self.manifest, user)
        self.assertNotEqual(before["revision"], after["revision"])


if __name__ == "__main__":
    unittest.main()
