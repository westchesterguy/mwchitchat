import { THEME_BOOTSTRAP } from "./prefs";

/** Applies the device's theme before the admin app paints. */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />;
}
