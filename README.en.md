# PiWork-Registry

[简体中文](README.md) | English

The plugin marketplace index for PiWork. **This repository only says where to find plugins — it does not hold plugin code.**

The client reads exactly one entry point:

```
https://github.com/PiWorkAgent/PiWork-Registry/releases/latest/download/index.json
```

## How it is produced

`sources.json` lists every plugin source. A workflow runs on a schedule (every 6 hours) and whenever `sources.json` changes; it fetches each plugin repository's own latest index, merges them, and publishes the result as a release asset of this repository:

```
sources.json
  → for each source: https://github.com/<owner>/<repo>/releases/latest/download/index.json
  → merge (official first) + verify sha256 / version / absolute URL
  → dist/index.json → Release asset → the URL above
```

The benefit: **the registry needs no GitHub API, no token, and no knowledge of plugin repository structure.** Whatever each plugin repository publishes is exactly what the registry aggregates.

The client verifies every zip by `sha256`; download URLs are stable absolute URLs in each plugin's own release, so they do not change when the merged index is rebuilt.

## Official plugins

| Plugin | Repository |
| --- | --- |
| `com.pi.browser` | [PiWork-Plugin-Browser](https://github.com/PiWorkAgent/PiWork-Plugin-Browser) |
| `com.pi.devdocs` | [PiWork-Plugin-Docs](https://github.com/PiWorkAgent/PiWork-Plugin-Docs) |
| `com.pi.diagnostics` | [PiWork-Plugin-Diagnostics](https://github.com/PiWorkAgent/PiWork-Plugin-Diagnostics) |
| `com.pi.files` | [PiWork-Plugin-Files](https://github.com/PiWorkAgent/PiWork-Plugin-Files) |
| `com.pi.tasks` | [PiWork-Plugin-Tasks](https://github.com/PiWorkAgent/PiWork-Plugin-Tasks) |

## Listing a community plugin

A plugin must be **published from its own repository**; it does not need write access to the official repositories. Requirements:

1. The plugin repository root has a `manifest.json` (fields are in the [plugin development guide](https://github.com/PiWorkAgent/PiWork-Plugin-Docs/blob/main/docs/plugin-dev-guide.md)).
2. The repository has `scripts/release.mjs` (copy it from any official plugin repository) or an equivalent implementation: package a zip + generate a single-entry `index.json` (with `sha256` and an absolute `url`).
3. Pushing a `v<manifest.version>` tag produces a release containing both `<id>-<version>.zip` and `index.json`.
4. Submit a PR with the [plugin listing request](.github/PULL_REQUEST_TEMPLATE/plugin-submission.md), adding an entry to `sources.json`:

```json
{
  "id": "com.example.weather",
  "repo": "developer-a/weather-plugin",
  "official": false,
  "categories": ["tools"]
}
```

Non-GitHub hosting also works; provide the index URL with `indexUrl`:

```json
{ "id": "com.example.weather", "indexUrl": "https://example.com/registry/com.example.weather.json" }
```

After the maintainers merge the PR, the plugin appears in the marketplace on the next refresh. When the plugin author publishes a new version later, **no registry change is needed**.

## Trust model (please read it honestly)

- **`sha256` only proves integrity**: the downloaded package matches what the index says. It does not prove who published it.
- **There is no digital signature.** Both the index and the package are fetched over HTTPS from the publisher; the trust anchor is “the URL written in the index”.
- **`official` is only a label** meaning maintained by this project; community plugins use `official: false`.
- **Listing is not a code review.** The manual registry check covers metadata and the publishing flow only; the package contents are the plugin author's responsibility. The permission confirmation at install time is the user's only real-time line of defense.
- A plugin backend has the same permissions as the user account (a full Node process). Permission declarations constrain what the plugin can obtain through the host, not an OS sandbox.

## Known boundaries

- A single failing source is skipped with a warning in the log; it does not fail the whole registry. The build fails only when every source fails.
- A new release is published only when the index changes (avoiding an empty release every 6 hours).
- GitHub Actions scheduled jobs may be delayed or skipped; to refresh immediately, run **Refresh registry** manually.
