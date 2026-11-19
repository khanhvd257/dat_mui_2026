/* Bản đồ Đất Mũi – Leaflet + Esri World Imagery / OpenTopoMap
   Dữ liệu đường & sông: © OpenStreetMap contributors (js/geodata.js)

   LƯU Ý DỮ LIỆU:
   - Marker đỏ đặc  = vị trí địa lý Mũi Cà Mau (có tọa độ thực).
   - Marker viền đứt = các vị trí cột sóng MINH HỌA (7 điểm), KHÔNG phải tọa độ trạm Viettel thực tế.
   Khi có tọa độ trạm xác thực, thêm vào mảng STATIONS bên dưới. */
(function () {
  'use strict';

  var CAPE = { lat: 8.6058, lng: 104.7228 };
  // Các vị trí cột sóng MINH HỌA (không phải tọa độ trạm thực tế): 1 điểm gần mũi + 6 điểm rải quanh Đất Mũi,
  // đặt trên đường/đất liền có thật theo dữ liệu OpenStreetMap, cách nhau ≥ 1,4 km để bố cục thoáng.
  var DEMOS = [
    { lat: 8.60790, lng: 104.71890 },
    { lat: 8.61575, lng: 104.73114 },
    { lat: 8.60873, lng: 104.74207 },
    { lat: 8.62789, lng: 104.72352 },
    { lat: 8.62023, lng: 104.74822 },
    { lat: 8.63314, lng: 104.74418 },
    { lat: 8.60334, lng: 104.76093 }
  ];
  var STATIONS = [];                                    // [{ name, lat, lng }] – chỉ thêm khi có dữ liệu xác thực

  function init() {
    var el = document.getElementById('dat-mui-map');
    if (!el || typeof L === 'undefined') return;

    var map = L.map(el, {
      center: [8.6075, 104.7215], zoom: 12, minZoom: 9, maxZoom: 18,
      zoomControl: false, scrollWheelZoom: false, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 120,
      maxBounds: [[8.1, 104.2], [9.1, 105.3]], maxBoundsViscosity: 0.85, attributionControl: true
    });
    map.attributionControl.setPrefix(false);

    var layers = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 18, maxZoom: 18, attribution: 'Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics'
      }),
      terrain: L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 17, maxZoom: 18, attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)'
      })
    };
    var current = 'satellite';
    layers.satellite.addTo(map);

    /* ----- đường & sông (OSM) ----- */
    var styles = {
      satellite: {
        main:  { color: '#ffffff', weight: 2.6, opacity: .95 },
        minor: { color: '#ffffff', weight: 1.2, opacity: .55 },
        water: { color: '#6fc3ff', weight: 1.6, opacity: .9 }
      },
      terrain: {
        main:  { color: '#EE0033', weight: 2.6, opacity: .95 },
        minor: { color: '#44494D', weight: 1.2, opacity: .6 },
        water: { color: '#1f78c8', weight: 1.6, opacity: .9 }
      }
    };
    var geo = L.geoJSON(window.DAT_MUI_GEO || { type: 'FeatureCollection', features: [] }, {
      style: function (f) { return Object.assign({ lineCap: 'round', lineJoin: 'round' }, styles[current][f.properties.c]); },
      onEachFeature: function (f, layer) {
        if (f.properties.n) layer.bindTooltip(f.properties.n, { sticky: true, direction: 'top', opacity: .95 });
      }
    }).addTo(map);

    /* ----- marker ----- */
    function pinIcon(extra) {
      return L.divIcon({ className: '', html: '<div class="pin ' + (extra || '') + '"></div>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14] });
    }
    var capeMarker = L.marker([CAPE.lat, CAPE.lng], { icon: pinIcon(), title: 'Mũi Cà Mau', alt: 'Mũi Cà Mau', riseOnHover: true }).addTo(map);
    capeMarker.bindPopup(
      '<b>Mũi Cà Mau – Đất Mũi</b>Điểm cực Nam trên đất liền của Tổ quốc, nơi rừng ngập mặn gặp biển.' +
      '<em>Vị trí địa lý thực tế.</em>', { maxWidth: 260 });

    DEMOS.forEach(function (d, i) {
      L.marker([d.lat, d.lng], { icon: pinIcon('pin--demo'), title: 'Vị trí cột sóng minh họa ' + (i + 1), alt: 'Vị trí cột sóng minh họa ' + (i + 1), riseOnHover: true })
        .addTo(map)
        .bindPopup('<b>Cột sóng – vị trí minh họa ' + (i + 1) + '/' + DEMOS.length + '</b>Biểu tượng cho hạ tầng viễn thông Viettel quanh khu vực Đất Mũi.' +
                   '<em>Không phải tọa độ trạm thực tế.</em>', { maxWidth: 260 });
    });

    STATIONS.forEach(function (s) {
      L.marker([s.lat, s.lng], { icon: pinIcon(), title: s.name }).addTo(map).bindPopup('<b>' + s.name + '</b>');
    });

    /* ----- điều khiển ----- */
    var segBtns = document.querySelectorAll('.map-controls [data-layer]');
    var roadsBtn = document.getElementById('toggle-roads');
    var roadsOn = true;

    function setLayer(name) {
      if (name === current) return;
      map.removeLayer(layers[current]);
      layers[name].addTo(map).bringToBack();
      current = name;
      segBtns.forEach(function (b) {
        var on = b.dataset.layer === name;
        b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on);
      });
      geo.setStyle(function (f) { return styles[current][f.properties.c]; });
      // đủ tầng độ phóng khi chuyển sang địa hình (zoom tối đa 17 bản gốc)
      if (name === 'terrain' && map.getZoom() > 17) map.setZoom(17);
    }
    segBtns.forEach(function (b) { b.addEventListener('click', function () { setLayer(b.dataset.layer); }); });

    roadsBtn.addEventListener('click', function () {
      roadsOn = !roadsOn;
      roadsBtn.classList.toggle('is-active', roadsOn); roadsBtn.setAttribute('aria-pressed', roadsOn);
      if (roadsOn) geo.addTo(map); else map.removeLayer(geo);
    });

    document.getElementById('zoom-in').addEventListener('click', function () { map.zoomIn(1); });
    document.getElementById('zoom-out').addEventListener('click', function () { map.zoomOut(1); });

    // Cuộn chuột chỉ phóng to khi người dùng chủ động nhấn vào bản đồ (tránh chặn cuộn trang)
    map.on('click', function () { map.scrollWheelZoom.enable(); });
    el.addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });

    // Chuyển động vào khu vực Đất Mũi khi bản đồ xuất hiện
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var all = [[CAPE.lat, CAPE.lng]].concat(DEMOS.map(function (d) { return [d.lat, d.lng]; }));
    var bounds = L.latLngBounds(all);
    var pad = L.point(el.clientWidth < 640 ? 36 : 90, 70);
    if (reduce) map.fitBounds(bounds, { paddingTopLeft: pad, paddingBottomRight: pad, maxZoom: 14.5 });
    else map.flyToBounds(bounds, { paddingTopLeft: pad, paddingBottomRight: pad, maxZoom: 14.5, duration: 3.2, easeLinearity: .25 });

    window.datMuiMap = map;
  }

  // Khởi tạo khi section gần vào khung nhìn để tiết kiệm băng thông
  var target = document.getElementById('map');
  if (!target) return;
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); init(); }
    }, { rootMargin: '0px 0px -25% 0px' });
    io.observe(document.getElementById('dat-mui-map'));
  } else init();
})();
