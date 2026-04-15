#include "wifi_prov.h"
#include "config.h"
#include "oled.h"
#include "led.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_server.h"
#include "esp_mac.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "WIFI";

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1
#define NVS_NAMESPACE      "wifi_cfg"

static EventGroupHandle_t     wifi_events;
static wifi_connected_cb_t    on_connected_cb    = NULL;
static wifi_disconnected_cb_t on_disconnected_cb = NULL;
static char device_ip[20]    = {0};
static char ap_ssid[32]      = {0};
static char ap_password[16]  = {0};  // unique 8-char password from MAC
static char saved_ssid[64]   = {0};  // home WiFi SSID
static char saved_pass[64]   = {0};  // home WiFi password
static httpd_handle_t prov_server = NULL;

// ── Generate unique AP credentials from MAC ──────────────────────────
static void generate_ap_credentials(void) {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    // SSID: IndiChat-AABB
    snprintf(ap_ssid, sizeof(ap_ssid), "IndiChat-%02X%02X", mac[4], mac[5]);
    // Password: 8 digits from MAC (unique per device)
    snprintf(ap_password, sizeof(ap_password), "%02X%02X%02X%02X", mac[2], mac[3], mac[4], mac[5]);
    ESP_LOGI(TAG, "AP SSID: %s  Password: %s", ap_ssid, ap_password);
}

// ── NVS helpers ──────────────────────────────────────────────────────
static void nvs_save_wifi(const char *ssid, const char *pass) {
    nvs_handle_t h;
    nvs_open(NVS_NAMESPACE, NVS_READWRITE, &h);
    nvs_set_str(h, "ssid", ssid);
    nvs_set_str(h, "pass", pass);
    nvs_commit(h);
    nvs_close(h);
    // Cache locally
    strncpy(saved_ssid, ssid, sizeof(saved_ssid)-1);
    strncpy(saved_pass, pass, sizeof(saved_pass)-1);
}

static bool nvs_load_wifi(char *ssid, char *pass) {
    nvs_handle_t h;
    if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &h) != ESP_OK) return false;
    size_t len = 64;
    bool ok = (nvs_get_str(h, "ssid", ssid, &len) == ESP_OK);
    len = 64;
    ok &= (nvs_get_str(h, "pass", pass, &len) == ESP_OK);
    nvs_close(h);
    if (ok) {
        strncpy(saved_ssid, ssid, sizeof(saved_ssid)-1);
        strncpy(saved_pass, pass, sizeof(saved_pass)-1);
    }
    return ok && strlen(ssid) > 0;
}

// ── WiFi scan → HTML options ─────────────────────────────────────────
static void build_wifi_options(char *buf, size_t buf_len) {
    wifi_scan_config_t scan_cfg = {0};
    esp_wifi_scan_start(&scan_cfg, true);

    uint16_t count = 20;
    wifi_ap_record_t records[20];
    esp_wifi_scan_get_ap_records(&count, records);

    int pos = 0;
    for (int i = 0; i < count && pos < (int)buf_len - 150; i++) {
        if (strlen((char*)records[i].ssid) == 0) continue;
        int rssi = records[i].rssi;
        int bars = rssi > -50 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
        const char *bars_str = bars == 4 ? "████" : bars == 3 ? "███░" : bars == 2 ? "██░░" : "█░░░";
        const char *lock = (records[i].authmode != WIFI_AUTH_OPEN) ? " 🔒" : "";
        pos += snprintf(buf + pos, buf_len - pos,
            "<div class='wifi-item' onclick='selectWifi(\"%s\")'>",
            (char*)records[i].ssid);
        pos += snprintf(buf + pos, buf_len - pos,
            "<span class='wifi-name'>%s%s</span>"
            "<span class='wifi-bars'>%s</span></div>",
            (char*)records[i].ssid, lock, bars_str);
    }
    if (pos == 0) {
        snprintf(buf, buf_len, "<div class='wifi-item' style='color:#666'>No networks found. <a href='/' style='color:#4f8ef7'>Refresh</a></div>");
    }
}

