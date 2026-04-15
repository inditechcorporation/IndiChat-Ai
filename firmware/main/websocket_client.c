#include "websocket_client.h"
#include "config.h"
#include "esp_websocket_client.h"
#include "esp_log.h"
#include "cJSON.h"
#include <string.h>

static const char *TAG = "WS";

static esp_websocket_client_handle_t ws_client = NULL;
static ws_audio_cb_t      on_audio_cb      = NULL;
static ws_text_cb_t       on_text_cb       = NULL;
static ws_connected_cb_t  on_connected_cb  = NULL;
static ws_disconnected_cb_t on_disconnected_cb = NULL;

static void ws_event_handler(void *arg, esp_event_base_t base,
                              int32_t event_id, void *event_data) {
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;

    switch (event_id) {
        case WEBSOCKET_EVENT_CONNECTED:
            ESP_LOGI(TAG, "Connected");
            if (on_connected_cb) on_connected_cb();
            break;

        case WEBSOCKET_EVENT_DISCONNECTED:
            ESP_LOGW(TAG, "Disconnected");
            if (on_disconnected_cb) on_disconnected_cb();
            break;

        case WEBSOCKET_EVENT_DATA:
            if (data->op_code == 0x02) {
                // Binary frame = OPUS audio from server
                if (on_audio_cb && data->data_len > 0) {
                    on_audio_cb((const uint8_t *)data->data_ptr, data->data_len);
                }
            } else if (data->op_code == 0x01) {
                // Text frame = JSON control message
                char *json_str = malloc(data->data_len + 1);
                memcpy(json_str, data->data_ptr, data->data_len);
                json_str[data->data_len] = '\0';

                cJSON *root = cJSON_Parse(json_str);
                if (root) {
                    cJSON *type = cJSON_GetObjectItem(root, "type");
                    if (cJSON_IsString(type) && on_text_cb) {
                        // Extract text field if present
                        cJSON *text_item = cJSON_GetObjectItem(root, "text");
                        cJSON *state_item = cJSON_GetObjectItem(root, "state");
                        const char *text = cJSON_IsString(text_item)  ? text_item->valuestring  :
                                           cJSON_IsString(state_item) ? state_item->valuestring : "";
                        on_text_cb(type->valuestring, text);
                    }
                    cJSON_Delete(root);
                }
                free(json_str);
            }
            break;

        case WEBSOCKET_EVENT_ERROR:
            ESP_LOGE(TAG, "WebSocket error");
            break;

        default: break;
    }
}

void ws_init(void) {
    ESP_LOGI(TAG, "WS client init");
}

bool ws_connect(const char *url) {
    ESP_LOGI(TAG, "Connecting to: %s", url);

    esp_websocket_client_config_t cfg = {
        .uri                = url,
        .reconnect_timeout_ms = 5000,
        .network_timeout_ms   = 8000,
        .buffer_size          = AUDIO_BUF_SIZE,
    };

    ws_client = esp_websocket_client_init(&cfg);
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY,
                                  ws_event_handler, NULL);
    return esp_websocket_client_start(ws_client) == ESP_OK;
}

void ws_disconnect(void) {
    if (ws_client) {
        esp_websocket_client_stop(ws_client);
        esp_websocket_client_destroy(ws_client);
        ws_client = NULL;
    }
}

bool ws_is_connected(void) {
    return ws_client && esp_websocket_client_is_connected(ws_client);
}

void ws_send_json(const char *json) {
    if (!ws_is_connected()) return;
    esp_websocket_client_send_text(ws_client, json, strlen(json), pdMS_TO_TICKS(1000));
}

void ws_send_audio(const uint8_t *data, size_t len) {
    if (!ws_is_connected()) return;
    esp_websocket_client_send_bin(ws_client, (const char *)data, len, pdMS_TO_TICKS(500));
}

void ws_send_listen_start(void) {
    ws_send_json("{\"type\":\"listen\",\"state\":\"start\",\"mode\":\"manual\"}");
}

void ws_send_listen_stop(void) {
    ws_send_json("{\"type\":\"listen\",\"state\":\"stop\"}");
}

void ws_send_abort(void) {
    ws_send_json("{\"type\":\"abort\",\"reason\":\"user\"}");
}

void ws_on_audio(ws_audio_cb_t cb)             { on_audio_cb       = cb; }
void ws_on_text(ws_text_cb_t cb)               { on_text_cb        = cb; }
void ws_on_connected(ws_connected_cb_t cb)     { on_connected_cb   = cb; }
void ws_on_disconnected(ws_disconnected_cb_t cb){ on_disconnected_cb = cb; }
