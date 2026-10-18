package com.splendor.table;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    immersive();
  }
  private void immersive() {
    getWindow().setStatusBarColor(Color.rgb(7, 16, 22));
    getWindow().getDecorView().setSystemUiVisibility(
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
      View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    );
  }
  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) immersive();
  }
}