// ── WiFi event handler ───────────────────────────────────────────────
static void wifi_event_handler(void *arg, esp_event_base_t base,
                                int32_t id, void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "WiFi disconnected");
        xEventGroupSetBits(wifi_events, WIFI_FAIL_BIT);
        if (on_disconnected_cb) on_disconnected_cb();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *ev = (ip_event_got_ip_t *)data;
        snprintf(device_ip, sizeof(device_ip), IPSTR, IP2STR(&ev->ip_info.ip));
        ESP_LOGI(TAG, "Got IP: %s", device_ip);
        xEventGroupSetBits(wifi_events, WIFI_CONNECTED_BIT);
        if (on_connected_cb) on_connected_cb(device_ip);
    }
}

// ── GET / - Show WiFi list ────────────────────────────────────────────
static esp_err_t prov_get_handler(httpd_req_t *req) {
    char *wifi_list = malloc(3000);
    if (!wifi_list) return ESP_ERR_NO_MEM;
    build_wifi_options(wifi_list, 3000);

    char *html = malloc(6000);
    if (!html) { free(wifi_list); return ESP_ERR_NO_MEM; }

    snprintf(html, 6000,
        "<!DOCTYPE html><html><head>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<meta charset='UTF-8'><title>IndiChat WiFi Setup</title>"
        "<style>"
        "*{box-sizing:border-box;margin:0;padding:0}"
        "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
        "background:#0d0d0d;color:#e8e8e8;min-height:100vh;display:flex;"
        "align-items:center;justify-content:center;padding:16px}"
        ".card{background:#141414;border:1px solid #2a2a2a;border-radius:16px;"
        "padding:24px;width:100%%;max-width:400px}"
        ".logo{text-align:center;margin-bottom:20px}"
        ".logo-icon{width:48px;height:48px;background:linear-gradient(135deg,#4f8ef7,#7c6af7);"
        "border-radius:12px;display:inline-flex;align-items:center;justify-content:center;"
        "font-size:24px;margin-bottom:8px}"
        ".logo h1{font-size:20px;font-weight:800;background:linear-gradient(135deg,#4f8ef7,#7c6af7);"
        "-webkit-background-clip:text;-webkit-text-fill-color:transparent}"
        ".logo p{color:#555;font-size:11px;margin-top:2px}"
        "h3{font-size:13px;color:#888;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}"
        ".wifi-list{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;"
        "max-height:220px;overflow-y:auto;margin-bottom:16px}"
        ".wifi-item{display:flex;justify-content:space-between;align-items:center;"
        "padding:12px 14px;cursor:pointer;border-bottom:1px solid #222;transition:background .15s}"
        ".wifi-item:last-child{border-bottom:none}"
        ".wifi-item:hover,.wifi-item.selected{background:#4f8ef722}"
        ".wifi-item.selected{border-left:3px solid #4f8ef7}"
        ".wifi-name{font-size:14px;font-weight:500}"
        ".wifi-bars{font-size:11px;color:#4f8ef7;letter-spacing:-1px}"
        "label{display:block;font-size:11px;color:#666;margin-bottom:6px;"
        "text-transform:uppercase;letter-spacing:.5px;font-weight:600}"
        "input{width:100%%;padding:11px 14px;background:#1a1a1a;border:1px solid #2a2a2a;"
        "border-radius:8px;color:#e8e8e8;font-size:14px;outline:none;margin-bottom:14px}"
        "input:focus{border-color:#4f8ef7}"
        ".btn{width:100%%;padding:13px;background:linear-gradient(135deg,#4f8ef7,#7c6af7);"
        "color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;"
        "cursor:pointer;transition:opacity .2s}"
        ".btn:disabled{opacity:.4;cursor:not-allowed}"
        ".selected-ssid{font-size:13px;color:#4f8ef7;margin-bottom:10px;min-height:18px}"
        ".hint{font-size:11px;color:#444;text-align:center;margin-top:12px}"
        "::-webkit-scrollbar{width:4px}"
        "::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px}"
        "</style></head><body>"
        "<div class='card'>"
        "<div class='logo'>"
        "<div class='logo-icon'>🤖</div>"
        "<h1>IndiChat</h1>"
        "<p>powered by IndiTech Corporation</p>"
        "</div>"
        "<h3>Select WiFi Network</h3>"
        "<div class='wifi-list' id='wlist'>%s</div>"
        "<div class='selected-ssid' id='sel'>Tap a network to select</div>"
        "<form action='/save' method='POST' id='form'>"
        "<input type='hidden' name='ssid' id='ssid_input'>"
        "<label>WiFi Password</label>"
        "<input type='password' name='pass' id='pass_input' placeholder='Enter password' autocomplete='off'>"
        "<button class='btn' type='submit' id='btn' disabled>Connect &#x2192;</button>"
        "</form>"
        "<p class='hint'>Device will restart after connecting</p>"
        "</div>"
        "<script>"
        "var sel='';"
        "function selectWifi(s){"
        "sel=s;"
        "document.getElementById('ssid_input').value=s;"
        "document.getElementById('sel').textContent='Selected: '+s;"
        "document.getElementById('btn').disabled=false;"
        "document.querySelectorAll('.wifi-item').forEach(function(el){"
        "el.classList.remove('selected');"
        "if(el.querySelector('.wifi-name').textContent.startsWith(s))el.classList.add('selected');"
        "});"
        "document.getElementById('pass_input').focus();"
        "}"
        "</script>"
        "</body></html>",
        wifi_list
    );

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html, strlen(html));
    free(html);
    free(wifi_list);
    return ESP_OK;
}

