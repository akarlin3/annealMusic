# API Stability Commitments

To support long-running research cycles, clinical trials, and hardware sound installations, AnnealMusic establishes a rigorous API stability matrix.

---

## The Stability Matrix

| Surface               | Target API              | Stability Rating | Backward Compatibility Policy                                                                                    |
| :-------------------- | :---------------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------- |
| **JSON-RPC Bridge**   | `v1` namespace          | `stable`         | Permanent support. Direct method names and argument schemas will not break inside major versions.                |
| **OSC Namespace**     | `/anneal/` endpoints    | `stable`         | Additive-only. Endpoints will never be renamed or deleted. New addresses may be introduced.                      |
| **Python `anneal`**   | Core libraries          | `stable`         | Semantic versioning guaranteed. Signatures remain identical until major v6 version transitions.                  |
| **CLI commands**      | `render`, `sweep`, etc. | `stable`         | Output parameters and filenames match SemVer standards.                                                          |
| **Datalogger Schema** | Tick log frames         | `stable`         | Fields like `features.rms` and `drift.orderParameter` are locked.                                                |
| **Experiment Runner** | Experiment classes      | `experimental`   | Handled with **6 months advance notice** and extensive transition documentation prior to breaking modifications. |

---

## Deprecation Policy

When a feature, parameter, or interface must be updated or replaced, AnnealMusic enforces the following protocol:

1. **Deprecation Notice:** The surface is immediately flagged as `deprecated` inside the reference documentation. The alternative or replacement method is documented and linked.
2. **Grace Period:** The deprecated feature remains fully functional in the codebase for a minimum of **6 months** (or two minor releases, whichever is longer).
3. **Removal:** The feature is safely purged in the subsequent major release. A detailed changelog entry maps the migration path.
