#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

typedef void (*audio_data_cb_t)(const uint8_t *opus_data, size_t len);

void audio_init(void);
void audio_start_recording(audio_data_cb_t cb);  // mic on, OPUS frames → cb
void audio_stop_recording(void);
void audio_play_opus(const uint8_t *data, size_t len);  // play OPUS frame
void audio_stop_playing(void);
bool audio_is_playing(void);
