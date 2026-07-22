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

  // Resolve one custom interface into a per-family mode, matching what the
  // netplan side means by the same inputs. The subtle one is IPv6: netplan
  // leaves accept-ra at its default (on) unless you say otherwise, so an
  // interface with the v6 family enabled but nothing v6-specific set still
  // gets SLAAC. Emitting "off" here instead would silently disagree with the
  // netplan tab for the very same intent.
  //   'dhcp' lease · 'static' address · 'ra' router advertisements · 'off'
  function ifaceModes(i, v4, v6) {
    var addrV6 = /:/.test(i.addr || '');
    var hasAddr = !!i.addr;
    var staticV4 = hasAddr && !addrV6 && v4;
    var staticV6 = hasAddr && addrV6 && v6;
    var d4 = v4 && i.dhcp4, d6 = v6 && i.dhcp6;
    var nothingSet = !d4 && !d6 && !staticV4 && !staticV6;
    return {
      v4: !v4 ? 'off' : d4 ? 'dhcp' : staticV4 ? 'static' : nothingSet ? 'dhcp' : 'off',
      v6: !v6 ? 'off' : d6 ? 'dhcp' : staticV6 ? 'static' : 'ra',
      addr: i.addr, addrV6: addrV6,
      metric: i.type === 'wifi' ? 600 : 100
    };
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
      ifaces.forEach(function (i, idx) {
        var isWifi = i.type === 'wifi';
        var m = ifaceModes(i, v4, v6);
        var s = (idx === 0 ? head + '\n' : '');
        s += '[Match]\n';
        s += L('Name=' + (i.name || 'iface'), full && 'match this interface by name');
        s += '\n[Network]\n';
        var dh = m.v4 === 'dhcp' && m.v6 === 'dhcp' ? 'yes'
               : m.v4 === 'dhcp' ? 'ipv4' : m.v6 === 'dhcp' ? 'ipv6' : 'no';
        s += L('DHCP=' + dh, full && 'which families request a lease');
        if (m.v4 === 'static' || m.v6 === 'static') {
          s += L('Address=' + m.addr, full && 'static address in CIDR form');
        }
        if (m.v6 === 'off') s += L('IPv6AcceptRA=no', full && 'ignore IPv6 Router Advertisements');
        else if (m.v6 === 'ra') s += L('IPv6AcceptRA=yes', full && 'address via SLAAC from Router Advertisements');
        if (m.v4 !== 'off' && m.v6 === 'off') s += L('LinkLocalAddressing=ipv4', full && 'keep only the IPv4 link-local address');
        else if (m.v6 !== 'off' && m.v4 === 'off') s += L('LinkLocalAddressing=ipv6', full && 'keep only the IPv6 link-local address');
        if (m.v4 === 'dhcp') {
          s += '\n[DHCPv4]\n';
          s += L('RouteMetric=' + m.metric, full && 'default-route priority — lower wins');
        }
        if (m.v6 === 'dhcp') {
          s += '\n[DHCPv6]\n';
          s += L('RouteMetric=' + m.metric, full && 'default-route priority for the IPv6 lease');
        }
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
        files.push({ path: '/etc/systemd/network/10-' + (i.name || 'iface') + '.network', mode: 'ini', content: s });
      });
    } else if (mods.has('ethernets')) {
      var s = head + '\n[Match]\n';
      s += L('Name=enp1s0', full && 'match one NIC by its predictable name');
      if (full) s += L('# MACAddress=00:11:22:33:44:55', 'or bind to the card by MAC instead');
      s += '\n';
      s += nwNetworkBody({
        full: full, v4: v4, v6: v6, staticMode: full,
        addrs: full ? (v4 ? ['192.168.1.10/24'] : []).concat(v6 ? ['2001:db8::10/64'] : []) : [],
        gateways: full ? (v4 ? [{ via: '192.168.1.1', note: 'IPv4 default gateway' }] : [])
          .concat(v6 ? [{ via: '2001:db8::1', note: 'IPv6 default gateway' }] : []) : [],
        dns: full ? (v4 ? ['8.8.8.8', '8.8.4.4'] : []).concat(v6 ? ['2001:4860:4860::8888'] : []) : [],
        search: full && v4, metric: 100
      });
      if (full) {
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
      if (full) {
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
          (full ? '\n[Link]\n' + L('MTUBytes=1450', 'leave room for the 4-byte VLAN tag') : '')
      });
    }

    if (mods.has('bonds')) {
      var bd = '[NetDev]\n';
      bd += L('Name=bond0', full && 'the aggregated device');
      bd += L('Kind=bond', full && 'link aggregation');
      bd += '\n[Bond]\n';
      bd += L('Mode=active-backup', full && 'one active link (or balance-rr, 802.3ad)');
      if (full) bd += L('MIIMonitorSec=100ms', 'link-health poll interval');
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
      if (full) td += L('TTL=64', 'TTL / hop-limit stamped on encapsulated packets');
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

  function nmIpv4(o) {
    var full = o.full;
    var s = '\n[ipv4]\n';
    if (!o.v4) return s + L('method=disabled', full && 'no IPv4 on this profile');
    if (o.staticMode) {
      s += L('method=manual', full && 'static addressing');
      (o.addrs || []).forEach(function (a, n) {
        s += L('address' + (n + 1) + '=' + a, full && 'CIDR address[,gateway] — numbered, 1-based');
      });
      if (o.dns && o.dns.length) s += L('dns=' + o.dns.join(';') + ';', full && 'resolvers, semicolon-separated, trailing ;');
      if (full && o.search) s += L('dns-search=example.local;', 'search domain for unqualified names');
    } else {
      s += L('method=auto', full && 'DHCPv4');
      s += L('route-metric=' + (o.metric || 100), full && 'default-route priority — lower wins');
    }
    return s;
  }

  function nmIpv6(o) {
    var full = o.full;
    var s = '\n[ipv6]\n';
    if (!o.v6) return s + L('method=disabled', full && 'no IPv6 on this profile');
    if (o.staticMode && o.addrs6 && o.addrs6.length) {
      s += L('method=manual', full && 'static IPv6');
      o.addrs6.forEach(function (a, n) {
        s += L('address' + (n + 1) + '=' + a, full && 'CIDR address[,gateway]');
      });
    } else {
      s += L('method=auto', full && 'SLAAC / DHCPv6 as offered');
      s += L('route-metric=' + (o.metric || 100), full && 'default-route priority');
    }
    if (full) s += L('addr-gen-mode=stable-privacy', 'stable but non-MAC-derived interface IDs');
    return s;
  }

  function nmHead(id, type, iface, full) {
    var s = '[connection]\n';
    s += L('id=' + id, full && 'profile name, as shown by nmcli');
    s += L('type=' + type, full && 'connection type');
    if (iface) s += L('interface-name=' + iface, full && 'device this profile binds to');
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
      ifaces.forEach(function (i, idx) {
        var isWifi = i.type === 'wifi';
        var m = ifaceModes(i, v4, v6);
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
        // 'ra' and 'dhcp' both map to method=auto: NM's auto already means
        // "take SLAAC and/or a lease, whichever the link offers".
        s += nmIpv4({
          full: full, v4: m.v4 !== 'off', staticMode: m.v4 === 'static',
          addrs: m.v4 === 'static' ? [m.addr] : [], metric: m.metric
        });
        s += nmIpv6({
          full: full, v6: m.v6 !== 'off', staticMode: m.v6 === 'static',
          addrs6: m.v6 === 'static' ? [m.addr] : [], metric: m.metric
        });
        if (ref) s += '\n' + commentOut(NM_REF);
        files.push({ path: DIR + name + '.nmconnection', mode: 'ini', content: s });
      });
    } else if (mods.has('ethernets')) {
      var s2 = head + '\n' + nmHead('enp1s0', 'ethernet', 'enp1s0', full);
      s2 += nmIpv4({
        full: full, v4: v4, staticMode: full,
        addrs: full && v4 ? ['192.168.1.10/24,192.168.1.1'] : [],
        dns: full && v4 ? ['8.8.8.8', '8.8.4.4'] : [], search: full && v4, metric: 100
      });
      s2 += nmIpv6({
        full: full, v6: v6, staticMode: full,
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
      if (full) w += L('hidden=false', 'set true for a non-broadcast SSID');
      w += '\n[wifi-security]\n';
      w += L('key-mgmt=wpa-psk', full && 'WPA/WPA2 personal');
      w += L('psk=mypassword', full && 'passphrase, clear text — keep the file 0600');
      w += nmIpv4({ full: full, v4: v4, metric: 600 });
      w += nmIpv6({ full: full, v6: v6, metric: 600 });
      w += '\n# Unlike networkd, NM associates AND addresses — no wpa_supplicant\n' +
        '# config of your own, no second daemon to enable.\n';
      files.push({ path: DIR + 'MyWiFi.nmconnection', mode: 'ini', content: w });
    }

    if (mods.has('bridges')) {
      var b = nmHead('br0', 'bridge', 'br0', full);
      if (full) {
        b += '\n[bridge]\n';
        b += L('stp=true', 'run Spanning Tree to prevent loops');
        b += L('forward-delay=4', 'seconds a port waits before forwarding');
      }
      b += nmIpv4({
        full: full, v4: v4, staticMode: full,
        addrs: full && v4 ? ['192.168.1.5/24,192.168.1.1'] : [], dns: full && v4 ? ['1.1.1.1'] : [], metric: 100
      });
      b += nmIpv6({ full: full, v6: v6, metric: 100 });
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
        full: full, v4: v4, staticMode: true,
        addrs: v4 ? ['192.168.100.2/24'] : [], metric: 100
      });
      vl += nmIpv6({
        full: full, v6: v6, staticMode: true,
        addrs6: v6 ? ['2001:db8:100::2/64'] : [], metric: 100
      });
      files.push({ path: DIR + 'vlan100.nmconnection', mode: 'ini', content: vl });
    }

    if (mods.has('bonds')) {
      var bo = nmHead('bond0', 'bond', 'bond0', full);
      bo += '\n[bond]\n';
      bo += L('mode=active-backup', full && 'one active link (or balance-rr, 802.3ad)');
      if (full) bo += L('miimon=100', 'link-health poll interval in ms');
      bo += nmIpv4({ full: full, v4: v4, metric: 100 });
      bo += nmIpv6({ full: full, v6: v6, metric: 100 });
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
      t += nmIpv4({ full: full, v4: v4, staticMode: true, addrs: v4 ? ['10.1.1.1/30'] : [], metric: 100 });
      t += nmIpv6({ full: full, v6: v6, staticMode: true, addrs6: v6 ? ['fd00:1::1/64'] : [], metric: 100 });
      files.push({ path: DIR + 'gre1.nmconnection', mode: 'ini', content: t });
    }

    if (mods.has('veth')) {
      var ve = nmHead('veth-host', 'veth', 'veth-host', full);
      ve += '\n[veth]\n';
      ve += L('peer=veth-peer', full && 'the other end of the pair');
      ve += nmIpv4({ full: full, v4: v4, staticMode: true, addrs: v4 ? ['169.254.1.1/30'] : [], metric: 100 });
      ve += nmIpv6({ full: full, v6: v6, staticMode: true, addrs6: v6 ? ['fd00:2::1/64'] : [], metric: 100 });
      ve += '\n# veth needs NetworkManager 1.30 or newer.\n';
      files.push({ path: DIR + 'veth-host.nmconnection', mode: 'ini', content: ve });
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
    EVAL: EVAL
  };
})(window);
