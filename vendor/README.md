# Vendored third-party code

These files are **not** part of this project and are **not** covered by its
AGPL-3.0 licence. Each keeps its own MIT licence, reproduced in full alongside
it, as MIT requires.

They are committed here rather than loaded from a CDN so this tool matches the
rest of the fleet: every Carino site works standalone and offline, with no
external runtime dependency and nothing that reports a visitor's presence to a
third party.

| File | Version | Upstream | Licence |
|---|---|---|---|
| `codemirror-5.65.13.min.js` | 5.65.13 | [CodeMirror 5](https://codemirror.net/5/) | MIT — [`LICENSE.codemirror`](LICENSE.codemirror), © 2017 Marijn Haverbeke and others |
| `codemirror-5.65.13.min.css` | 5.65.13 | ” | ” |
| `codemirror-theme-material-darker.min.css` | 5.65.13 | ” | ” |
| `codemirror-mode-yaml.min.js` | 5.65.13 | ” | ” |
| `codemirror-mode-properties.min.js` | 5.65.13 | ” | ” |
| `js-yaml-4.1.0.min.js` | 4.1.0 | [js-yaml](https://github.com/nodeca/js-yaml) | MIT — [`LICENSE.js-yaml`](LICENSE.js-yaml), © 2011-2015 Vitaly Puzrin |

The `properties` mode is what highlights the systemd-networkd units and
NetworkManager keyfiles; `yaml` handles the netplan tab.

MIT is permissive, so bundling it into an AGPL work is fine — the combined work
ships under AGPL while these files stay MIT. The obligation is only to keep the
copyright and permission notices, which is what this folder does.

## Updating

Re-download to the **same version-pinned filename**, or add the new version and
update the `<script>` / `<link>` tags in `index.html`. Do not point them back at
a CDN.
