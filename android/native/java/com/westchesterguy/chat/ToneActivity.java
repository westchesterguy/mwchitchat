package com.westchesterguy.chat;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Opened by MW Chat's Settings page with mwchat://tone?id=bell: makes that tone
 * the phone's alert sound for MW Chat, says so, and closes. Any page could
 * open this link, but all it can do is change this app's alert sound.
 */
public class ToneActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri data = getIntent().getData();
        String id = data == null ? null : data.getQueryParameter("id");
        if (id != null && Tones.isKnown(id)) {
            Tones.choose(this, id);
            Toast.makeText(this, "MW Chat alert sound: " + Tones.label(id), Toast.LENGTH_SHORT).show();
        }
        finish();
    }
}
