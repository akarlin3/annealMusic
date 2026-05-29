package org.averykarlin.anneal;

import android.os.Bundle;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        focusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_LOSS:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                        dispatchJSEvent("begin");
                        break;
                    case AudioManager.AUDIOFOCUS_GAIN:
                        dispatchJSEvent("end");
                        break;
                }
            }
        };

        requestAudioFocus();
    }

    private void requestAudioFocus() {
        if (audioManager == null) return;
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
                
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(focusChangeListener)
                .build();
                
            audioManager.requestAudioFocus(focusRequest);
        } else {
            audioManager.requestAudioFocus(focusChangeListener, 
                AudioManager.STREAM_MUSIC, 
                AudioManager.AUDIOFOCUS_GAIN);
        }
    }

    private void dispatchJSEvent(final String type) {
        final String js = "window.dispatchEvent(new CustomEvent('am_audio_interruption', { detail: { type: '" + type + "' } }));";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(js, null);
                }
            }
        });
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (audioManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest);
            } else {
                audioManager.abandonAudioFocus(focusChangeListener);
            }
        }
    }
}
