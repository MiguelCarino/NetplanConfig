// i18n — Netplan Config, fleet convention (reference: Topo js/i18n.js).
// English source strings ARE the keys, so a missing entry falls back to
// English. Locale comes from carino-lang.js (window.CarinoLang.current);
// this script is deferred and placed after it, so CarinoLang exists by
// DOMContentLoaded. Config file content, YAML/INI keys, product names
// (Netplan, networkd, NetworkManager) and the evaluate reference table stay
// English on purpose — they are terms of art / technical reference data.

const I18N = {
    es: {
        'Late shift.': 'Turno nocturno.',
        'Good morning.': 'Buenos días.',
        'Good afternoon.': 'Buenas tardes.',
        'Good evening.': 'Buenas noches.',
        // Header / actions
        '☰ Controls': '☰ Controles',
        'Validate': 'Validar',
        'Copy': 'Copiar',
        'Download': 'Descargar',
        'Download all': 'Descargar todo',
        'Actions': 'Acciones',
        'Show controls': 'Mostrar controles',
        'Close': 'Cerrar',
        // Sidebar chrome
        'Backend': 'Backend',
        '⬌ Side-by-side configs': '⬌ Configs lado a lado',
        '⇄ Compare all three': '⇄ Comparar los tres',
        'Template': 'Plantilla',
        'Address families': 'Familias de direcciones',
        'Modules': 'Módulos',
        'Click a device type to include its example. Ethernet and Wi-Fi are on by default.': 'Haz clic en un tipo de dispositivo para incluir su ejemplo. Ethernet y Wi-Fi vienen activados.',
        'Load an example': 'Cargar un ejemplo',
        'Load example…': 'Cargar ejemplo…',
        'A canonical netplan scenario — replaces your current setup, comparable across all three backends.': 'Un escenario netplan canónico: reemplaza tu configuración actual, comparable en los tres backends.',
        'Interfaces': 'Interfaces',
        'Your real NICs — replace the Ethernet/Wi-Fi examples.': 'Tus NIC reales: reemplazan los ejemplos de Ethernet/Wi-Fi.',
        '+ Add interface': '+ Añadir interfaz',
        '✔ No problems found.': '✔ No se encontraron problemas.',
        // Backend hints
        'One YAML file. A front-end: it generates networkd or NM config, then hands over.': 'Un solo archivo YAML. Un front-end: genera la config de networkd o NM y luego cede el control.',
        'Several INI units in /etc/systemd/network/. Smallest footprint — but no Wi-Fi association.': 'Varias unidades INI en /etc/systemd/network/. La huella más pequeña, pero sin asociación Wi-Fi.',
        'One keyfile per profile. Must be chmod 600 or NM silently ignores it.': 'Un keyfile por perfil. Debe tener chmod 600 o NM lo ignora en silencio.',
        // Template tiers
        'Simple': 'Simple',
        'Simple + Comments': 'Simple + comentarios',
        'IT': 'IT',
        'Full': 'Completo',
        'Minimal working config (DHCP), no comments.': 'Config mínima funcional (DHCP), sin comentarios.',
        'Simple config + every full option as comments — enable later, no revisit.': 'Config simple + todas las opciones como comentarios: actívalas después sin rehacer nada.',
        'Practical config: static IP, gateway, DNS and static routes — the common cases, commented.': 'Config práctica: IP estática, puerta de enlace, DNS y rutas estáticas — los casos comunes, comentados.',
        'Full showcase — every option including MAC match, set-name, MTU and tuning knobs.': 'Muestra completa: todas las opciones, incluidos match por MAC, set-name, MTU y ajustes finos.',
        // Module palette
        'Ethernet': 'Ethernet',
        'Wi-Fi': 'Wi-Fi',
        'Bridge': 'Puente',
        'VLAN': 'VLAN',
        'Bond': 'Bond',
        'Tunnel': 'Túnel',
        'Virtual Eth': 'Eth virtual',
        'Dummy': 'Dummy',
        'VRF': 'VRF',
        // Example scenarios
        'DHCP client (simplest)': 'Cliente DHCP (lo más simple)',
        'Static IP + DNS': 'IP estática + DNS',
        'Static dual-stack (IPv4 + IPv6)': 'Doble pila estática (IPv4 + IPv6)',
        'Directly-connected gateway (on-link)': 'Puerta de enlace directa (on-link)',
        'Extra static routes': 'Rutas estáticas adicionales',
        'Two ports, same range (policy routing)': 'Dos puertos, mismo rango (enrutamiento por políticas)',
        'Wi-Fi client': 'Cliente Wi-Fi',
        'Bridge for VMs / containers': 'Puente para VMs / contenedores',
        'Bonded server (LACP)': 'Servidor con bonding (LACP)',
        'VLAN trunk': 'Troncal VLAN',
        'VRF (isolated routing table)': 'VRF (tabla de rutas aislada)',
        // Interface builder
        'interface name': 'nombre de la interfaz',
        'static address(es), e.g. 192.168.1.10/24': 'dirección(es) estática(s), p. ej. 192.168.1.10/24',
        'gateway (optional), e.g. 192.168.1.1': 'puerta de enlace (opcional), p. ej. 192.168.1.1',
        'DNS (optional), e.g. 1.1.1.1 8.8.8.8': 'DNS (opcional), p. ej. 1.1.1.1 8.8.8.8',
        'search domains (optional), e.g. corp.example': 'dominios de búsqueda (opcional), p. ej. corp.example',
        'Wi-Fi SSID': 'SSID del Wi-Fi',
        'Wi-Fi password': 'contraseña del Wi-Fi',
        '+ static route': '+ ruta estática',
        'to, e.g. 10.0.0.0/8': 'a, p. ej. 10.0.0.0/8',
        'via': 'vía',
        'metric': 'métrica',
        'Remove interface': 'Quitar interfaz',
        'Remove route': 'Quitar ruta',
        'gateway is directly reachable (not on this subnet)': 'la puerta de enlace es alcanzable directamente (fuera de esta subred)',
        // Evaluate overlay chrome
        'Which one should run this machine?': '¿Cuál debería gestionar esta máquina?',
        'Pick by what the box is': 'Elige según lo que sea el equipo',
        'Traps worth knowing': 'Trampas que conviene conocer',
        // Dialogs / errors
        'Load this example?': '¿Cargar este ejemplo?',
        'This replaces your current interfaces and module selection.': 'Esto reemplaza tus interfaces y la selección de módulos actuales.',
        'YAML Error:': 'Error de YAML:',
        'INI Error:': 'Error de INI:',
    },
    'pt-BR': {
        'Late shift.': 'Turno da noite.',
        'Good morning.': 'Bom dia.',
        'Good afternoon.': 'Boa tarde.',
        'Good evening.': 'Boa noite.',
        '☰ Controls': '☰ Controles',
        'Validate': 'Validar',
        'Copy': 'Copiar',
        'Download': 'Baixar',
        'Download all': 'Baixar tudo',
        'Actions': 'Ações',
        'Show controls': 'Mostrar controles',
        'Close': 'Fechar',
        'Backend': 'Backend',
        '⬌ Side-by-side configs': '⬌ Configs lado a lado',
        '⇄ Compare all three': '⇄ Comparar os três',
        'Template': 'Modelo',
        'Address families': 'Famílias de endereços',
        'Modules': 'Módulos',
        'Click a device type to include its example. Ethernet and Wi-Fi are on by default.': 'Clique em um tipo de dispositivo para incluir seu exemplo. Ethernet e Wi-Fi já vêm ativados.',
        'Load an example': 'Carregar um exemplo',
        'Load example…': 'Carregar exemplo…',
        'A canonical netplan scenario — replaces your current setup, comparable across all three backends.': 'Um cenário netplan canônico — substitui sua configuração atual, comparável nos três backends.',
        'Interfaces': 'Interfaces',
        'Your real NICs — replace the Ethernet/Wi-Fi examples.': 'Suas NICs reais — substituem os exemplos de Ethernet/Wi-Fi.',
        '+ Add interface': '+ Adicionar interface',
        '✔ No problems found.': '✔ Nenhum problema encontrado.',
        'One YAML file. A front-end: it generates networkd or NM config, then hands over.': 'Um único arquivo YAML. Um front-end: gera a config do networkd ou do NM e passa o bastão.',
        'Several INI units in /etc/systemd/network/. Smallest footprint — but no Wi-Fi association.': 'Várias unidades INI em /etc/systemd/network/. A menor pegada — mas sem associação Wi-Fi.',
        'One keyfile per profile. Must be chmod 600 or NM silently ignores it.': 'Um keyfile por perfil. Precisa de chmod 600, ou o NM o ignora em silêncio.',
        'Simple': 'Simples',
        'Simple + Comments': 'Simples + comentários',
        'IT': 'TI',
        'Full': 'Completo',
        'Minimal working config (DHCP), no comments.': 'Config mínima funcional (DHCP), sem comentários.',
        'Simple config + every full option as comments — enable later, no revisit.': 'Config simples + todas as opções como comentários — ative depois, sem retrabalho.',
        'Practical config: static IP, gateway, DNS and static routes — the common cases, commented.': 'Config prática: IP estático, gateway, DNS e rotas estáticas — os casos comuns, comentados.',
        'Full showcase — every option including MAC match, set-name, MTU and tuning knobs.': 'Vitrine completa — todas as opções, incluindo match por MAC, set-name, MTU e ajustes finos.',
        'Ethernet': 'Ethernet',
        'Wi-Fi': 'Wi-Fi',
        'Bridge': 'Ponte',
        'VLAN': 'VLAN',
        'Bond': 'Bond',
        'Tunnel': 'Túnel',
        'Virtual Eth': 'Eth virtual',
        'Dummy': 'Dummy',
        'VRF': 'VRF',
        'DHCP client (simplest)': 'Cliente DHCP (o mais simples)',
        'Static IP + DNS': 'IP estático + DNS',
        'Static dual-stack (IPv4 + IPv6)': 'Pilha dupla estática (IPv4 + IPv6)',
        'Directly-connected gateway (on-link)': 'Gateway conectado diretamente (on-link)',
        'Extra static routes': 'Rotas estáticas extras',
        'Two ports, same range (policy routing)': 'Duas portas, mesma faixa (roteamento por política)',
        'Wi-Fi client': 'Cliente Wi-Fi',
        'Bridge for VMs / containers': 'Ponte para VMs / contêineres',
        'Bonded server (LACP)': 'Servidor com bonding (LACP)',
        'VLAN trunk': 'Tronco VLAN',
        'VRF (isolated routing table)': 'VRF (tabela de rotas isolada)',
        'interface name': 'nome da interface',
        'static address(es), e.g. 192.168.1.10/24': 'endereço(s) estático(s), ex.: 192.168.1.10/24',
        'gateway (optional), e.g. 192.168.1.1': 'gateway (opcional), ex.: 192.168.1.1',
        'DNS (optional), e.g. 1.1.1.1 8.8.8.8': 'DNS (opcional), ex.: 1.1.1.1 8.8.8.8',
        'search domains (optional), e.g. corp.example': 'domínios de busca (opcional), ex.: corp.example',
        'Wi-Fi SSID': 'SSID do Wi-Fi',
        'Wi-Fi password': 'senha do Wi-Fi',
        '+ static route': '+ rota estática',
        'to, e.g. 10.0.0.0/8': 'para, ex.: 10.0.0.0/8',
        'via': 'via',
        'metric': 'métrica',
        'Remove interface': 'Remover interface',
        'Remove route': 'Remover rota',
        'gateway is directly reachable (not on this subnet)': 'o gateway é alcançável diretamente (fora desta sub-rede)',
        'Which one should run this machine?': 'Qual deles deve gerenciar esta máquina?',
        'Pick by what the box is': 'Escolha pelo papel da máquina',
        'Traps worth knowing': 'Armadilhas que vale conhecer',
        'Load this example?': 'Carregar este exemplo?',
        'This replaces your current interfaces and module selection.': 'Isso substitui suas interfaces e a seleção de módulos atuais.',
        'YAML Error:': 'Erro de YAML:',
        'INI Error:': 'Erro de INI:',
    },
    ja: {
        'Late shift.': '夜勤お疲れさま。',
        'Good morning.': 'おはようございます。',
        'Good afternoon.': 'こんにちは。',
        'Good evening.': 'こんばんは。',
        '☰ Controls': '☰ 操作',
        'Validate': '検証',
        'Copy': 'コピー',
        'Download': 'ダウンロード',
        'Download all': 'すべてダウンロード',
        'Actions': '操作',
        'Show controls': '操作パネルを表示',
        'Close': '閉じる',
        'Backend': 'バックエンド',
        '⬌ Side-by-side configs': '⬌ 設定を並べて表示',
        '⇄ Compare all three': '⇄ 3つを比較',
        'Template': 'テンプレート',
        'Address families': 'アドレスファミリー',
        'Modules': 'モジュール',
        'Click a device type to include its example. Ethernet and Wi-Fi are on by default.': 'デバイスタイプをクリックすると例が追加されます。イーサネットとWi-Fiは最初から有効です。',
        'Load an example': '例を読み込む',
        'Load example…': '例を読み込む…',
        'A canonical netplan scenario — replaces your current setup, comparable across all three backends.': '定番のnetplanシナリオ — 現在の設定を置き換え、3つのバックエンドで比較できます。',
        'Interfaces': 'インターフェース',
        'Your real NICs — replace the Ethernet/Wi-Fi examples.': '実際のNIC — イーサネット/Wi-Fiの例を置き換えます。',
        '+ Add interface': '+ インターフェースを追加',
        '✔ No problems found.': '✔ 問題は見つかりませんでした。',
        'One YAML file. A front-end: it generates networkd or NM config, then hands over.': 'YAMLファイル1つ。フロントエンド: networkdまたはNMの設定を生成して引き渡します。',
        'Several INI units in /etc/systemd/network/. Smallest footprint — but no Wi-Fi association.': '/etc/systemd/network/ に複数のINIユニット。最小フットプリント — ただしWi-Fi接続は不可。',
        'One keyfile per profile. Must be chmod 600 or NM silently ignores it.': 'プロファイルごとにkeyfile 1つ。chmod 600でないとNMは黙って無視します。',
        'Simple': 'シンプル',
        'Simple + Comments': 'シンプル + コメント',
        'IT': 'IT',
        'Full': 'フル',
        'Minimal working config (DHCP), no comments.': '動く最小構成 (DHCP)、コメントなし。',
        'Simple config + every full option as comments — enable later, no revisit.': 'シンプル構成 + 全オプションをコメントで併記 — 後から有効化でき、やり直し不要。',
        'Practical config: static IP, gateway, DNS and static routes — the common cases, commented.': '実用構成: 静的IP、ゲートウェイ、DNS、静的ルート — よくあるケースをコメント付きで。',
        'Full showcase — every option including MAC match, set-name, MTU and tuning knobs.': '全部入り — MACマッチ、set-name、MTU、チューニング項目まで全オプション。',
        'Ethernet': 'イーサネット',
        'Wi-Fi': 'Wi-Fi',
        'Bridge': 'ブリッジ',
        'VLAN': 'VLAN',
        'Bond': 'ボンド',
        'Tunnel': 'トンネル',
        'Virtual Eth': '仮想Eth',
        'Dummy': 'ダミー',
        'VRF': 'VRF',
        'DHCP client (simplest)': 'DHCPクライアント (最もシンプル)',
        'Static IP + DNS': '静的IP + DNS',
        'Static dual-stack (IPv4 + IPv6)': '静的デュアルスタック (IPv4 + IPv6)',
        'Directly-connected gateway (on-link)': '直結ゲートウェイ (on-link)',
        'Extra static routes': '追加の静的ルート',
        'Two ports, same range (policy routing)': '2ポート同一レンジ (ポリシールーティング)',
        'Wi-Fi client': 'Wi-Fiクライアント',
        'Bridge for VMs / containers': 'VM・コンテナ用ブリッジ',
        'Bonded server (LACP)': 'ボンディングサーバー (LACP)',
        'VLAN trunk': 'VLANトランク',
        'VRF (isolated routing table)': 'VRF (分離ルーティングテーブル)',
        'interface name': 'インターフェース名',
        'static address(es), e.g. 192.168.1.10/24': '静的アドレス (例: 192.168.1.10/24)',
        'gateway (optional), e.g. 192.168.1.1': 'ゲートウェイ (任意、例: 192.168.1.1)',
        'DNS (optional), e.g. 1.1.1.1 8.8.8.8': 'DNS (任意、例: 1.1.1.1 8.8.8.8)',
        'search domains (optional), e.g. corp.example': '検索ドメイン (任意、例: corp.example)',
        'Wi-Fi SSID': 'Wi-Fi SSID',
        'Wi-Fi password': 'Wi-Fiパスワード',
        '+ static route': '+ 静的ルート',
        'to, e.g. 10.0.0.0/8': '宛先 (例: 10.0.0.0/8)',
        'via': '経由',
        'metric': 'メトリック',
        'Remove interface': 'インターフェースを削除',
        'Remove route': 'ルートを削除',
        'gateway is directly reachable (not on this subnet)': 'ゲートウェイに直接到達できます (このサブネット外)',
        'Which one should run this machine?': 'このマシンはどれで管理すべき？',
        'Pick by what the box is': 'マシンの役割で選ぶ',
        'Traps worth knowing': '知っておきたい落とし穴',
        'Load this example?': 'この例を読み込みますか？',
        'This replaces your current interfaces and module selection.': '現在のインターフェースとモジュール選択が置き換えられます。',
        'YAML Error:': 'YAMLエラー:',
        'INI Error:': 'INIエラー:',
    },
    ru: {
        'Late shift.': 'Ночная смена.',
        'Good morning.': 'Доброе утро.',
        'Good afternoon.': 'Добрый день.',
        'Good evening.': 'Добрый вечер.',
        '☰ Controls': '☰ Панель',
        'Validate': 'Проверить',
        'Copy': 'Копировать',
        'Download': 'Скачать',
        'Download all': 'Скачать всё',
        'Actions': 'Действия',
        'Show controls': 'Показать панель',
        'Close': 'Закрыть',
        'Backend': 'Бэкенд',
        '⬌ Side-by-side configs': '⬌ Конфиги рядом',
        '⇄ Compare all three': '⇄ Сравнить все три',
        'Template': 'Шаблон',
        'Address families': 'Семейства адресов',
        'Modules': 'Модули',
        'Click a device type to include its example. Ethernet and Wi-Fi are on by default.': 'Нажмите на тип устройства, чтобы добавить его пример. Ethernet и Wi-Fi включены по умолчанию.',
        'Load an example': 'Загрузить пример',
        'Load example…': 'Загрузить пример…',
        'A canonical netplan scenario — replaces your current setup, comparable across all three backends.': 'Канонический сценарий netplan — заменяет текущую настройку, сравним во всех трёх бэкендах.',
        'Interfaces': 'Интерфейсы',
        'Your real NICs — replace the Ethernet/Wi-Fi examples.': 'Ваши реальные сетевые карты — заменяют примеры Ethernet/Wi-Fi.',
        '+ Add interface': '+ Добавить интерфейс',
        '✔ No problems found.': '✔ Проблем не найдено.',
        'One YAML file. A front-end: it generates networkd or NM config, then hands over.': 'Один YAML-файл. Фронтенд: генерирует конфиг networkd или NM и передаёт управление.',
        'Several INI units in /etc/systemd/network/. Smallest footprint — but no Wi-Fi association.': 'Несколько INI-юнитов в /etc/systemd/network/. Минимальный след — но без подключения к Wi-Fi.',
        'One keyfile per profile. Must be chmod 600 or NM silently ignores it.': 'Один keyfile на профиль. Нужен chmod 600, иначе NM молча его игнорирует.',
        'Simple': 'Простой',
        'Simple + Comments': 'Простой + комментарии',
        'IT': 'IT',
        'Full': 'Полный',
        'Minimal working config (DHCP), no comments.': 'Минимальный рабочий конфиг (DHCP), без комментариев.',
        'Simple config + every full option as comments — enable later, no revisit.': 'Простой конфиг + все опции в виде комментариев — включайте позже без переделки.',
        'Practical config: static IP, gateway, DNS and static routes — the common cases, commented.': 'Практичный конфиг: статический IP, шлюз, DNS и статические маршруты — типичные случаи, с комментариями.',
        'Full showcase — every option including MAC match, set-name, MTU and tuning knobs.': 'Полная витрина — все опции, включая match по MAC, set-name, MTU и тонкие настройки.',
        'Ethernet': 'Ethernet',
        'Wi-Fi': 'Wi-Fi',
        'Bridge': 'Мост',
        'VLAN': 'VLAN',
        'Bond': 'Бонд',
        'Tunnel': 'Туннель',
        'Virtual Eth': 'Вирт. Eth',
        'Dummy': 'Dummy',
        'VRF': 'VRF',
        'DHCP client (simplest)': 'DHCP-клиент (проще всего)',
        'Static IP + DNS': 'Статический IP + DNS',
        'Static dual-stack (IPv4 + IPv6)': 'Статический дуал-стек (IPv4 + IPv6)',
        'Directly-connected gateway (on-link)': 'Шлюз с прямым подключением (on-link)',
        'Extra static routes': 'Дополнительные статические маршруты',
        'Two ports, same range (policy routing)': 'Два порта, одна подсеть (policy routing)',
        'Wi-Fi client': 'Wi-Fi-клиент',
        'Bridge for VMs / containers': 'Мост для ВМ / контейнеров',
        'Bonded server (LACP)': 'Сервер с бондингом (LACP)',
        'VLAN trunk': 'VLAN-транк',
        'VRF (isolated routing table)': 'VRF (изолированная таблица маршрутов)',
        'interface name': 'имя интерфейса',
        'static address(es), e.g. 192.168.1.10/24': 'статический адрес(а), напр. 192.168.1.10/24',
        'gateway (optional), e.g. 192.168.1.1': 'шлюз (необязательно), напр. 192.168.1.1',
        'DNS (optional), e.g. 1.1.1.1 8.8.8.8': 'DNS (необязательно), напр. 1.1.1.1 8.8.8.8',
        'search domains (optional), e.g. corp.example': 'домены поиска (необязательно), напр. corp.example',
        'Wi-Fi SSID': 'SSID сети Wi-Fi',
        'Wi-Fi password': 'пароль Wi-Fi',
        '+ static route': '+ статический маршрут',
        'to, e.g. 10.0.0.0/8': 'куда, напр. 10.0.0.0/8',
        'via': 'через',
        'metric': 'метрика',
        'Remove interface': 'Удалить интерфейс',
        'Remove route': 'Удалить маршрут',
        'gateway is directly reachable (not on this subnet)': 'шлюз доступен напрямую (вне этой подсети)',
        'Which one should run this machine?': 'Что должно управлять этой машиной?',
        'Pick by what the box is': 'Выбор по назначению машины',
        'Traps worth knowing': 'Подводные камни',
        'Load this example?': 'Загрузить этот пример?',
        'This replaces your current interfaces and module selection.': 'Это заменит текущие интерфейсы и выбор модулей.',
        'YAML Error:': 'Ошибка YAML:',
        'INI Error:': 'Ошибка INI:',
    },
};

