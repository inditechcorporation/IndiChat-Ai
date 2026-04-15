#pragma once
#include <stdbool.h>
#include <stddef.h>

typedef void (*wifi_connected_cb_t)(const char *ip);
typedef void (*wifi_disconnected_cb_t)(void);

void wifi_prov_init(void);
void wifi_prov_start_ap(void);
bool wifi_prov_has_credentials(void);
void wifi_prov_connect_saved(void);
void wifi_prov_on_connected(wifi_connected_cb_t cb);
void wifi_prov_on_disconnected(wifi_disconnected_cb_t cb);
void wifi_prov_erase(void);

const char* wifi_prov_get_ip(void);
const char* wifi_prov_get_ap_ssid(void);
const char* wifi_prov_get_ap_pass(void);