// ── POST /save - Save WiFi & restart ─────────────────────────────────
static esp_err_t prov_save_handler(httpd_req_t *req) {
    char buf[512];
    int len = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (len <= 0) return ESP_FAIL;
    buf[len] = '\0';

    char ssid[64] = {0}, pass[64] = {0};
    char *p;

    p = strstr(buf, "ssid=");
    if (p) { sscanf(p + 5, "%63[^&]", ssid); for (int i=0;ssid[i];i++) if(ssid[i]=='+') ssid[i]=' '; }
    p = strstr(buf, "pass=");
    if (p) { sscanf(p + 5, "%63[^&\r\n]", pass); for (int i=0;pass[i];i++) if(pass[i]=='+') pass[i]=' '; }

    ESP_LOGI(TAG, "Saving WiFi: '%s'", ssid);

    const char *resp =
        "<!DOCTYPE html><html><head>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<style>"
        "body{font-family:-apple-system,sans-serif;background:#0d0d0d;color:#e8e8e8;"
        "display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px}"
        ".card{background:#141414;border:1px solid #2a2a2a;border-radius:16px;padding:32px;max-width:320px}"
        "h2{color:#4f8ef7;font-size:20px;margin-bottom:12px}"
        "p{color:#888;font-size:13px;line-height:1.7;margin-bottom:8px}"
        ".code-hint{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;"
        "padding:12px;margin-top:16px;font-size:12px;color:#666}"
        "</style></head><body>"
        "<div class='card'>"
        "<div style='font-size:44px;margin-bottom:12px'>✅</div>"
        "<h2>Connecting...</h2>"
        "<p>ESP32 is connecting to your WiFi.</p>"
        "<p>Device will restart in 2 seconds.</p>"
        "<div class='code-hint'>"
        "📺 After restart, a <strong style='color:#e8e8e8'>6-digit activation code</strong> "
        "will appear on the OLED display.<br><br>"
        "Enter it on <strong style='color:#4f8ef7'>IndiChat web</strong> to activate your device."
        "</div>"
        "</div></body></html>";

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, resp, strlen(resp));

    nvs_save_wifi(ssid, pass);
    vTaskDelay(pdMS_TO_TICKS(1500));
    esp_restart();
    return ESP_OK;
}

