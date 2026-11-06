package com.westchesterguy.chat;

import android.app.Notification;

/**
 * Shows MW Chat's notifications on Chrome's behalf. Each one goes on the
 * channel of the alert sound chosen in Settings (see Tones), so it plays that
 * sound. Chrome is checked as the caller before this runs.
 */
public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
    }

    @Override
    public boolean onNotifyNotificationWithChannel(String platformTag, int platformId,
            Notification notification, String channelName) {
        // The chosen tone's channel already exists with its sound, so the parent
        // posts onto it rather than making a plain one.
        return super.onNotifyNotificationWithChannel(platformTag, platformId, notification, Tones.prepare(this));
    }
}
