#include "audio.h"
#include "config.h"
#include "esp_log.h"
#include "driver/i2s_std.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "opus.h"
#include <string.h>
#include <stdlib.h>

static const char *TAG = "AUDIO";

// I2S handles
static i2s_chan_handle_t mic_chan  = NULL;
static i2s_chan_handle_t spk_chan  = NULL;

// OPUS encoder/decoder
static OpusEncoder *encoder = NULL;
static OpusDecoder *decoder = NULL;

// Recording state
static volatile bool recording = false;
static audio_data_cb_t data_cb = NULL;
static TaskHandle_t rec_task   = NULL;

// Playback queue
static QueueHandle_t play_queue = NULL;
typedef struct { uint8_t *data; size_t len; } play_item_t;

// ── I2S Init ─────────────────────────────────────────────────────────
static void init_mic_i2s(void) {
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(MIC_I2S_PORT, I2S_ROLE_MASTER);
    chan_cfg.auto_clear = true;
    ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, NULL, &mic_chan));

    i2s_std_config_t std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(MIC_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = MIC_SCK_GPIO,
            .ws   = MIC_WS_GPIO,
            .dout = I2S_GPIO_UNUSED,
            .din  = MIC_SD_GPIO,
            .invert_flags = { .mclk_inv=false, .bclk_inv=false, .ws_inv=false },
        },
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(mic_chan, &std_cfg));
    ESP_LOGI(TAG, "MIC I2S init OK");
}

static void init_spk_i2s(void) {
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(SPK_I2S_PORT, I2S_ROLE_MASTER);
    chan_cfg.auto_clear = true;
    ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, &spk_chan, NULL));

    i2s_std_config_t std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(SPK_SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = SPK_BCLK_GPIO,
            .ws   = SPK_LRCK_GPIO,
            .dout = SPK_DIN_GPIO,
            .din  = I2S_GPIO_UNUSED,
            .invert_flags = { .mclk_inv=false, .bclk_inv=false, .ws_inv=false },
        },
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(spk_chan, &std_cfg));
    ESP_LOGI(TAG, "SPK I2S init OK");
}

// ── Recording task ────────────────────────────────────────────────────
static void record_task(void *arg) {
    // PCM buffer: 960 samples * 4 bytes (32-bit I2S) = 3840 bytes
    int32_t *pcm32 = malloc(OPUS_FRAME_SIZE * sizeof(int32_t));
    int16_t *pcm16 = malloc(OPUS_FRAME_SIZE * sizeof(int16_t));
    uint8_t *opus  = malloc(AUDIO_BUF_SIZE);

    i2s_channel_enable(mic_chan);

    while (recording) {
        size_t bytes_read = 0;
        i2s_channel_read(mic_chan, pcm32, OPUS_FRAME_SIZE * sizeof(int32_t),
                         &bytes_read, pdMS_TO_TICKS(100));

        int samples = bytes_read / sizeof(int32_t);
        // Convert 32-bit to 16-bit (INMP441 data is in upper 24 bits)
        for (int i = 0; i < samples; i++) {
            pcm16[i] = (int16_t)(pcm32[i] >> 14);
        }

        // Encode to OPUS
        int encoded = opus_encode(encoder, pcm16, OPUS_FRAME_SIZE, opus, AUDIO_BUF_SIZE);
        if (encoded > 0 && data_cb) {
            data_cb(opus, encoded);
        }
    }

    i2s_channel_disable(mic_chan);
    free(pcm32); free(pcm16); free(opus);
    rec_task = NULL;
    vTaskDelete(NULL);
}

// ── Playback task ─────────────────────────────────────────────────────
static void play_task(void *arg) {
    int16_t *pcm = malloc(OPUS_FRAME_SIZE * sizeof(int16_t));
    i2s_channel_enable(spk_chan);

    play_item_t item;
    while (1) {
        if (xQueueReceive(play_queue, &item, portMAX_DELAY) == pdTRUE) {
            if (item.data == NULL) break; // stop signal

            int samples = opus_decode(decoder, item.data, item.len,
                                      pcm, OPUS_FRAME_SIZE, 0);
            if (samples > 0) {
                size_t written;
                i2s_channel_write(spk_chan, pcm, samples * sizeof(int16_t),
                                  &written, pdMS_TO_TICKS(200));
            }
            free(item.data);
        }
    }

    i2s_channel_disable(spk_chan);
    free(pcm);
    vTaskDelete(NULL);
}

// ── Public API ────────────────────────────────────────────────────────
void audio_init(void) {
    init_mic_i2s();
    init_spk_i2s();

    int err;
    encoder = opus_encoder_create(MIC_SAMPLE_RATE, 1, OPUS_APPLICATION_VOIP, &err);
    opus_encoder_ctl(encoder, OPUS_SET_BITRATE(OPUS_BITRATE));
    opus_encoder_ctl(encoder, OPUS_SET_COMPLEXITY(5)); // 0-10, lower=faster

    decoder = opus_decoder_create(SPK_SAMPLE_RATE, 1, &err);

    play_queue = xQueueCreate(32, sizeof(play_item_t));
    xTaskCreate(play_task, "play_task", 4096, NULL, 6, NULL);

    ESP_LOGI(TAG, "Audio init OK (OPUS %s)", opus_get_version_string());
}

void audio_start_recording(audio_data_cb_t cb) {
    if (recording) return;
    data_cb   = cb;
    recording = true;
    xTaskCreate(record_task, "rec_task", 4096, NULL, 7, &rec_task);
    ESP_LOGI(TAG, "Recording started");
}

void audio_stop_recording(void) {
    recording = false;
    ESP_LOGI(TAG, "Recording stopped");
}

void audio_play_opus(const uint8_t *data, size_t len) {
    play_item_t item;
    item.data = malloc(len);
    item.len  = len;
    memcpy(item.data, data, len);
    xQueueSend(play_queue, &item, pdMS_TO_TICKS(100));
}

void audio_stop_playing(void) {
    // Flush queue
    play_item_t item;
    while (xQueueReceive(play_queue, &item, 0) == pdTRUE) {
        if (item.data) free(item.data);
    }
}

bool audio_is_playing(void) {
    return uxQueueMessagesWaiting(play_queue) > 0;
}
