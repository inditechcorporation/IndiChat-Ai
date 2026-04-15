#include "ota_client.h"
#include "config.h"
#include "esp_http_client.h"
#include "esp_mac.h"
#include "esp_log.h"
#include "cJSON.h"
#include <string.h>
#include <stdio.h>

static const char *TAG = "OTA";
static char response_buf[2048];
static int  response_len = 0;

static esp_err_t http_event_handler(esp_http_client_event_t *evt) {
    if (evt->event_id == HTTP_EVENT_ON_DATA) {
        int copy = evt->data_len;
        if (response_len + copy < (int)sizeof(response_buf) - 1) {
            memcpy(response_buf + response_len, evt->data, copy);
            response_len += copy;
        }
    }
    return ESP_OK;
}

static void get_device_id(char *buf, size_t len) {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    snprintf(buf, len, "%02x:%02x:%02x:%02x:%02x:%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

bool ota_check(ota_response_t *out) {
    char device_id[32];
    get_device_id(device_id, sizeof(device_id));

    memset(response_buf, 0, sizeof(response_buf));
    response_len = 0;

    esp_http_client_config_t cfg = {
        .url            = OTA_URL,
        .method         = HTTP_METHOD_POST,
        .event_handler  = http_event_handler,
        .timeout_ms     = 8000,
        .skip_cert_common_name_check = true,
    };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);

    // Headers
    esp_http_client_set_header(client, "Device-Id",    device_id);
    esp_http_client_set_header(client, "Client-Id",    device_id);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "User-Agent",   "MyVoiceBot/1.0");

    // Empty JSON body
    esp_http_client_set_post_field(client, "{}", 2);

    esp_err_t err = esp_http_client_perform(client);
    int status    = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);

    if (err != ESP_OK || status != 200) {
        ESP_LOGE(TAG, "OTA check failed: err=%d status=%d", err, status);
        return false;
    }

    ESP_LOGI(TAG, "OTA response: %s", response_buf);

    cJSON *root = cJSON_Parse(response_buf);
    if (!root) return false;

    memset(out, 0, sizeof(*out));

    // Check activation
    cJSON *activation = cJSON_GetObjectItem(root, "activation");
    if (cJSON_IsObject(activation)) {
        cJSON *code = cJSON_GetObjectItem(activation, "code");
        cJSON *msg  = cJSON_GetObjectItem(activation, "message");
        if (cJSON_IsString(code)) {
            strncpy(out->activation_code, code->valuestring, sizeof(out->activation_code) - 1);
            out->needs_activation = true;
        }
        if (cJSON_IsString(msg)) {
            ESP_LOGI(TAG, "Activation msg: %s", msg->valuestring);
        }
    }

    // Check websocket config
    cJSON *ws = cJSON_GetObjectItem(root, "websocket");
    if (cJSON_IsObject(ws)) {
        cJSON *url   = cJSON_GetObjectItem(ws, "url");
        cJSON *token = cJSON_GetObjectItem(ws, "token");
        if (cJSON_IsString(url) && cJSON_IsString(token)) {
            snprintf(out->ws_url, sizeof(out->ws_url), "%s?token=%s",
                     url->valuestring, token->valuestring);
            out->has_ws_config = true;
        }
    }

    cJSON_Delete(root);
    return true;
}

bool ota_poll_activation(void) {
    char device_id[32];
    get_device_id(device_id, sizeof(device_id));

    memset(response_buf, 0, sizeof(response_buf));
    response_len = 0;

    char url[128];
    snprintf(url, sizeof(url), "http://%s:%d/ota/activate", SERVER_HOST, SERVER_PORT);

    esp_http_client_config_t cfg = {
        .url           = url,
        .method        = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .timeout_ms    = 5000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    esp_http_client_set_header(client, "Device-Id",    device_id);
    esp_http_client_set_header(client, "Client-Id",    device_id);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, "{}", 2);

    esp_err_t err = esp_http_client_perform(client);
    int status    = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);

    // 200 = activated, 202 = still waiting
    return (err == ESP_OK && status == 200);
}