let LOCALE = 'en';

// BCP-47-ish tag -> supported locale, or null when unsupported.
function resolveLocale(tag) {
    if (!tag) return null;
    const l = String(tag).toLowerCase();
    if (l.startsWith('es')) return 'es';
    if (l.startsWith('pt')) return 'pt-BR';
    if (l.startsWith('ja')) return 'ja';
    if (l.startsWith('ru')) return 'ru';
    if (l.startsWith('en')) return 'en';
    return null;
}

function setLocale(l) {
    LOCALE = (l === 'en' || I18N[l]) ? l : 'en';
    document.documentElement.lang = LOCALE;
}

function t(key) {
    const dict = I18N[LOCALE];
    return (dict && dict[key]) || key;
}

// Static markup: elements carrying data-i18n use their original English text
// as the key (captured on first pass so locale switches stay reversible).
function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        if (!el.dataset.i18nKey) el.dataset.i18nKey = el.textContent.trim();
        el.textContent = t(el.dataset.i18nKey);
    });
}

// ---- attribute + JS-generated surfaces ------------------------------------
// Same capture-once idea, applied to text/title/placeholder of elements the
// app builds in JS (template tiers, module palette, example options, the
// custom-interface cards) and to a few prominent title attributes.

function _tText(el) {
    if (!el.dataset.i18nKey) el.dataset.i18nKey = el.textContent.trim();
    el.textContent = t(el.dataset.i18nKey);
}
function _tTitle(el) {
    if (!el.dataset.i18nTitle) el.dataset.i18nTitle = el.getAttribute('title') || '';
    if (el.dataset.i18nTitle) el.setAttribute('title', t(el.dataset.i18nTitle));
}
function _tPlaceholder(el) {
    if (!el.dataset.i18nPh) el.dataset.i18nPh = el.getAttribute('placeholder') || '';
    if (el.dataset.i18nPh) el.setAttribute('placeholder', t(el.dataset.i18nPh));
}

