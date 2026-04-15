#pragma once
#include <stdbool.h>

typedef struct {
    char activation_code[16];
    char ws_url[128];
    bool needs_activation;
    bool has_ws_config;
} ota_response_t;

bool ota_check(ota_response_t *out);
bool ota_poll_activation(void);   // returns true when activated
