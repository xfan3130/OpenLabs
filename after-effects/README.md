# Beat Marker (After Effects script)

`BeatMarker.jsx` analyses the audio of a selected layer and places a marker on every beat.

## Install
- **Dockable panel:** copy `BeatMarker.jsx` into `Adobe After Effects <version>/Scripts/ScriptUI Panels/`, restart AE, then open it from **Window > BeatMarker.jsx**.
- **One-off:** **File > Scripts > Run Script File…** and choose `BeatMarker.jsx`.

## Use
1. Open a comp and select one layer with audio.
2. Pick an **Intensity** preset, or tune the controls yourself:
   | Control | Effect |
   |---|---|
   | **Sensitivity** (1–100) | How much a hit must stand out from surrounding loudness. Higher → more markers. |
   | **Min spacing** (ms) | Shortest allowed gap between markers. Higher → fewer markers. |
   | **Mark every** | Keep every beat, or only every 2nd / 4th / 8th. |
3. Click **Mark Beats**. Adjust and click again: audio is analysed once and cached, and the previous beat markers are replaced.

Other options: place markers on the audio layer or the composition, marker color label, numbered markers (`Beat 1`, `Beat 2`, …). **Count** reports how many beats the current settings would produce without placing markers; **Clear** removes only markers made by this script.

Presets: Light (strong hits only), Medium, Heavy, Insane (every transient).

## Notes
- Uses AE's built-in *Convert Audio to Keyframes* on the comp's **work area**, with other audio layers temporarily muted. The temporary "Audio Amplitude" layer is deleted afterwards. Everything is one undo step.
- It detects loudness peaks, so it follows kicks/snares and other transients well; it does not split frequency bands.
- Composition markers and color labels require AE CC 2017 or newer.
