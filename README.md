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

Ethernet, Wi-Fi, bridges, VLANs, bonds, GRE tunnels, veth pairs, dummy devices
and VRFs — a palette of device-type nodes, tiled in a grid. Ethernet and Wi-Fi
are on by default; click any node to include its example.

Four template tiers set how much detail each example carries: **Simple** (bare
DHCP), **Simple + Comments** (bare, with every full option appended as comments),
**IT** (the common real-world config — static IP, gateway, DNS and static routes,
commented) and **Full** (every option, including MAC match, set-name, MTU and
tuning knobs). The IPv4/IPv6 toggles filter every config — **IPv4-only by
default** — and interfaces you name yourself replace the example blocks.

Per interface you can set one or several **static addresses**, a **gateway**
(default route with a metric), **DNS** servers and search domains, and any number
of **static routes** (`to` / `via` / `metric` / `on-link` for a directly-connected
gateway) — all rendered identically on all three backends.

**Multi-homing is handled for you.** Point two ports at the same subnet (or give
two ports gateways) and the tool switches to **source-based policy routing** — a
routing table per port plus a `from <ip>` rule — so replies leave the port their
request arrived on, instead of getting dropped by reverse-path filtering (the
classic "two NICs, same range, ping works one way"). It also emits the
recommended `rp_filter` / `arp_ignore` / `arp_announce` sysctls.

**Load an example** offers canonical scenarios from the netplan docs (static IP +
DNS, directly-connected gateway, two-subnet router, bridge, bond, VLAN, VRF, Wi-Fi
…) — the difference here is you see each one's networkd and NetworkManager
equivalents side by side, which the netplan docs don't show.

Because networkd and NetworkManager are multi-file where netplan is single-file,
the editor gets a **tab per output file** showing its real destination path.
*Download all* bundles them with those paths as headers.

**Validate** checks YAML on the netplan tab, and INI shape — every line a
`[Section]` or a `key=value`, no key outside a section — on the other two.

A live analyzer flags a genuine footgun on every backend tab: assigning a static
address *and* leaving DHCP on for the same family, which quietly leaves the
interface multi-homed with two competing default routes.

## Accuracy

These are examples for learning and adaptation, not audited production
templates. Check them against your distribution's documentation before applying,
and **keep a second session open when configuring a remote host** — only netplan
has an automatic rollback.

Third-party code (CodeMirror, js-yaml) is vendored under [`vendor/`](vendor/)
with its own MIT licences — see [vendor/README.md](vendor/README.md).

## License

Licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later) — see [LICENSE](LICENSE). Copyright © 2026 Miguel Carino.