// ── Start HTTP server ─────────────────────────────────────────────────
static void start_prov_server(void) {
    httpd_config_t cfg = HTTPD_DEFAULT_CONFIG();
    cfg.server_port  = 80;
    cfg.max_uri_handlers = 8;
    if (httpd_start(&prov_server, &cfg) != ESP_OK) return;

    httpd_uri_t get_uri  = { .uri="/",     .method=HTTP_GET,  .handler=prov_get_handler  };
    httpd_uri_t save_uri = { .uri="/save", .method=HTTP_POST, .handler=prov_save_handler };
    httpd_register_uri_handler(prov_server, &get_uri);
    httpd_register_uri_handler(prov_server, &save_uri);
    ESP_LOGI(TAG, "Prov server on :80");
}

// ── Public API ────────────────────────────────────────────────────────
void wifi_prov_init(void) {
    wifi_events = xEventGroupCreate();
    generate_ap_credentials();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,    wifi_event_handler, NULL);
    esp_event_handler_register(IP_EVENT,   IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL);
}

void wifi_prov_start_ap(void) {
    ESP_LOGI(TAG, "Starting AP: %s  Pass: %s", ap_ssid, ap_password);
    led_set(LED_BLINK_SLOW);

    esp_netif_create_default_wifi_ap();

    wifi_config_t ap_cfg = {
        .ap = {
            .channel        = 6,
            .max_connection = 4,
            .authmode       = WIFI_AUTH_WPA2_PSK,
        }
    };
    memcpy(ap_cfg.ap.ssid,     ap_ssid,     strlen(ap_ssid));
    memcpy(ap_cfg.ap.password, ap_password, strlen(ap_password));
    ap_cfg.ap.ssid_len = strlen(ap_ssid);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Show AP info on OLED
    oled_show_ap_info(ap_ssid, ap_password, WIFI_AP_IP);
    start_prov_server();
}

bool wifi_prov_has_credentials(void) {
    char ssid[64], pass[64];
    return nvs_load_wifi(ssid, pass);
}

void wifi_prov_connect_saved(void) {
    char ssid[64] = {0}, pass[64] = {0};
    if (!nvs_load_wifi(ssid, pass)) {
        ESP_LOGW(TAG, "No saved credentials");
        return;
    }
    ESP_LOGI(TAG, "Connecting to: %s", ssid);
    led_set(LED_BLINK_FAST);

    wifi_config_t sta_cfg = {};
    strncpy((char*)sta_cfg.sta.ssid,     ssid, sizeof(sta_cfg.sta.ssid));
    strncpy((char*)sta_cfg.sta.password, pass, sizeof(sta_cfg.sta.password));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &sta_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    EventBits_t bits = xEventGroupWaitBits(wifi_events,
        WIFI_CONNECTED_BIT | WIFI_FAIL_BIT, pdFALSE, pdFALSE,
        pdMS_TO_TICKS(15000));

    if (!(bits & WIFI_CONNECTED_BIT)) {
        ESP_LOGW(TAG, "WiFi connect failed - showing saved password");
        led_set(LED_BLINK_SLOW);
        // Show saved WiFi password on OLED so user can reconnect ESP AP
        oled_show_wifi_reconnect(ssid, pass, ap_ssid, ap_password);
    }
}

void wifi_prov_on_connected(wifi_connected_cb_t cb)        { on_connected_cb    = cb; }
void wifi_prov_on_disconnected(wifi_disconnected_cb_t cb)  { on_disconnected_cb = cb; }

void wifi_prov_erase(void) {
    nvs_handle_t h;
    nvs_open(NVS_NAMESPACE, NVS_READWRITE, &h);
    nvs_erase_all(h);
    nvs_commit(h);
    nvs_close(h);
}

const char* wifi_prov_get_ip(void)       { return device_ip;   }
const char* wifi_prov_get_ap_ssid(void)  { return ap_ssid;     }
const char* wifi_prov_get_ap_pass(void)  { return ap_password; }
