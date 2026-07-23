/* ============================================================
   backends.js — render one network intent into three stacks.

   Netplan's own YAML builders live in index.html (they predate this
   file and are left untouched). This module adds the other two
   targets, plus the data behind the Evaluate panel:

     * systemd-networkd — INI files in /etc/systemd/network/
     * NetworkManager   — keyfiles in /etc/NetworkManager/system-connections/

   Every renderer takes the SAME context object and returns a list of
   files, because these two backends are genuinely multi-file where
   netplan is single-file:

     render(ctx) -> [ { path, mode, content }, ... ]

   ctx = { full, ref, v4, v6, modules:Set<string>, ifaces:[...] }

   The point of the tool is teaching, so the output is commented the
   same way the netplan side is. Nothing here is applied to a machine;
   it is text you copy.
   ============================================================ */
(function (global) {
  'use strict';

  /* ---- shared helpers -------------------------------------------------- */

  // Aligned trailing "# explanation", mirroring index.html's L().
  function L(content, comment, width) {
    if (!comment) return content + '\n';
    var w = width || 42;
    var pad = content.length >= w ? '  ' : new Array(w - content.length + 1).join(' ');
    return content + pad + '# ' + comment + '\n';
  }

  function famLabel(v4, v6) { return v4 && v6 ? 'dual-stack' : v4 ? 'IPv4-only' : 'IPv6-only'; }

  // The address field may hold several addresses (space/comma separated) — the
  // netplan "multiple addresses on one interface" case.
  function addrsOf(s) { return (s || '').split(/[\s,]+/).filter(Boolean); }
  function isV6addr(a) { return /:/.test(a); }
  // A DNS/search field: same lenient split.
  function listOf(s) { return (s || '').split(/[\s,]+/).filter(Boolean); }
  // User-defined static routes on an interface — only those with a destination.
  function userRoutes(i) {
    return ((i && i.routes) || []).filter(function (r) { return r && r.to; });
  }
  // A route's family: from its destination, or (for "default") from its gateway.
  function routeIsV6(r) { return isV6addr(r.to === 'default' ? (r.via || '') : r.to); }

  // Resolve one custom interface into per-family facts, matching exactly what
  // the netplan side does with the same inputs. DHCP and a static address are
  // tracked SEPARATELY, not as one exclusive mode: netplan happily emits
  // `dhcp4: true` AND `addresses: [...]` together, so a declared address must
  // survive even when DHCP is on. Multiple addresses of either family are kept.
  //
  // Fallbacks that keep the three in step:
  //   * a family that's on but has nothing set at all → a lease (netplan's
  //     "sane default"), so an untouched interface still comes up;
  //   * IPv6 on with no DHCPv6 and no static → accept RAs (SLAAC), because
  //     netplan leaves accept-ra at its default (on).
  function ifaceModes(i, v4, v6) {
    var list = addrsOf(i.addr);
    var a4 = list.filter(function (a) { return !isV6addr(a); });
    var a6 = list.filter(isV6addr);
    var staticV4 = v4 && a4.length > 0;
    var staticV6 = v6 && a6.length > 0;
    var d4 = !!(v4 && i.dhcp4);
    var d6 = !!(v6 && i.dhcp6);
    if (!d4 && !d6 && !staticV4 && !staticV6) {   // nothing set anywhere
      if (v4) d4 = true; else if (v6) d6 = true;
    }
    return {
      v4on: v4, v6on: v6,
      d4: d4, d6: d6,                 // request a DHCP lease for this family
      staticV4: staticV4, staticV6: staticV6,
      addrs4: v4 ? a4 : [], addrs6: v6 ? a6 : [],
      ra6: v6 && !d6 && !staticV6,    // SLAAC via Router Advertisements
      metric: i.type === 'wifi' ? 600 : 100
    };
  }

  // IPv4 network address for a "ip/prefix" string, e.g. 192.168.1.10/24 ->
  // 192.168.1.0/24. Returns null for anything not a clean IPv4 CIDR (we only
  // compute on-link subnets for v4 — the case this actually matters for).
  function v4net(ip, prefix) {
    var p = parseInt(prefix, 10);
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || isNaN(p) || p < 0 || p > 32) return null;
    var o = ip.split('.').map(Number);
    if (o.some(function (x) { return x > 255; })) return null;
    var n = ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
    var mask = p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0;
    var net = (n & mask) >>> 0;
    return ((net >>> 24) & 255) + '.' + ((net >>> 16) & 255) + '.' +
           ((net >>> 8) & 255) + '.' + (net & 255) + '/' + p;
  }

  // Plan the routing for the custom interfaces. A static address with a gateway
  // gets a default route + metric. When two or more static ports carry a
  // gateway, OR two share an IPv4 subnet, the box is multi-homed: a single
  // routing table would send replies out whichever port owns the default route,
  // so return traffic for the other port takes an asymmetric path and gets
  // dropped by reverse-path filtering — the classic "two NICs, same range,
  // ping works one way" bug. The fix is one table per port plus a `from <ip>`
  // rule, so a reply always leaves the port its request arrived on.
  function routing(ifaces, v4, v6) {
    var statics = [];
    (ifaces || []).forEach(function (i, idx) {
      // Policy routing keys off the interface's PRIMARY address (the first one);
      // multi-address + same-subnet multi-homing is an edge we keep simple.
      var primary = addrsOf(i.addr)[0];
      if (!primary) return;
      var isV6 = isV6addr(primary);
      if (isV6 ? !v6 : !v4) return;
      statics.push({
        idx: idx, name: i.name || 'iface', isV6: isV6,
        addrIp: (primary.split('/')[0] || '').trim(),
        gw: (i.gw || '').trim(),
        subnet: isV6 ? null : v4net((primary.split('/')[0] || ''), (primary.split('/')[1] || '')),
        metric: i.type === 'wifi' ? 600 : 100
      });
    });
    var gwCount = statics.filter(function (s) { return s.gw; }).length;
    var subnetSeen = {}, shared = false;
    statics.forEach(function (s) {
      if (s.subnet) { if (subnetSeen[s.subnet]) shared = true; subnetSeen[s.subnet] = true; }
    });
    var multihomed = gwCount >= 2 || shared;
    var byIdx = {};
    statics.forEach(function (s, k) {
      s.table = multihomed ? 100 + k : null;   // one table per static port
      s.metric += k;                            // +k so main-table defaults never tie
      byIdx[s.idx] = s;
    });
    return { multihomed: multihomed, shared: shared, byIdx: byIdx, list: statics };
  }

  // Recommended when two ports share a subnet: stop ARP flux (a port answering
  // for the other's address) and let reverse-path filtering accept the source
  // routing above. Drop-in for /etc/sysctl.d/, same on every backend.
  function sysctlBlock(names) {
    var s = '# Multiple ports on the same subnet — put this in\n' +
      '# /etc/sysctl.d/10-multihome.conf and `sudo sysctl --system`:\n' +
      '#   net.ipv4.conf.all.rp_filter = 2        # loose RPF, not strict\n';
    (names || []).forEach(function (n) {
      s += '#   net.ipv4.conf.' + n + '.arp_ignore = 1     # answer ARP only for this port’s IP\n';
      s += '#   net.ipv4.conf.' + n + '.arp_announce = 2   # source ARP from this port’s IP\n';
    });
    return s;
  }

  // Comment out a block so it reads as an inline reference menu.
  function commentOut(text) {
    return text.split('\n').map(function (l) { return l.length ? '# ' + l : l; }).join('\n');
  }

  /* ====================================================================== *
   *  systemd-networkd
   * ====================================================================== *
   * Units live in /etc/systemd/network/ and are read in lexical order, so
   * the numeric prefix is load order, not decoration. The scheme used here:
   *   10-  physical links          20-  virtual device definitions (.netdev)
   *   25-  virtual device addressing (.network)
   * A .netdev CREATES a device; a .network CONFIGURES one that already
   * exists. Every virtual device therefore needs both.
   */

  function nwDhcpValue(v4, v6) {
    if (v4 && v6) return 'yes';
    if (v4) return 'ipv4';
    if (v6) return 'ipv6';
    return 'no';
  }

  // [Network] addressing body shared by physical and virtual links.
  function nwNetworkBody(o) {
    var full = o.full, v4 = o.v4, v6 = o.v6;
    var s = '[Network]\n';
    if (o.staticMode) {
      s += L('DHCP=no', full && 'static addressing below instead of a lease');
      (o.addrs || []).forEach(function (a) {
        s += L('Address=' + a, full && 'static address in CIDR form');
      });
      (o.gateways || []).forEach(function (g) {
        s += L('Gateway=' + g.via, full && g.note);
      });
      (o.dns || []).forEach(function (d) {
        s += L('DNS=' + d, full && 'resolver for this link');
      });
      if (full && o.search) s += L('Domains=example.local', 'search domain for unqualified names');
    } else {
      s += L('DHCP=' + nwDhcpValue(v4, v6), full && 'which families request a lease (yes|ipv4|ipv6|no)');
    }
    if (o.bridge) s += L('Bridge=' + o.bridge, full && 'enslave this link to the bridge');
    if (o.bond) s += L('Bond=' + o.bond, full && 'enslave this link to the bond');
    if (o.vlan) s += L('VLAN=' + o.vlan, full && 'carry this tagged sub-interface');
    if (o.tunnel) s += L('Tunnel=' + o.tunnel, full && 'attach the tunnel to this underlay');
    if (!v6) s += L('IPv6AcceptRA=no', full && 'ignore IPv6 Router Advertisements');
    else if (full && o.staticMode) s += L('IPv6AcceptRA=yes', 'honour RAs for SLAAC / on-link routes');
    if (v4 && !v6) s += L('LinkLocalAddressing=ipv4', full && 'keep only the IPv4 link-local address');
    else if (v6 && !v4) s += L('LinkLocalAddressing=ipv6', full && 'keep only the IPv6 link-local address');
    // Per-family DHCP tuning. RouteMetric is how you make wired beat Wi-Fi.
    if (!o.staticMode && v4) {
      s += '\n[DHCPv4]\n';
      s += L('RouteMetric=' + (o.metric || 100), full && 'default-route priority — lower wins');
      if (full) {
        s += L('UseDNS=yes', 'accept DNS servers offered in the lease');
        s += L('UseRoutes=yes', 'accept extra routes offered in the lease');
      }
    }
    if (!o.staticMode && v6) {
      s += '\n[DHCPv6]\n';
      s += L('RouteMetric=' + (o.metric || 100), full && 'default-route priority for the IPv6 lease');
    }
    // Static (non-default) routes get their own [Route] sections.
    (o.routes || []).forEach(function (r) {
      s += '\n[Route]\n';
      s += L('Destination=' + r.to, full && (r.note || 'static route destination'));
      if (r.via) s += L('Gateway=' + r.via, full && 'next hop');
      if (r.metric) s += L('Metric=' + r.metric, full && 'route priority — lower wins');
    });
    return s;
  }

  var NW_ETH_REF =
    '--- optional settings (uncomment to use) ---\n' +
    '[Link]\n' +
    'MTUBytes=1500                      # link MTU\n' +
    'MACAddress=00:11:22:33:44:55       # override the hardware address\n' +
    '\n' +
    '[Network]\n' +
    'IPForward=yes                      # route between interfaces\n' +
    'IPMasquerade=ipv4                  # NAT out of this link\n' +
    'ConfigureWithoutCarrier=yes        # come up with no link detected\n' +
    '\n' +
    '[Route]\n' +
    'Gateway=192.168.1.1                # extra/static route\n' +
    'Destination=10.0.0.0/8\n' +
    'Metric=100\n';

  function networkd(ctx) {
    var files = [];
    var full = ctx.full, ref = ctx.ref, v4 = ctx.v4, v6 = ctx.v6;
    var showcase = ctx.showcase !== undefined ? ctx.showcase : full;   // rare knobs
    var mods = ctx.modules, ifaces = ctx.ifaces || [];
    var custom = ifaces.length > 0;

    var head =
      '# systemd-networkd — ' + famLabel(v4, v6) + '\n' +
      '# Files go in /etc/systemd/network/ (root:root, 0644).\n' +
      '# The numeric prefix is LOAD ORDER: the first .network whose [Match]\n' +
      '# hits a link wins, so keep specific matches ahead of general ones.\n' +
      '#\n' +
      '# Apply:  sudo systemctl restart systemd-networkd\n' +
      '#         networkctl status        # verify before you log out\n' +
      '# There is no built-in rollback here — unlike netplan try, a bad file\n' +
      '# stays bad. On a remote box, keep a second session open.\n';

    /* -- physical links -------------------------------------------------- */
    if (custom) {
      var rt = routing(ifaces, v4, v6);
      ifaces.forEach(function (i, idx) {
        var isWifi = i.type === 'wifi';
        var m = ifaceModes(i, v4, v6);
        var p = rt.byIdx[idx];
        var s = (idx === 0 ? head + '\n' : '');
        s += '[Match]\n';
        s += L('Name=' + (i.name || 'iface'), full && 'match this interface by name');
        s += '\n[Network]\n';
        var dh = m.d4 && m.d6 ? 'yes' : m.d4 ? 'ipv4' : m.d6 ? 'ipv6' : 'no';
        s += L('DHCP=' + dh, full && 'which families request a lease');
        // Every declared static address is emitted (multiple allowed), whether
        // or not DHCP is also on — so the IPs the user typed are never lost.
        var lease = (m.staticV4 && m.d4) || (m.staticV6 && m.d6);
        m.addrs4.concat(m.addrs6).forEach(function (a) {
          s += L('Address=' + a, full && 'static address in CIDR form' + (lease ? ' (kept alongside the lease)' : ''));
        });
        if (!m.v6on) s += L('IPv6AcceptRA=no', full && 'ignore IPv6 Router Advertisements');
        else if (m.ra6) s += L('IPv6AcceptRA=yes', full && 'address via SLAAC from Router Advertisements');
        if (m.v4on && !m.v6on) s += L('LinkLocalAddressing=ipv4', full && 'keep only the IPv4 link-local address');
        else if (m.v6on && !m.v4on) s += L('LinkLocalAddressing=ipv6', full && 'keep only the IPv6 link-local address');
        // Per-interface DNS lives in [Network] (Domains= carries search domains).
        listOf(i.dns).forEach(function (d) { s += L('DNS=' + d, full && 'resolver for this link'); });
        if (listOf(i.search).length) s += L('Domains=' + listOf(i.search).join(' '), full && 'search domains for unqualified names');
        if (m.d4) {
          s += '\n[DHCPv4]\n';
          s += L('RouteMetric=' + m.metric, full && 'default-route priority — lower wins');
        }
        if (m.d6) {
          s += '\n[DHCPv6]\n';
          s += L('RouteMetric=' + m.metric, full && 'default-route priority for the IPv6 lease');
        }
        // Routing for a static address. The default (via the gateway) goes in
        // the MAIN table so the box itself can originate traffic — distinct
        // metrics keep it deterministic. When multi-homed we ALSO copy that
        // default plus the on-link subnet into this port's own table, and add a
        // `from` rule, so replies leave the port their request arrived on.
        if (p && p.gw) {
          s += '\n[Route]\n';
          s += L('Gateway=' + p.gw, full && 'default route (main table)');
          s += L('Metric=' + p.metric, full && 'priority — the lower-metric port wins for outbound');
        }
        if (p && p.table) {
          if (p.gw) {
            s += '\n[Route]\n';
            s += L('Gateway=' + p.gw, full && 'same default, in this port’s table');
            s += L('Table=' + p.table, full && '');
          }
          if (p.subnet) {
            s += '\n[Route]\n';
            s += L('Destination=' + p.subnet, full && 'on-link subnet, in this port’s table');
            s += L('Scope=link', full && 'directly reachable, no gateway');
            s += L('Table=' + p.table, full && 'so on-link replies use this port too');
          }
          s += '\n[RoutingPolicyRule]\n';
          s += L('From=' + p.addrIp, full && 'traffic sourced from this port’s address…');
          s += L('Table=' + p.table, full && '…is routed by this port’s table');
        }
        // User-defined static routes (to / via / metric / on-link). "default"
        // is expressed by a Gateway with no Destination in networkd.
        userRoutes(i).forEach(function (r) {
          s += '\n[Route]\n';
          if (r.to !== 'default') s += L('Destination=' + r.to, full && 'static route destination');
          if (r.via) s += L('Gateway=' + r.via, full && 'next hop');
          if (r.metric) s += L('Metric=' + r.metric, full && 'route priority — lower wins');
          if (r.onlink) s += L('GatewayOnLink=yes', full && 'gateway is directly reachable, not itself routed');
        });
        if (isWifi) {
          s += '\n' +
            '# networkd does NOT speak WPA. Association is a separate daemon:\n' +
            '#   sudo systemctl enable --now wpa_supplicant@' + (i.name || 'wlan0') + '.service\n' +
            '# with /etc/wpa_supplicant/wpa_supplicant-' + (i.name || 'wlan0') + '.conf:\n' +
            '#   network={\n' +
            '#     ssid="' + (i.ssid || 'MyWiFi') + '"\n' +
            '#     psk="' + (i.psk || 'mypassword') + '"\n' +
            '#   }\n' +
            '# (iwd is the lighter alternative.) This is the single biggest\n' +
            '# reason laptops run NetworkManager instead.\n';
        }
        if (ref) s += '\n' + commentOut(NW_ETH_REF);
        // Same-subnet multi-homing also needs the ARP/RPF sysctls; show them once.
        if (idx === 0 && rt.shared) {
          s += '\n' + sysctlBlock(rt.list.filter(function (x) { return !x.isV6; }).map(function (x) { return x.name; }));
        }
        files.push({ path: '/etc/systemd/network/10-' + (i.name || 'iface') + '.network', mode: 'ini', content: s });
      });
    } else if (mods.has('ethernets')) {
      var s = head + '\n[Match]\n';
      s += L('Name=enp1s0', full && 'match one NIC by its predictable name');
      if (showcase) s += L('# MACAddress=00:11:22:33:44:55', 'or bind to the card by MAC instead');
      s += '\n';
      s += nwNetworkBody({
        full: full, v4: v4, v6: v6, staticMode: full,
        addrs: full ? (v4 ? ['192.168.1.10/24'] : []).concat(v6 ? ['2001:db8::10/64'] : []) : [],
        gateways: full ? (v4 ? [{ via: '192.168.1.1', note: 'IPv4 default gateway' }] : [])
          .concat(v6 ? [{ via: '2001:db8::1', note: 'IPv6 default gateway' }] : []) : [],
        routes: full && v4 ? [{ to: '10.0.0.0/8', via: '192.168.1.254', metric: 100, note: 'static route to another subnet (VPN, lab, DC…)' }] : [],
        dns: full ? (v4 ? ['8.8.8.8', '8.8.4.4'] : []).concat(v6 ? ['2001:4860:4860::8888'] : []) : [],
        search: full && v4, metric: 100
      });
      if (showcase) {
        s += '\n[Link]\n';
        s += L('MTUBytes=1500', 'link MTU in bytes (1500 = standard Ethernet)');
      }
      if (ref) s += '\n' + commentOut(NW_ETH_REF);
      files.push({ path: '/etc/systemd/network/10-enp1s0.network', mode: 'ini', content: s });
    }

    if (!custom && mods.has('wifis')) {
      var w = '[Match]\n';
      w += L('Name=wlp2s0', full && 'the Wi-Fi interface');
      w += '\n';
      w += nwNetworkBody({ full: full, v4: v4, v6: v6, metric: 600 });
      w += '\n' +
        '# IMPORTANT: networkd handles ADDRESSING only — it cannot associate\n' +
        '# with an access point. Pair it with wpa_supplicant or iwd:\n' +
        '#   sudo systemctl enable --now wpa_supplicant@wlp2s0.service\n' +
        '# /etc/wpa_supplicant/wpa_supplicant-wlp2s0.conf:\n' +
        '#   ctrl_interface=/run/wpa_supplicant\n' +
        '#   network={\n' +
        '#     ssid="MyWiFi"\n' +
        '#     psk="mypassword"\n' +
        '#   }\n' +
        '# Store that file 0600 — it holds the passphrase in clear text.\n';
      files.push({ path: '/etc/systemd/network/10-wlp2s0.network', mode: 'ini', content: w });
    }

    /* -- virtual devices: each needs a .netdev AND a .network ------------- */

    if (mods.has('bridges')) {
      var nd = '[NetDev]\n';
      nd += L('Name=br0', full && 'the bridge device to create');
      nd += L('Kind=bridge', full && 'a software switch');
      if (showcase) {
        nd += '\n[Bridge]\n';
        nd += L('STP=yes', 'run Spanning Tree to prevent forwarding loops');
        nd += L('ForwardDelaySec=4', 'seconds a port waits before forwarding');
      }
      files.push({ path: '/etc/systemd/network/20-br0.netdev', mode: 'ini', content: nd });
      files.push({
        path: '/etc/systemd/network/25-br0.network', mode: 'ini',
        content: '[Match]\n' + L('Name=br0', full && 'address the bridge itself, not its ports') + '\n' +
          nwNetworkBody({
            full: full, v4: v4, v6: v6, staticMode: full,
            addrs: full ? (v4 ? ['192.168.1.5/24'] : []).concat(v6 ? ['2001:db8:0:1::5/64'] : []) : [],
            gateways: full && v4 ? [{ via: '192.168.1.1', note: 'IPv4 default gateway' }] : [],
            dns: full ? ['1.1.1.1'] : [], metric: 100
          })
      });
      files.push({
        path: '/etc/systemd/network/10-br0-port-eth0.network', mode: 'ini',
        content: '# A bridge PORT carries no address of its own — it only joins.\n' +
          '[Match]\n' + L('Name=eth0', full && 'the member NIC') + '\n' +
          '[Network]\n' + L('Bridge=br0', full && 'enslave this NIC to br0')
      });
    }

    if (mods.has('vlans')) {
      var vd = '[NetDev]\n';
      vd += L('Name=vlan100', full && 'name of the tagged sub-interface');
      vd += L('Kind=vlan', full && '802.1Q VLAN device');
      vd += '\n[VLAN]\n';
      vd += L('Id=100', full && '802.1Q tag, 1–4094');
      files.push({ path: '/etc/systemd/network/20-vlan100.netdev', mode: 'ini', content: vd });
      files.push({
        path: '/etc/systemd/network/10-eth0-vlan-parent.network', mode: 'ini',
        content: '# The PARENT link must be told to carry the VLAN device.\n' +
          '[Match]\n' + L('Name=eth0', full && 'the trunk port') + '\n' +
          '[Network]\n' + L('VLAN=vlan100', full && 'attach the tagged sub-interface here')
      });
      files.push({
        path: '/etc/systemd/network/25-vlan100.network', mode: 'ini',
        content: '[Match]\n' + L('Name=vlan100', full && 'address the VLAN interface') + '\n' +
          nwNetworkBody({
            full: full, v4: v4, v6: v6, staticMode: true,
            addrs: (v4 ? ['192.168.100.2/24'] : []).concat(v6 ? ['2001:db8:100::2/64'] : []), metric: 100
          }) +
          (showcase ? '\n[Link]\n' + L('MTUBytes=1450', 'leave room for the 4-byte VLAN tag') : '')
      });
    }

    if (mods.has('bonds')) {
      var bd = '[NetDev]\n';
      bd += L('Name=bond0', full && 'the aggregated device');
      bd += L('Kind=bond', full && 'link aggregation');
      bd += '\n[Bond]\n';
      bd += L('Mode=active-backup', full && 'one active link (or balance-rr, 802.3ad)');
      if (showcase) bd += L('MIIMonitorSec=100ms', 'link-health poll interval');
      files.push({ path: '/etc/systemd/network/20-bond0.netdev', mode: 'ini', content: bd });
      files.push({
        path: '/etc/systemd/network/10-bond0-members.network', mode: 'ini',
        content: '# Matches BOTH members with one glob — they carry no address.\n' +
          '[Match]\n' + L('Name=eth0 eth1', full && 'space-separated list, globs allowed') + '\n' +
          '[Network]\n' + L('Bond=bond0', full && 'enslave both NICs to the bond')
      });
      files.push({
        path: '/etc/systemd/network/25-bond0.network', mode: 'ini',
        content: '[Match]\n' + L('Name=bond0', full && 'address the bond itself') + '\n' +
          nwNetworkBody({ full: full, v4: v4, v6: v6, metric: 100 })
      });
    }

    if (mods.has('tunnels')) {
      var v6only = v6 && !v4;
      var td = '[NetDev]\n';
      td += L('Name=gre1', full && 'the tunnel interface');
      td += L('Kind=' + (v6only ? 'ip6gre' : 'gre'), full && (v6only ? 'GRE over an IPv6 underlay' : 'GRE over an IPv4 underlay'));
      td += '\n[Tunnel]\n';
      td += L('Local=' + (v6only ? '2001:db8::1' : '192.168.1.10'), full && "this host's tunnel endpoint");
      td += L('Remote=' + (v6only ? '2001:db8::2' : '192.168.2.10'), full && "the peer's tunnel endpoint");
      if (showcase) td += L('TTL=64', 'TTL / hop-limit stamped on encapsulated packets');
      files.push({ path: '/etc/systemd/network/20-gre1.netdev', mode: 'ini', content: td });
      files.push({
        path: '/etc/systemd/network/25-gre1.network', mode: 'ini',
        content: '[Match]\n' + L('Name=gre1', full && 'address the tunnel interface') + '\n' +
          nwNetworkBody({
            full: full, v4: v4, v6: v6, staticMode: true,
            addrs: (v4 ? ['10.1.1.1/30'] : []).concat(v6 ? ['fd00:1::1/64'] : []), metric: 100
          })
      });
    }

    if (mods.has('veth')) {
      var vd2 = '[NetDev]\n';
      vd2 += L('Name=veth-host', full && 'this end of the virtual cable');
      vd2 += L('Kind=veth', full && 'virtual ethernet pair');
      vd2 += '\n[Peer]\n';
      vd2 += L('Name=veth-peer', full && 'the other end, created with it');
      files.push({ path: '/etc/systemd/network/20-veth-host.netdev', mode: 'ini', content: vd2 });
      files.push({
        path: '/etc/systemd/network/25-veth-host.network', mode: 'ini',
        content: '[Match]\n' + L('Name=veth-host', full && 'address the host side') + '\n' +
          nwNetworkBody({
            full: full, v4: v4, v6: v6, staticMode: true,
            addrs: (v4 ? ['169.254.1.1/30'] : []).concat(v6 ? ['fd00:2::1/64'] : []), metric: 100
          })
      });
    }

    if (mods.has('dummy')) {
      files.push({
        path: '/etc/systemd/network/20-dm0.netdev', mode: 'ini',
        content: '[NetDev]\n' + L('Name=dm0', full && 'the dummy device to create') +
          L('Kind=dummy', full && 'an always-up virtual NIC')
      });
      files.push({
        path: '/etc/systemd/network/25-dm0.network', mode: 'ini',
        content: '[Match]\n' + L('Name=dm0', full && 'address the dummy device') + '\n' +
          nwNetworkBody({
            full: full, v4: v4, v6: v6, staticMode: true,
            addrs: (v4 ? ['10.10.10.1/32'] : []).concat(v6 ? ['fd00:d0::1/128'] : []), metric: 100
          })
      });
    }

    if (mods.has('vrf')) {
      files.push({
        path: '/etc/systemd/network/20-vrf-blue.netdev', mode: 'ini',
        content: '[NetDev]\n' + L('Name=vrf-blue', full && 'the VRF device to create') +
          L('Kind=vrf', full && 'virtual routing & forwarding domain') +
          '\n[VRF]\n' + L('Table=100', full && 'the routing table this VRF owns')
      });
      files.push({
        path: '/etc/systemd/network/25-vrf-blue.network', mode: 'ini',
        content: '[Match]\n' + L('Name=vrf-blue', full && 'the VRF device itself') + '\n' +
          '[Route]\n' + L('Gateway=' + (v6 && !v4 ? 'fd00::1' : '10.0.0.1'), full && 'default route inside the VRF table') +
          L('Table=100', full && 'installed in the VRF table, not main')
      });
      files.push({
        path: '/etc/systemd/network/10-eth0-vrf.network', mode: 'ini',
        content: '# A VRF MEMBER is enslaved to the VRF; its traffic uses table 100.\n' +
          '[Match]\n' + L('Name=eth0', full && 'the member link') + '\n' +
          '[Network]\n' + L('VRF=vrf-blue', full && 'enslave this link to the VRF')
      });
    }

    if (!files.length) {
      files.push({
        path: '/etc/systemd/network/10-enp1s0.network', mode: 'ini',
        content: head + '\n# No modules selected — enable one on the right.\n'
      });
    }
    return files;
  }

  /* ====================================================================== *
   *  NetworkManager (keyfile plugin)
   * ====================================================================== *
   * One file per CONNECTION PROFILE, not per device. A profile can be
   * inactive, and a device can have several. NM refuses to load a keyfile
   * that is group- or world-readable, because it may hold a passphrase.
   */

  // method=auto with static addresses present means "DHCP *and* these extra
  // static addresses" — NM applies both, which is how a declared IP survives
  // even with DHCP on, matching the netplan and networkd tabs.
  function nmIpv4(o) {
    var full = o.full;
    var s = '\n[ipv4]\n';
    if (!o.v4) return s + L('method=disabled', full && 'no IPv4 on this profile');
    var hasStatic = o.addrs && o.addrs.length;
    var method = o.dhcp ? 'auto' : (hasStatic ? 'manual' : 'auto');
    var both = o.dhcp && hasStatic;
    s += L('method=' + method, full && (method === 'manual' ? 'static addressing'
      : both ? 'DHCPv4, plus the static address(es) below' : 'DHCPv4'));
    if (hasStatic) o.addrs.forEach(function (a, n) {
      s += L('address' + (n + 1) + '=' + a, full && 'CIDR address[,gateway] — numbered, 1-based');
    });
    (o.routes || []).forEach(function (r, n) {
      s += L('route' + (n + 1) + '=' + r.to + ',' + r.via + (r.metric ? ',' + r.metric : ''), full && (r.note || 'static route'));
    });
    if (o.dns && o.dns.length) s += L('dns=' + o.dns.join(';') + ';', full && 'resolvers, semicolon-separated, trailing ;');
    if (full && o.search) s += L('dns-search=example.local;', 'search domain for unqualified names');
    if (o.dhcp) s += L('route-metric=' + (o.metric || 100), full && 'default-route priority — lower wins');
    return s;
  }

  function nmIpv6(o) {
    var full = o.full;
    var s = '\n[ipv6]\n';
    if (!o.v6) return s + L('method=disabled', full && 'no IPv6 on this profile');
    var hasStatic = o.addrs6 && o.addrs6.length;
    var method = o.dhcp ? 'auto' : (hasStatic ? 'manual' : 'auto');
    var both = o.dhcp && hasStatic;
    s += L('method=' + method, full && (method === 'manual' ? 'static IPv6'
      : both ? 'SLAAC / DHCPv6, plus the static address(es) below' : 'SLAAC / DHCPv6 as offered'));
    if (hasStatic) o.addrs6.forEach(function (a, n) {
      s += L('address' + (n + 1) + '=' + a, full && 'CIDR address[,gateway]');
    });
    if (o.dhcp) s += L('route-metric=' + (o.metric || 100), full && 'default-route priority');
    if (full && method === 'auto') s += L('addr-gen-mode=stable-privacy', 'stable but non-MAC-derived interface IDs');
    return s;
  }

  function nmHead(id, type, iface, full) {
    var s = '[connection]\n';
    s += L('id=' + id, full && 'profile name, as shown by nmcli');
    s += L('type=' + type, full && 'connection type');
    if (iface) s += L('interface-name=' + iface, full && 'device this profile binds to');
    return s;
  }

  // Build one whole [ipvN] section for a custom interface: method, every
  // address, the main-table default + metric, any policy-routing table copies
  // and source rule, the user's static routes, and DNS — all with a single
  // route-number counter so the keyfile stays valid. `pf` is the routing() plan
  // entry only when it belongs to THIS family; `uroutes` are the user routes
  // whose destination is in this family.
  function nmFamily(fam, o) {
    var isV6 = fam === 'v6';
    var s = '\n[' + (isV6 ? 'ipv6' : 'ipv4') + ']\n';
    if (!o.on) return s + L('method=disabled', o.full && 'no ' + (isV6 ? 'IPv6' : 'IPv4') + ' on this profile');
    var hasStatic = o.addrs && o.addrs.length;
    var method = o.dhcp ? 'auto' : (hasStatic ? 'manual' : 'auto');
    var both = o.dhcp && hasStatic;
    s += L('method=' + method, o.full && (method === 'manual' ? 'static addressing'
      : both ? (isV6 ? 'SLAAC / DHCPv6' : 'DHCPv4') + ', plus the static address(es) below'
             : (isV6 ? 'SLAAC / DHCPv6 as offered' : 'DHCPv4')));
    (o.addrs || []).forEach(function (a, n) {
      s += L('address' + (n + 1) + '=' + a, o.full && 'CIDR address[,gateway] — numbered, 1-based');
    });
    var pf = o.plan;   // routing plan entry, only if this family owns the primary address
    if (pf && pf.gw) {
      s += L('gateway=' + pf.gw, o.full && 'default route (main table)');
      s += L('route-metric=' + pf.metric, o.full && 'priority — the lower-metric port wins for outbound');
    } else if (o.dhcp) {
      s += L('route-metric=' + o.metric, o.full && 'default-route priority');
    }
    var rn = 1;
    if (pf && pf.table) {
      var any = isV6 ? '::/0' : '0.0.0.0/0', host = isV6 ? '/128' : '/32';
      if (pf.gw) {
        s += L('route' + rn + '=' + any + ',' + pf.gw + ',' + pf.metric, o.full && 'same default, in this port’s table');
        s += L('route' + rn + '_options=table=' + pf.table, o.full && ''); rn++;
      }
      if (pf.subnet) {
        s += L('route' + rn + '=' + pf.subnet, o.full && 'on-link subnet in this port’s table');
        s += L('route' + rn + '_options=table=' + pf.table, o.full && 'so on-link replies use this port too'); rn++;
      }
      s += L('routing-rule1=priority ' + pf.table + ' from ' + pf.addrIp + host + ' table ' + pf.table,
        o.full && 'source rule: replies from this port use its table');
    }
    (o.routes || []).forEach(function (r) {
      var dest = r.to === 'default' ? (isV6 ? '::/0' : '0.0.0.0/0') : r.to;
      var parts = [dest];
      if (r.via || r.metric) parts.push(r.via || '');
      if (r.metric) parts.push(r.metric);
      s += L('route' + rn + '=' + parts.join(','), o.full && 'static route');
      if (r.onlink) s += L('route' + rn + '_options=onlink=true', o.full && 'gateway is directly reachable');
      rn++;
    });
    if (o.dns && o.dns.length) s += L('dns=' + o.dns.join(';') + ';', o.full && 'resolvers, semicolon-separated, trailing ;');
    if (o.search && o.search.length) s += L('dns-search=' + o.search.join(';') + ';', o.full && 'search domains');
    if (o.full && !hasStatic && method === 'auto' && isV6) s += L('addr-gen-mode=stable-privacy', 'stable but non-MAC-derived interface IDs');
    return s;
  }

  var NM_REF =
    '--- optional settings (uncomment to use) ---\n' +
    '[connection]\n' +
    'autoconnect=true                   # come up automatically\n' +
    'autoconnect-priority=10            # higher wins when several match\n' +
    'metered=false\n' +
    '\n' +
    '[ipv4]\n' +
    'may-fail=false                     # block boot until IPv4 is up\n' +
    'ignore-auto-dns=true               # discard DNS from the lease\n' +
    'never-default=true                 # never install a default route\n' +
    '\n' +
    '[ethernet]\n' +
    'mtu=1500\n' +
    'cloned-mac-address=random          # MAC randomisation\n';

  function networkmanager(ctx) {
    var files = [];
    var full = ctx.full, ref = ctx.ref, v4 = ctx.v4, v6 = ctx.v6;
    var showcase = ctx.showcase !== undefined ? ctx.showcase : full;   // rare knobs
    var mods = ctx.modules, ifaces = ctx.ifaces || [];
    var custom = ifaces.length > 0;
    var DIR = '/etc/NetworkManager/system-connections/';

    var head =
      '# NetworkManager keyfile — ' + famLabel(v4, v6) + '\n' +
      '# Save under ' + DIR + '\n' +
      '#\n' +
      '# PERMISSIONS ARE NOT OPTIONAL. NM ignores any keyfile that is\n' +
      '# readable beyond root, because these files can hold passphrases:\n' +
      '#   sudo chown root:root <file> && sudo chmod 600 <file>\n' +
      '#\n' +
      '# Apply:  sudo nmcli connection reload\n' +
      '#         sudo nmcli connection up <id>\n' +
      '# nmcli device status    # verify before you log out\n';

    if (custom) {
      var rt = routing(ifaces, v4, v6);
      ifaces.forEach(function (i, idx) {
        var isWifi = i.type === 'wifi';
        var m = ifaceModes(i, v4, v6);
        var p = rt.byIdx[idx];
        var name = i.name || 'iface';
        var s = (idx === 0 ? head + '\n' : '');
        s += nmHead(name, isWifi ? 'wifi' : 'ethernet', name, full);
        if (isWifi) {
          s += '\n[wifi]\n';
          s += L('mode=infrastructure', full && 'join an access point (not ad-hoc/AP)');
          s += L('ssid=' + (i.ssid || 'MyWiFi'), full && 'network name');
          s += '\n[wifi-security]\n';
          s += L('key-mgmt=wpa-psk', full && 'WPA/WPA2 personal');
          s += L('psk=' + (i.psk || 'mypassword'), full && 'passphrase — why this file must be 0600');
        }
        // DHCPv6 and RA both map to method=auto: NM's auto already means "take
        // SLAAC and/or a lease, whichever the link offers". Each family's whole
        // section — addresses, gateway, policy routing, user routes, DNS — is
        // built by nmFamily so route numbering stays valid. User static routes
        // and DNS entries are filed under the family of their destination.
        var uroutes = userRoutes(i);
        var dnsList = listOf(i.dns), searchList = listOf(i.search);
        s += nmFamily('v4', {
          full: full, on: m.v4on, dhcp: m.d4, addrs: m.addrs4, metric: m.metric,
          plan: (p && !p.isV6) ? p : null,
          routes: uroutes.filter(function (r) { return !routeIsV6(r); }),
          dns: dnsList.filter(function (d) { return !isV6addr(d); }), search: searchList
        });
        s += nmFamily('v6', {
          full: full, on: m.v6on, dhcp: m.d6 || m.ra6, addrs: m.addrs6, metric: m.metric,
          plan: (p && p.isV6) ? p : null,
          routes: uroutes.filter(routeIsV6),
          dns: dnsList.filter(isV6addr), search: m.v4on ? [] : searchList
        });
        if (ref) s += '\n' + commentOut(NM_REF);
        if (idx === 0 && rt.shared) {
          s += '\n' + sysctlBlock(rt.list.filter(function (x) { return !x.isV6; }).map(function (x) { return x.name; }));
        }
        files.push({ path: DIR + name + '.nmconnection', mode: 'ini', content: s });
      });
    } else if (mods.has('ethernets')) {
      var s2 = head + '\n' + nmHead('enp1s0', 'ethernet', 'enp1s0', full);
      s2 += nmIpv4({
        full: full, v4: v4, dhcp: !full,
        addrs: full && v4 ? ['192.168.1.10/24,192.168.1.1'] : [],
        routes: full && v4 ? [{ to: '10.0.0.0/8', via: '192.168.1.254', metric: 100, note: 'static route to another subnet (VPN, lab, DC…)' }] : [],
        dns: full && v4 ? ['8.8.8.8', '8.8.4.4'] : [], search: full && v4, metric: 100
      });
      s2 += nmIpv6({
        full: full, v6: v6, dhcp: !full,
        addrs6: full && v6 ? ['2001:db8::10/64,2001:db8::1'] : [], metric: 100
      });
      if (ref) s2 += '\n' + commentOut(NM_REF);
      files.push({ path: DIR + 'enp1s0.nmconnection', mode: 'ini', content: s2 });
    }

    if (!custom && mods.has('wifis')) {
      var w = nmHead('MyWiFi', 'wifi', 'wlp2s0', full);
      w += '\n[wifi]\n';
      w += L('mode=infrastructure', full && 'join an access point');
      w += L('ssid=MyWiFi', full && 'network name');
      if (showcase) w += L('hidden=false', 'set true for a non-broadcast SSID');
      w += '\n[wifi-security]\n';
      w += L('key-mgmt=wpa-psk', full && 'WPA/WPA2 personal');
      w += L('psk=mypassword', full && 'passphrase, clear text — keep the file 0600');
      w += nmIpv4({ full: full, v4: v4, dhcp: true, metric: 600 });
      w += nmIpv6({ full: full, v6: v6, dhcp: true, metric: 600 });
      w += '\n# Unlike networkd, NM associates AND addresses — no wpa_supplicant\n' +
        '# config of your own, no second daemon to enable.\n';
      files.push({ path: DIR + 'MyWiFi.nmconnection', mode: 'ini', content: w });
    }

    if (mods.has('bridges')) {
      var b = nmHead('br0', 'bridge', 'br0', full);
      if (showcase) {
        b += '\n[bridge]\n';
        b += L('stp=true', 'run Spanning Tree to prevent loops');
        b += L('forward-delay=4', 'seconds a port waits before forwarding');
      }
      b += nmIpv4({
        full: full, v4: v4, dhcp: !full,
        addrs: full && v4 ? ['192.168.1.5/24,192.168.1.1'] : [], dns: full && v4 ? ['1.1.1.1'] : [], metric: 100
      });
      b += nmIpv6({ full: full, v6: v6, dhcp: true, metric: 100 });
      files.push({ path: DIR + 'br0.nmconnection', mode: 'ini', content: b });
      var bp = nmHead('br0-port-eth0', 'ethernet', 'eth0', full);
      bp += L('master=br0', full && 'the bridge this port joins');
      bp += L('slave-type=bridge', full && 'how it joins (NM 1.46+ also accepts controller=/port-type=)');
      bp += '\n# A port profile carries no [ipv4]/[ipv6] — the bridge holds the address.\n';
      files.push({ path: DIR + 'br0-port-eth0.nmconnection', mode: 'ini', content: bp });
    }

    if (mods.has('vlans')) {
      var vl = nmHead('vlan100', 'vlan', 'vlan100', full);
      vl += '\n[vlan]\n';
      vl += L('id=100', full && '802.1Q tag, 1–4094');
      vl += L('parent=eth0', full && 'trunk interface carrying the tagged frames');
      vl += nmIpv4({
        full: full, v4: v4, dhcp: false,
        addrs: v4 ? ['192.168.100.2/24'] : [], metric: 100
      });
      vl += nmIpv6({
        full: full, v6: v6, dhcp: false,
        addrs6: v6 ? ['2001:db8:100::2/64'] : [], metric: 100
      });
      files.push({ path: DIR + 'vlan100.nmconnection', mode: 'ini', content: vl });
    }

    if (mods.has('bonds')) {
      var bo = nmHead('bond0', 'bond', 'bond0', full);
      bo += '\n[bond]\n';
      bo += L('mode=active-backup', full && 'one active link (or balance-rr, 802.3ad)');
      if (showcase) bo += L('miimon=100', 'link-health poll interval in ms');
      bo += nmIpv4({ full: full, v4: v4, dhcp: true, metric: 100 });
      bo += nmIpv6({ full: full, v6: v6, dhcp: true, metric: 100 });
      files.push({ path: DIR + 'bond0.nmconnection', mode: 'ini', content: bo });
      ['eth0', 'eth1'].forEach(function (m) {
        var p = nmHead('bond0-port-' + m, 'ethernet', m, full);
        p += L('master=bond0', full && 'the bond this link joins');
        p += L('slave-type=bond', full && 'joins as a bond member');
        files.push({ path: DIR + 'bond0-port-' + m + '.nmconnection', mode: 'ini', content: p });
      });
    }

    if (mods.has('tunnels')) {
      var v6only = v6 && !v4;
      var t = nmHead('gre1', 'ip-tunnel', 'gre1', full);
      t += '\n[ip-tunnel]\n';
      t += L('mode=' + (v6only ? '8' : '2'), full && (v6only ? '8 = IP6GRE' : '2 = GRE') + ' — NM uses a numeric enum here');
      t += L('local=' + (v6only ? '2001:db8::1' : '192.168.1.10'), full && "this host's endpoint");
      t += L('remote=' + (v6only ? '2001:db8::2' : '192.168.2.10'), full && "the peer's endpoint");
      t += nmIpv4({ full: full, v4: v4, dhcp: false, addrs: v4 ? ['10.1.1.1/30'] : [], metric: 100 });
      t += nmIpv6({ full: full, v6: v6, dhcp: false, addrs6: v6 ? ['fd00:1::1/64'] : [], metric: 100 });
      files.push({ path: DIR + 'gre1.nmconnection', mode: 'ini', content: t });
    }

    if (mods.has('veth')) {
      var ve = nmHead('veth-host', 'veth', 'veth-host', full);
      ve += '\n[veth]\n';
      ve += L('peer=veth-peer', full && 'the other end of the pair');
      ve += nmIpv4({ full: full, v4: v4, dhcp: false, addrs: v4 ? ['169.254.1.1/30'] : [], metric: 100 });
      ve += nmIpv6({ full: full, v6: v6, dhcp: false, addrs6: v6 ? ['fd00:2::1/64'] : [], metric: 100 });
      ve += '\n# veth needs NetworkManager 1.30 or newer.\n';
      files.push({ path: DIR + 'veth-host.nmconnection', mode: 'ini', content: ve });
    }

    if (mods.has('dummy')) {
      var dm = nmHead('dm0', 'dummy', 'dm0', full);
      dm += nmIpv4({ full: full, v4: v4, dhcp: false, addrs: v4 ? ['10.10.10.1/32'] : [], metric: 100 });
      dm += nmIpv6({ full: full, v6: v6, dhcp: false, addrs6: v6 ? ['fd00:d0::1/128'] : [], metric: 100 });
      dm += '\n# type=dummy needs NetworkManager 1.34 or newer.\n';
      files.push({ path: DIR + 'dm0.nmconnection', mode: 'ini', content: dm });
    }

    if (mods.has('vrf')) {
      var vf = nmHead('vrf-blue', 'vrf', 'vrf-blue', full);
      vf += '\n[vrf]\n';
      vf += L('table=100', full && 'the routing table this VRF owns');
      files.push({ path: DIR + 'vrf-blue.nmconnection', mode: 'ini', content: vf });
      var vm = nmHead('vrf-blue-port-eth0', 'ethernet', 'eth0', full);
      vm += L('master=vrf-blue', full && 'the VRF this link is enslaved to');
      vm += L('slave-type=vrf', full && 'joins as a VRF member');
      vm += '\n# type=vrf needs NetworkManager 1.24 or newer.\n';
      files.push({ path: DIR + 'vrf-blue-port-eth0.nmconnection', mode: 'ini', content: vm });
    }

    if (!files.length) {
      files.push({ path: DIR + 'enp1s0.nmconnection', mode: 'ini', content: head + '\n# No modules selected — enable one on the right.\n' });
    }
    return files;
  }

  /* ====================================================================== *
   *  Evaluate — how the three actually compare
   * ====================================================================== */

  var EVAL = {
    // The single most misunderstood point, so it leads the panel.
    lede: 'Netplan is <b>not a peer</b> of the other two. It is a YAML front-end that ' +
      '<b>generates</b> systemd-networkd or NetworkManager configuration and then hands over. ' +
      'Choosing netplan still means choosing a renderer underneath — the real question is ' +
      'which of the other two runs your machine, and whether you want to write it directly.',
    rows: [
      ['What it is', 'YAML front-end / generator', 'systemd daemon', 'daemon + CLI/GUI/applet'],
      ['Config format', 'One YAML file', 'Many INI units', 'One INI keyfile per profile'],
      ['Where', '/etc/netplan/*.yaml', '/etc/systemd/network/', '/etc/NetworkManager/system-connections/'],
      ['Ships by default on', 'Ubuntu', 'Debian minimal, Arch, containers', 'Fedora, RHEL, most desktops'],
      ['Wi-Fi', 'Delegates to the renderer', '<b class="no">No WPA</b> — needs wpa_supplicant/iwd', '<b class="yes">Native</b>'],
      ['VPN / WWAN / roaming', 'Delegates', '<b class="no">Not its job</b>', '<b class="yes">Built in</b>'],
      ['Safe rollback', '<b class="yes">netplan try</b> — auto-reverts', '<b class="no">None built in</b>', 'Manual (<code>nmcli con up</code>)'],
      ['Per-user / desktop UX', 'None', 'None', '<b class="yes">Full</b>'],
      ['Footprint', 'Generator only, no daemon', '<b class="yes">Smallest</b>', 'Heaviest'],
      ['Applies at', 'netplan apply', 'systemctl restart systemd-networkd', 'nmcli connection reload'],
    ],
    verdicts: [
      ['Servers, VMs, containers', 'systemd-networkd',
        'Already present wherever systemd is, no extra daemon, deterministic files, nothing that reconnects behind your back. The missing Wi-Fi support does not matter on a machine with a cable.'],
      ['Laptops and desktops', 'NetworkManager',
        'Wi-Fi association, VPN, mobile broadband, per-user profiles and roaming are the whole job here, and networkd does none of them. This is why every mainstream desktop ships it.'],
      ['Ubuntu, or one file to describe a host', 'Netplan',
        'Worth it mainly for <code>netplan try</code>, which reverts automatically if you lock yourself out — the only safe-by-default apply of the three. Remember it still renders to one of the others.'],
    ],
    gotchas: [
      'Do not run networkd and NetworkManager on the same interface. Both will manage it and fight; pick one per device (NM honours <code>unmanaged-devices</code>).',
      'A NetworkManager keyfile that is readable beyond root is <b>silently ignored</b>. <code>chmod 600</code> is part of the config, not a nicety.',
      'systemd-networkd has no <code>netplan try</code>. On a remote host, keep a second session open, or schedule a reboot you can cancel.',
      'Netplan writes generated files into <code>/run</code>; editing those does nothing. Edit the YAML and re-run <code>netplan generate</code>.',
      'Renaming interfaces (netplan <code>set-name</code>, networkd <code>[Link] Name=</code>) belongs in a <code>.link</code> file applied by udev at rename time — set it and reboot, do not expect a live rename.',
    ]
  };

  global.CarinoNet = {
    render: function (backend, ctx) {
      if (backend === 'networkd') return networkd(ctx);
      if (backend === 'nm') return networkmanager(ctx);
      return null;   // netplan is rendered by index.html's own builders
    },
    // Shared so the netplan builder in index.html parses/plans identically.
    routing: routing,
    sysctlBlock: sysctlBlock,
    addrsOf: addrsOf,
    listOf: listOf,
    isV6addr: isV6addr,
    userRoutes: userRoutes,
    EVAL: EVAL
  };
})(window);
