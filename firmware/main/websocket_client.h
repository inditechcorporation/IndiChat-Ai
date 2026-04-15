#pragma once
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

typedef void (*ws_audio_cb_t)(const uint8_t *data, size_t len);
typedef void (*ws_text_cb_t)(const char *type, const char *text);
typedef void (*ws_connected_cb_t)(void);
typedef void (*ws_disconnected_cb_t)(void);

void ws_init(void);
bool ws_connect(const char *url);
void ws_disconnect(void);
bool ws_is_connected(void);

void ws_send_json(const char *json);
void ws_send_audio(const uint8_t *data, size_t len);
void ws_send_listen_start(void);
void ws_send_listen_stop(void);
void ws_send_abort(void);

void ws_on_audio(ws_audio_cb_t cb);
void ws_on_text(ws_text_cb_t cb);
void ws_on_connected(ws_connected_cb_t cb);
void ws_on_disconnected(ws_disconnected_cb_t cb);
