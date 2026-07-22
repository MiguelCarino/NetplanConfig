# Linux Network Config Creator

Describe a network setup once, then read it back as **netplan**, **systemd-networkd**
or **NetworkManager** → **[netplan.carino.systems](https://netplan.carino.systems)**

Everything runs in the browser. Nothing is uploaded, and nothing here touches a
machine — the output is text you copy.

## The three backends

The same intent renders three ways, so you can compare them directly instead of
reading three sets of documentation:

| | Netplan | systemd-networkd | NetworkManager |
|---|---|---|---|
| Format | one YAML file | several INI units | one keyfile per profile |
| Lives in | `/etc/netplan/` | `/etc/systemd/network/` | `/etc/NetworkManager/system-connections/` |
| Wi-Fi | delegates | **no WPA** — needs wpa_supplicant/iwd | native |
| Rollback | `netplan try` (auto-reverts) | none built in | manual |

**Compare all three** opens the full evaluation: a feature matrix, a
recommendation per machine type, and the traps that actually bite — running two
managers on one interface, keyfile permissions, where netplan's generated files
really live.

The point it leads with: **netplan is not a peer of the other two.** It is a
front-end that *generates* networkd or NetworkManager config and then hands over.
Picking it still means picking a renderer underneath.

## What it builds

Ethernet, Wi-Fi, bridges, VLANs, bonds, GRE tunnels and veth pairs — each an
annotated example you can trim, at three verbosity levels (**Full showcase**,
**Simple**, **Simple + full comments**). The IPv4/IPv6 toggles filter every
config, and interfaces you name yourself replace the example blocks.

Because networkd and NetworkManager are multi-file where netplan is single-file,
the editor gets a **tab per output file** showing its real destination path.
*Download all* bundles them with those paths as headers.

**Validate** checks YAML on the netplan tab, and INI shape — every line a
`[Section]` or a `key=value`, no key outside a section — on the other two.

A live analyzer also flags a genuine footgun: assigning a static address *and*
leaving DHCP on for the same family, which quietly leaves the interface
multi-homed with two competing default routes.

## Accuracy

These are examples for learning and adaptation, not audited production
templates. Check them against your distribution's documentation before applying,
and **keep a second session open when configuring a remote host** — only netplan
has an automatic rollback.

Third-party code (CodeMirror, js-yaml) is vendored under [`vendor/`](vendor/)
with its own MIT licences — see [vendor/README.md](vendor/README.md).

## License

Licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later) — see [LICENSE](LICENSE). Copyright © 2026 Miguel Carino.