// Prominent title/aria attributes translated explicitly (not via data-i18n).
const I18N_ATTR_TARGETS = [
    ['#exampleSel', 'title'],
    ['.eval-close', 'title'],
    ['.cs-menu', 'title'],
    ['.cs-menu', 'aria-label'],
    ['#navActions .cs-btn', 'title'],
];

function applyAttrI18n() {
    I18N_ATTR_TARGETS.forEach(([sel, attr]) => {
        document.querySelectorAll(sel).forEach((el) => {
            const dk = 'i18nAttr' + attr.replace(/[^a-z0-9]/gi, '');
            if (!el.dataset[dk]) el.dataset[dk] = el.getAttribute(attr) || '';
            if (el.dataset[dk]) el.setAttribute(attr, t(el.dataset[dk]));
        });
    });
}

function applyDynamicI18n() {
    // State-driven hints (globals from the inline app script).
    if (typeof BACKENDS !== 'undefined' && typeof currentBackend !== 'undefined') {
        const el = document.getElementById('backendHint');
        const be = BACKENDS[currentBackend];
        if (el && be) el.textContent = t(be.hint);
    }
    if (typeof TEMPLATES !== 'undefined' && typeof currentTemplate !== 'undefined') {
        const el = document.getElementById('tplHint');
        const tp = TEMPLATES[currentTemplate];
        if (el && tp) el.textContent = t(tp.hint);
    }
    // Template tier buttons (label + hover hint).
    document.querySelectorAll('.template-button[data-tpl]').forEach((b) => { _tText(b); _tTitle(b); });
    // Module palette labels.
    document.querySelectorAll('.module-node').forEach((b) => {
        const lbl = b.querySelector('.mn-label');
        if (lbl) _tText(lbl);
        _tTitle(b);
    });
    // Example scenario options (values stay untouched — they are the keys).
    document.querySelectorAll('#exampleSel option').forEach(_tText);
    // Custom interface cards: re-created on every render, so capture is fresh.
    const list = document.getElementById('ifaceList');
    if (list) {
        list.querySelectorAll('input[placeholder]').forEach(_tPlaceholder);
        list.querySelectorAll('[title]').forEach(_tTitle);
        list.querySelectorAll('.if-addroute').forEach(_tText);
    }
    applyAttrI18n();
}

// ---- wiring ---------------------------------------------------------------
function currentFleetLang() { return (window.CarinoLang && window.CarinoLang.current) || 'en'; }

function applyI18nAll() {
    setLocale(resolveLocale(currentFleetLang()) || 'en');
    applyStaticI18n();
    applyDynamicI18n();
}

// Re-translate the JS-rendered surfaces after the app functions that rebuild
// or re-caption them run. Pure wraps — the originals are untouched.
function wrapForI18n() {
    ['setBackend', 'setTemplate', 'renderIfaces'].forEach((name) => {
        const orig = window[name];
        if (typeof orig !== 'function' || orig._i18nWrapped) return;
        const wrapped = function (...args) {
            const r = orig.apply(this, args);
            applyDynamicI18n();
            return r;
        };
        wrapped._i18nWrapped = true;
        window[name] = wrapped;
    });
}

// carino-lang.js is deferred and runs before this (also deferred, placed
// after it), so CarinoLang exists by DOMContentLoaded.
document.addEventListener('DOMContentLoaded', () => { wrapForI18n(); applyI18nAll(); });
window.addEventListener('carino:langchange', applyI18nAll);
